import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { processProductAlerts } from "@paymoon/events";
import { transaction } from "@paymoon/db";
import { Store } from "./platform";
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test(
  "growth features preserve tenant isolation, atomic imports, coupon capacity, campaign dedupe and return boundaries",
  { skip: !url },
  async () => {
    if (
      !new URL(url!).pathname.endsWith("_test") ||
      !process.env.COMMERCE_REDIS_TEST_URL
    )
      throw new Error("Isolated test services required");
    Object.assign(process.env, {
      COMMERCE_DATABASE_URL: url,
      COMMERCE_REDIS_URL: process.env.COMMERCE_REDIS_TEST_URL,
      NODE_ENV: "test",
      COMMERCE_ENVIRONMENT: "test",
      LOG_LEVEL: "silent",
      COMMERCE_PAYMENT_MODE: "sandbox",
    });
    const app = await createApp(),
      server = app.getHttpAdapter().getInstance(),
      store = app.get(Store);
    try {
      const addresses = new Map<string, string>();
      const call = async (
        method: "GET" | "POST" | "PUT" | "DELETE",
        path: string,
        token?: string,
        payload?: object,
        key = randomUUID(),
      ) => {
        const actor = token ?? "registration";
        if (!addresses.has(actor))
          addresses.set(actor, `127.0.0.${addresses.size + 1}`);
        const r = await server.inject({
          remoteAddress: addresses.get(actor),
          method,
          url: path,
          headers: {
            ...(token ? { authorization: "Bearer " + token } : {}),
            "idempotency-key": key,
          },
          ...(payload ? { payload } : {}),
        });
        return { status: r.statusCode, body: r.json() };
      };
      const register = () =>
        call("POST", "/v1/identity/register", undefined, {
          email: randomUUID() + "@test.invalid",
          password: "growth-test-password",
        });
      const owner = await register(),
        buyer = await register(),
        other = await register(),
        staff = await register();
      const t = owner.body.token,
        b = buyer.body.token;
      store.config.COMMERCE_ADMIN_USER_IDS = owner.body.user.id;
      const org = await call("POST", "/v1/organizations", t, {
        name: "Growth shop",
        slug: randomUUID(),
      });
      const base = "/v1/organizations/" + org.body.id;
      const merchant = await call("POST", base + "/merchant", t, {
        displayName: "Growth shop",
      });
      await call("POST", base + "/merchant/submit", t);
      await call("PUT", "/v1/admin/merchants/" + merchant.body.id, t, {
        status: "approved",
      });
      await call("PUT", base + "/members/" + staff.body.user.id, t, {
        role: "staff",
      });
      assert.equal(
        (await call("GET", base + "/customers", staff.body.token)).status,
        403,
      );
      assert.equal(
        (await call("GET", base + "/customers", other.body.token)).status,
        403,
      );
      const csv =
        'title,description,sku,price_toman,quantity,image_url,color,size\n"Growth mug","Washable, ceramic",GROWTH-1,100000,10,https://cdn.example.test/mug.png,white,M\n"Growth mug","Washable, ceramic",GROWTH-2,200000,10,https://cdn.example.test/mug.png,black,L\n';
      assert.equal(
        (await call("POST", base + "/products/import-csv/preview", t, { csv }))
          .body.rows.length,
        2,
      );
      assert.equal(
        (
          await call("POST", base + "/products/import-csv/preview", t, {
            csv: "bad",
          })
        ).status,
        400,
      );
      const importKey = randomUUID();
      const imported = await call(
        "POST",
        base + "/products/import-csv",
        t,
        { csv },
        importKey,
      );
      assert.equal(imported.status, 201);
      assert.equal(imported.body.products.length, 1);
      assert.equal(
        (
          await call(
            "POST",
            base + "/products/import-csv",
            t,
            { csv },
            importKey,
          )
        ).body.products[0].id,
        imported.body.products[0].id,
      );
      const id = imported.body.products[0].id;
      const before = (
        await store.db.pool.query(
          "SELECT count(*) FROM commerce.products WHERE organization_id=$1",
          [org.body.id],
        )
      ).rows[0].count;
      const conflicted = csv.replace("GROWTH-1", "UNIQUE-NEW");
      assert.equal(
        (
          await call("POST", base + "/products/import-csv", t, {
            csv: conflicted,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT count(*) FROM commerce.products WHERE organization_id=$1",
            [org.body.id],
          )
        ).rows[0].count,
        before,
        "entire import rolls back",
      );
      await call("POST", base + "/products/" + id + "/status", t, {
        version: 1,
        status: "published",
      });
      const p = (await call("GET", "/v1/marketplace/products/" + id)).body;
      const variant = p.variants[0];
      const products = await call(
        "GET",
        "/v1/marketplace/products?sort=price_asc&inStock=true&minPrice=90000&maxPrice=110000",
      );
      assert.equal(products.status, 200);
      assert.ok(products.body.some((x: { id: string }) => x.id === id));
      assert.equal(
        (
          await call("GET", "/v1/marketplace/products?minPrice=999999999999")
        ).body.some((x: { id: string }) => x.id === id),
        false,
      );
      assert.equal(
        (await call("GET", "/v1/discovery/shops?q=Growth&sort=popular")).status,
        200,
      );
      assert.equal(
        (
          await call(
            "GET",
            "/v1/discovery/instagram-link?url=" +
              encodeURIComponent("https://evil.invalid/p/secret/"),
          )
        ).status,
        400,
      );
      const coupon = await call("POST", base + "/coupons", t, {
        code: "WELCOME",
        kind: "percent",
        value: "10",
        minimumMinor: "0",
        usageLimit: 1,
        perCustomerLimit: 1,
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(coupon.status, 201);
      const address = await call("POST", "/v1/me/addresses", b, {
        label: "home",
        recipient: "Buyer",
        phone: "09123456789",
        province: "Tehran",
        city: "Tehran",
        postalCode: "1234567890",
        address: "Test delivery address",
      });
      const input = {
        addressId: address.body.id,
        items: [{ variantId: variant.id, quantity: 1 }],
        couponCode: "WELCOME",
      };
      const key = randomUUID();
      const replay = await Promise.all([
        call("POST", "/v1/me/checkout", b, input, key),
        call("POST", "/v1/me/checkout", b, input, key),
      ]);
      assert.equal(replay[0].status, 201);
      assert.equal(replay[0].body.id, replay[1].body.id);
      assert.equal(replay[0].body.discount_minor, "100000");
      assert.equal(replay[0].body.amount_minor, "900000");
      assert.equal(
        (await call("POST", "/v1/me/checkout", b, input)).status,
        409,
        "coupon capacity counts pending reservations",
      );
      await call("POST", "/v1/me/orders/" + replay[0].body.id + "/cancel", b);
      const race = await Promise.all([
        call("POST", "/v1/me/checkout", b, input),
        call("POST", "/v1/me/checkout", b, input),
      ]);
      assert.deepEqual(race.map((x) => x.status).sort(), [201, 409]);
      const order = race.find((x) => x.status === 201)!.body;
      await call("POST", "/v1/me/orders/" + order.id + "/sandbox-payment", b);
      await call("POST", "/v1/me/orders/" + order.id + "/sandbox-payment", b);
      const reports = await call("GET", base + "/reports?days=30", t);
      assert.equal(reports.body.summary.revenue_minor, "900000");
      assert.equal(reports.body.summary.discount_minor, "100000");
      assert.equal(reports.body.summary.paid_orders, 1);
      const customers = await call("GET", base + "/customers", t);
      assert.equal(customers.body[0].lifetime_minor, "900000");
      assert.equal(customers.body[0].segment, "new");
      assert.equal(
        (
          await call(
            "PUT",
            base + "/customers/" + other.body.user.id + "/note",
            t,
            { note: "Not our customer" },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call(
            "PUT",
            base + "/customers/" + buyer.body.user.id + "/note",
            t,
            { note: "Prefers white" },
          )
        ).status,
        200,
      );
      assert.equal(
        (await call("GET", base + "/customers/" + buyer.body.user.id, t)).body
          .note,
        "Prefers white",
      );
      const campaignKey = randomUUID();
      const campaigns = await Promise.all([
        call(
          "POST",
          base + "/campaigns",
          t,
          { title: "New collection", body: "Visit the shop", segment: "all" },
          campaignKey,
        ),
        call(
          "POST",
          base + "/campaigns",
          t,
          { title: "New collection", body: "Visit the shop", segment: "all" },
          campaignKey,
        ),
      ]);
      assert.equal(campaigns[0].body.recipient_count, 1);
      assert.equal(campaigns[0].body.id, campaigns[1].body.id);
      const notices = (await call("GET", "/v1/me/notifications", b)).body;
      assert.equal(
        notices.filter(
          (x: { campaign_id: string }) =>
            x.campaign_id === campaigns[0].body.id,
        ).length,
        1,
      );
      assert.equal(
        (await call("GET", "/v1/me/notifications", other.body.token)).body.some(
          (x: { campaign_id: string }) =>
            x.campaign_id === campaigns[0].body.id,
        ),
        false,
      );
      await call("PUT", base + "/inventory/" + variant.id + "/threshold", t, {
        threshold: 20,
      });
      assert.ok(
        (await call("GET", base + "/inventory/alerts", t)).body.some(
          (x: { variant_id: string }) => x.variant_id === variant.id,
        ),
      );
      assert.equal(
        (
          await call(
            "PUT",
            base + "/inventory/" + variant.id + "/threshold",
            other.body.token,
            { threshold: 1 },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call("POST", "/v1/me/orders/" + order.id + "/return", b, {
            reason: "Need another size",
          })
        ).status,
        404,
        "unshipped orders cannot request return",
      );
      await call("POST", base + "/orders/" + order.id + "/fulfill", t);
      await call("POST", base + "/orders/" + order.id + "/ship", t, {
        carrier: "Post",
        trackingCode: "TEST123",
      });
      await call("POST", "/v1/me/orders/" + order.id + "/complete", b);
      assert.equal(
        (
          await call(
            "POST",
            "/v1/me/orders/" + order.id + "/return",
            other.body.token,
            { reason: "Wrong buyer request" },
          )
        ).status,
        404,
      );
      const returned = await call(
        "POST",
        "/v1/me/orders/" + order.id + "/return",
        b,
        { reason: "Need another size" },
      );
      assert.equal(returned.status, 201);
      assert.equal(
        (
          await call("PUT", base + "/returns/" + returned.body.id, t, {
            status: "received",
            reply: "Received item",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await call("PUT", base + "/returns/" + returned.body.id, t, {
            status: "approved",
            reply: "Please return the item",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call("PUT", base + "/returns/" + returned.body.id, t, {
            status: "received",
            reply: "Received, finance review pending",
          })
        ).status,
        200,
      );
      assert.equal(
        (await call("GET", "/v1/me/orders/" + order.id, b)).body.status,
        "completed",
        "return does not fake refund",
      );
      const journals = (
        await store.db.pool.query(
          "SELECT count(*) FROM commerce.journals WHERE organization_id=$1",
          [org.body.id],
        )
      ).rows[0].count;
      assert.equal(journals, "1");

      const thread = await call("POST", "/v1/me/conversations", b, {
        merchantId: merchant.body.id,
      });
      assert.equal(thread.status, 201);
      const threadId = thread.body.id;
      const buyerMessages = "/v1/me/conversations/" + threadId + "/messages";
      const teamMessages = base + "/conversations/" + threadId + "/messages";
      assert.equal(
        (await call("GET", buyerMessages, other.body.token)).status,
        404,
      );
      const messageKey = randomUUID();
      const msg = await Promise.all([
        call(
          "POST",
          buyerMessages,
          b,
          { body: "Is another size available?" },
          messageKey,
        ),
        call(
          "POST",
          buyerMessages,
          b,
          { body: "Is another size available?" },
          messageKey,
        ),
      ]);
      assert.equal(msg[0].body.id, msg[1].body.id);
      assert.equal(
        (await call("GET", teamMessages, staff.body.token)).body.length,
        1,
      );
      assert.equal(
        (
          await call("PUT", base + "/conversations/" + threadId, t, {
            status: "pending",
            assignedTo: other.body.user.id,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call("PUT", base + "/conversations/" + threadId, t, {
            status: "pending",
            assignedTo: staff.body.user.id,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call("POST", teamMessages, staff.body.token, {
            body: "Yes, you can exchange it.",
          })
        ).status,
        201,
      );
      assert.equal((await call("GET", buyerMessages, b)).body.length, 2);
      assert.equal(
        (await call("GET", base + "/conversations", t)).body[0].status,
        "open",
      );
      await call("PUT", base + "/members/" + staff.body.user.id, t, {
        role: "viewer",
      });
      assert.equal(
        (await call("GET", teamMessages, staff.body.token)).status,
        403,
        "viewer cannot read private conversations",
      );
      assert.equal(
        (
          await call("POST", teamMessages, staff.body.token, {
            body: "Unauthorized reply",
          })
        ).status,
        403,
      );
      const watch = await call("POST", "/v1/me/product-alerts", b, {
        productId: id,
        kind: "price",
        targetMinor: "999999",
      });
      assert.equal(watch.status, 201);
      assert.equal(
        (
          await call(
            "DELETE",
            "/v1/me/product-alerts/" + watch.body.id,
            other.body.token,
          )
        ).status,
        404,
      );
      await transaction(store.db.pool, async (c) => {
        await processProductAlerts(c);
      });
      assert.equal(
        (await call("GET", "/v1/me/product-alerts", b)).body[0].active,
        true,
        "higher price does not trigger",
      );
      await call("POST", "/v1/me/product-alerts", b, {
        productId: id,
        kind: "price",
        targetMinor: "1000000",
      });
      await call("POST", "/v1/me/product-alerts", b, {
        productId: id,
        kind: "restock",
      });
      await Promise.all([
        transaction(store.db.pool, (c) => processProductAlerts(c)),
        transaction(store.db.pool, (c) => processProductAlerts(c)),
      ]);
      await transaction(store.db.pool, (c) => processProductAlerts(c));
      const watchNotices = (
        await call("GET", "/v1/me/notifications", b)
      ).body.filter((n: { kind: string }) => n.kind.startsWith("product."));
      assert.equal(
        watchNotices.length,
        2,
        "concurrent scans notify each watch once",
      );
      assert.equal(
        (await call("GET", "/v1/me/product-alerts", other.body.token)).body
          .length,
        0,
      );
      const demo = await call("GET", base + "/demo/instagram", t);
      assert.equal(demo.body.demo, true);
      const draft = await call("POST", base + "/demo/instagram/import", t, {
        postIds: ["mug"],
      });
      assert.equal(draft.status, 201);
      assert.equal(draft.body.products[0].status, "draft");
      const demoId = draft.body.products[0].id;
      assert.equal(
        (
          await call("POST", base + "/products/" + demoId + "/status", t, {
            version: 1,
            status: "published",
          })
        ).status,
        409,
      );
      const again = await call("POST", base + "/demo/instagram/import", t, {
        postIds: ["mug"],
      });
      assert.equal(again.body.products[0].id, demoId);
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT count(*) FROM commerce.instagram_connections WHERE organization_id=$1",
            [org.body.id],
          )
        ).rows[0].count,
        "0",
        "demo never creates fake Meta connection",
      );
      store.config.COMMERCE_ENVIRONMENT = "production";
      assert.equal(
        (await call("GET", base + "/demo/instagram", t)).status,
        403,
      );
    } finally {
      await app.close();
    }
  },
);
