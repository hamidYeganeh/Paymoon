import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./platform";
import { transaction } from "@paymoon/db";
import { expireOrders } from "@paymoon/events";
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test(
  "commerce lifecycle, checkout replay/race, buyer isolation, sandbox ledger, expiry and cookie CSRF",
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
      LOG_LEVEL: "silent",
      COMMERCE_PAYMENT_MODE: "sandbox",
    });
    const app = await createApp(),
      server = app.getHttpAdapter().getInstance(),
      store = app.get(Store);
    try {
      const call = async (
        method: "GET" | "POST" | "PUT" | "DELETE",
        path: string,
        token?: string,
        payload?: object,
        key?: string,
      ) => {
        const r = await server.inject({
          method,
          url: path,
          headers: {
            ...(token ? { authorization: "Bearer " + token } : {}),
            "idempotency-key": key ?? randomUUID(),
          },
          ...(payload ? { payload } : {}),
        });
        return { status: r.statusCode, body: r.json() };
      };
      const register = () =>
        call("POST", "/v1/identity/register", undefined, {
          email: randomUUID() + "@test.invalid",
          password: "commerce-test-password",
        });
      const owner = await register(),
        buyer = await register(),
        other = await register();
      assert.equal(owner.status, 201);
      const t = owner.body.token,
        b = buyer.body.token;
      store.config.COMMERCE_ADMIN_USER_IDS = owner.body.user.id;
      assert.equal((await call("GET", "/v1/admin/overview", b)).status, 403);
      const upload = await call("POST", "/v1/media", t, {
        mime: "image/png",
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
      });
      assert.equal(upload.status, 201);
      const uploaded = await server.inject({
        method: "GET",
        url: new URL(upload.body.url).pathname,
      });
      assert.equal(uploaded.statusCode, 200);
      assert.equal(
        uploaded.headers["cross-origin-resource-policy"],
        "cross-origin",
      );
      assert.match(String(uploaded.headers["content-type"]), /image\/png/);
      assert.equal(
        (
          await call("POST", "/v1/media", t, {
            mime: "image/jpeg",
            base64:
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
          })
        ).status,
        400,
      );
      const cors = await server.inject({
        method: "OPTIONS",
        url: "/v1/me/addresses",
        headers: {
          origin: "http://localhost:4100",
          "access-control-request-method": "PUT",
          "access-control-request-headers": "x-paymoon-client,content-type",
        },
      });
      assert.equal(cors.statusCode, 204);
      assert.ok(
        String(cors.headers["access-control-allow-methods"]).includes("PUT"),
      );
      const org = await call("POST", "/v1/organizations", t, {
        name: "Commerce shop",
        slug: randomUUID(),
      });
      const base = "/v1/organizations/" + org.body.id;
      const merchant = await call("POST", base + "/merchant", t, {
        displayName: "Commerce shop",
      });
      assert.equal(merchant.status, 201);
      assert.equal(
        (await call("POST", base + "/merchant/submit", t)).status,
        201,
      );
      assert.equal(
        (
          await call("PUT", "/v1/admin/merchants/" + merchant.body.id, t, {
            status: "approved",
          })
        ).status,
        200,
      );
      const product = await call("POST", base + "/products", t, {
        title: "Test vase",
        variants: [
          {
            sku: "VASE-1",
            priceMinor: "1250000",
            attributes: { color: "white" },
          },
        ],
      });
      assert.equal(product.status, 201);
      const p = product.body,
        v = p.variants[0];
      const edit = {
        version: 1,
        title: "Test vase",
        description: "Test product",
        categoryId: null,
        media: ["https://cdn.example.test/vase.jpg"],
        variants: [
          {
            id: v.id,
            sku: v.sku,
            priceMinor: v.price_minor,
            attributes: { color: "white" },
          },
        ],
      };
      assert.equal(
        (await call("PUT", base + "/products/" + p.id, t, edit)).status,
        200,
      );
      assert.equal(
        (await call("PUT", base + "/products/" + p.id, t, edit)).status,
        409,
        "stale versions rejected",
      );
      assert.equal(
        (
          await call("POST", base + "/products/" + p.id + "/status", t, {
            version: 2,
            status: "published",
          })
        ).status,
        201,
      );
      const socialPath = "/v1/marketplace/products/" + p.id;
      assert.equal((await call("PUT", "/v1/me/likes/" + p.id)).status, 401);
      await Promise.all([
        call("PUT", "/v1/me/likes/" + p.id, b),
        call("PUT", "/v1/me/likes/" + p.id, b),
      ]);
      assert.equal(
        (await call("GET", socialPath + "/activity")).body.likes,
        1,
        "concurrent likes do not duplicate",
      );
      const commentKey = randomUUID();
      const [comment, replay] = await Promise.all([
        call(
          "POST",
          socialPath + "/comments",
          b,
          { body: "Is this washable?" },
          commentKey,
        ),
        call(
          "POST",
          socialPath + "/comments",
          b,
          { body: "Is this washable?" },
          commentKey,
        ),
      ]);
      assert.equal(comment.status, 201);
      assert.equal(
        replay.body.id,
        comment.body.id,
        "comment retry deduplicates",
      );
      assert.equal(
        (
          await call(
            "POST",
            socialPath + "/comments",
            b,
            { body: "changed" },
            commentKey,
          )
        ).status,
        409,
      );
      assert.equal(
        (await call("GET", socialPath + "/activity")).body.comments,
        1,
      );
      assert.equal(
        (
          await call(
            "DELETE",
            socialPath + "/comments/" + comment.body.id,
            other.body.token,
          )
        ).status,
        403,
        "another buyer cannot delete",
      );
      const comments = (await call("GET", socialPath + "/comments")).body;
      assert.equal(comments.length, 1);
      assert.equal(comments[0].email, undefined, "email is never public");
      assert.equal(
        (await call("DELETE", socialPath + "/comments/" + comment.body.id, b))
          .status,
        200,
      );
      assert.equal(
        (await call("GET", socialPath + "/comments")).body.length,
        0,
      );
      await call("DELETE", "/v1/me/likes/" + p.id, b);
      assert.equal((await call("GET", socialPath + "/activity")).body.likes, 0);
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT count(*) FROM commerce.outbox WHERE topic='product.commented' AND payload->>'productId'=$1",
            [p.id],
          )
        ).rows[0].count,
        "1",
      );
      const stockPath = base + "/inventory/movements";
      assert.equal(
        (
          await call("POST", stockPath, t, {
            variantId: v.id,
            kind: "receive",
            quantity: 3,
          })
        ).status,
        201,
      );
      assert.equal(
        (await call("GET", "/v1/marketplace/products/" + p.id)).body.variants[0]
          .available,
        3,
      );
      const address = await call("POST", "/v1/me/addresses", b, {
        label: "home",
        recipient: "Buyer",
        phone: "09123456789",
        province: "Tehran",
        city: "Tehran",
        postalCode: "1234567890",
        address: "Test address for delivery",
      });
      assert.equal(address.status, 201);
      const input = {
        addressId: address.body.id,
        items: [{ variantId: v.id, quantity: 2 }],
      };
      const [first, again] = await Promise.all([
        call("POST", "/v1/me/checkout", b, input, "checkout-replay"),
        call("POST", "/v1/me/checkout", b, input, "checkout-replay"),
      ]);
      assert.equal(first.status, 201);
      assert.equal(again.body.id, first.body.id);
      const order = first.body.id;
      assert.equal(first.body.amount_minor, "2500000");
      assert.equal(
        (await call("POST", "/v1/me/checkout", b, input)).status,
        409,
        "no overselling",
      );
      assert.equal(
        (await call("GET", "/v1/me/orders/" + order, other.body.token)).status,
        404,
      );
      assert.equal(
        (
          await call(
            "POST",
            "/v1/me/orders/" + order + "/sandbox-payment",
            other.body.token,
          )
        ).status,
        404,
      );
      assert.equal(
        (await call("POST", "/v1/me/orders/" + order + "/sandbox-payment", b))
          .status,
        201,
      );
      assert.equal(
        (await call("POST", "/v1/me/orders/" + order + "/sandbox-payment", b))
          .status,
        201,
      );
      const balance = (
        await store.db.pool.query(
          "SELECT sum(e.debit)::text AS debit,sum(e.credit)::text AS credit,count(DISTINCT j.id)::integer AS journals FROM commerce.journals j JOIN commerce.ledger_entries e ON e.journal_id=j.id WHERE j.organization_id=$1",
          [org.body.id],
        )
      ).rows[0];
      assert.equal(balance.debit, balance.credit);
      assert.equal(balance.journals, 1);
      assert.equal(
        (await call("POST", base + "/orders/" + order + "/fulfill", t)).status,
        201,
      );
      assert.equal(
        (
          await call("POST", base + "/orders/" + order + "/ship", t, {
            carrier: "Post",
            trackingCode: "TEST123",
          })
        ).status,
        201,
      );
      assert.equal(
        (await call("POST", "/v1/me/orders/" + order + "/complete", b)).status,
        201,
      );
      assert.equal(
        (
          await call("POST", "/v1/me/orders/" + order + "/review", b, {
            rating: 5,
            body: "Good product",
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await call("POST", "/v1/me/orders/" + order + "/review", b, {
            rating: 5,
            body: "Duplicate",
          })
        ).status,
        409,
      );
      const ticket = await call("POST", "/v1/me/support", b, {
        subject: "Question",
        body: "Test support request",
        orderId: order,
      });
      assert.equal(ticket.status, 201);
      assert.equal(
        (
          await call("PUT", "/v1/admin/support/" + ticket.body.id, t, {
            reply: "We received your request.",
            status: "resolved",
          })
        ).status,
        200,
      );
      assert.equal(
        (await call("PUT", "/v1/me/following/" + merchant.body.id, b)).status,
        200,
      );
      assert.ok(
        (await call("GET", "/v1/me/following", b)).body.some(
          (x: { id: string }) => x.id === merchant.body.id,
        ),
      );
      const pending = await call("POST", "/v1/me/checkout", b, {
        ...input,
        items: [{ variantId: v.id, quantity: 1 }],
      });
      assert.equal(pending.status, 201);
      await store.db.pool.query(
        "UPDATE commerce.orders SET expires_at=now()-interval '1 minute' WHERE id=$1",
        [pending.body.id],
      );
      await transaction(store.db.pool, (c) => expireOrders(c));
      const inv = (
        await store.db.pool.query(
          "SELECT * FROM commerce.inventory WHERE variant_id=$1",
          [v.id],
        )
      ).rows[0];
      assert.equal(inv.available, 1);
      assert.equal(inv.reserved, 0);
      assert.equal(inv.committed, 0);
      assert.equal(
        (await call("GET", "/v1/me/orders/" + pending.body.id, b)).body.status,
        "cancelled",
      );
      const event = (
        await store.db.pool.query(
          "SELECT count(*)::integer AS n FROM commerce.analytics_events WHERE name='order.created' AND properties->>'orderId'=$1",
          [order],
        )
      ).rows[0];
      assert.equal(event.n, 1);
      const web = await server.inject({
        method: "POST",
        url: "/v1/identity/login",
        headers: { "x-paymoon-client": "web", origin: "http://localhost:4100" },
        payload: {
          email: buyer.body.user.email,
          password: "commerce-test-password",
        },
      });
      assert.equal(web.statusCode, 201);
      assert.equal(web.json().token, undefined);
      const cookie = String(web.headers["set-cookie"]).split(";")[0]!;
      assert.match(String(web.headers["set-cookie"]), /HttpOnly/);
      assert.equal(
        (
          await server.inject({
            method: "GET",
            url: "/v1/identity/me",
            headers: { cookie },
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await server.inject({
            method: "DELETE",
            url: "/v1/identity/session",
            headers: {
              cookie,
              origin: "https://evil.invalid",
              "x-paymoon-client": "web",
            },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await server.inject({
            method: "DELETE",
            url: "/v1/identity/session",
            headers: {
              cookie,
              origin: "http://localhost:4100",
              "x-paymoon-client": "web",
            },
          })
        ).statusCode,
        200,
      );
    } finally {
      await app.close();
    }
  },
);
