import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./platform";
import { verifySignature } from "./modules/instagram/instagram.module";
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test("Instagram signature checks exact raw bytes", () => {
  const raw = Buffer.from('{"a":1}'),
    secret = "a-test-secret";
  const sig =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  assert.ok(verifySignature(raw, sig, secret));
  assert.equal(verifySignature(Buffer.from('{"a":2}'), sig, secret), false);
  assert.equal(verifySignature(raw, "bad", secret), false);
});
test(
  "API authentication, tenant RBAC, onboarding, inventory race and webhook dedupe",
  { skip: !url },
  async () => {
    if (
      !new URL(url!).pathname.endsWith("_test") ||
      !process.env.COMMERCE_REDIS_TEST_URL
    )
      throw new Error("Isolated test databases required");
    process.env.COMMERCE_DATABASE_URL = url;
    process.env.COMMERCE_REDIS_URL = process.env.COMMERCE_REDIS_TEST_URL;
    process.env.NODE_ENV = "test";
    process.env.LOG_LEVEL = "silent";
    process.env.INSTAGRAM_APP_SECRET = "test-secret-at-least-16";
    process.env.INSTAGRAM_VERIFY_TOKEN = "verify-token-at-least-16";
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const store = app.get(Store);
    try {
      const request = async (
        method: "GET" | "POST" | "DELETE" | "PUT",
        path: string,
        payload?: object,
        token?: string,
        key?: string,
      ) => {
        const res = await server.inject({
          method,
          url: path,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(key ? { "idempotency-key": key } : {}),
          },
          ...(payload ? { payload } : {}),
        });
        return {
          status: res.statusCode,
          body: res.json(),
          headers: res.headers,
        };
      };
      const register = () =>
        request("POST", "/v1/identity/register", {
          email: `${randomUUID()}@test.invalid`,
          password: "strong-test-password",
        });
      assert.equal((await request("GET", "/health/ready")).status, 200);
      const spec = await request("GET", "/openapi.json");
      assert.equal(spec.status, 200);
      assert.ok(spec.body.paths["/v1/identity/register"]);
      assert.equal((await request("GET", "/v1/organizations")).status, 401);
      const first = await register(),
        second = await register();
      assert.equal(first.status, 201);
      const token = first.body.token,
        other = second.body.token;
      const orgInput = { name: "Test shop", slug: randomUUID() };
      const org = await request(
        "POST",
        "/v1/organizations",
        orgInput,
        token,
        "org-key-123",
      );
      assert.equal(org.status, 201);
      const id = org.body.id;
      const repeated = await request(
        "POST",
        "/v1/organizations",
        orgInput,
        token,
        "org-key-123",
      );
      assert.equal(repeated.body.id, id);
      assert.equal(
        (
          await request(
            "POST",
            "/v1/organizations",
            { ...orgInput, name: "Different" },
            token,
            "org-key-123",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "GET",
            `/v1/organizations/${id}/products`,
            undefined,
            other,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/v1/organizations/${id}/merchant`,
            { displayName: "Shop" },
            token,
            "merchant-key",
          )
        ).status,
        201,
      );
      const prod = await request(
        "POST",
        `/v1/organizations/${id}/products`,
        { title: "Shoe", variants: [{ sku: "shoe-1", priceMinor: "10000" }] },
        token,
        "product-key",
      );
      assert.equal(prod.status, 201);
      const variantId = prod.body.variants[0].id;
      const path = `/v1/organizations/${id}/inventory/movements`;
      assert.equal(
        (
          await request(
            "POST",
            path,
            { variantId, kind: "receive", quantity: 5 },
            token,
            "receive-key",
          )
        ).status,
        201,
      );
      const [one, two] = await Promise.all([
        request(
          "POST",
          path,
          { variantId, kind: "reserve", quantity: 4 },
          token,
          "reserve-key-1",
        ),
        request(
          "POST",
          path,
          { variantId, kind: "reserve", quantity: 4 },
          token,
          "reserve-key-2",
        ),
      ]);
      assert.deepEqual([one.status, two.status].sort(), [201, 409]);
      assert.equal(
        (
          await request(
            "PUT",
            `/v1/organizations/${id}/members/${second.body.user.id}`,
            { role: "viewer" },
            token,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "PUT",
            `/v1/organizations/${id}/members/${first.body.user.id}`,
            { role: "viewer" },
            token,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "DELETE",
            `/v1/organizations/${id}/members/${first.body.user.id}`,
            undefined,
            token,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "PUT",
            `/v1/organizations/${id}/members/${second.body.user.id}`,
            { role: "admin" },
            other,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "GET",
            `/v1/organizations/${id}/inventory`,
            undefined,
            other,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "POST",
            path,
            { variantId, kind: "receive", quantity: 5 },
            other,
            "denied-key",
          )
        ).status,
        403,
      );
      assert.ok((await request("GET", "/health/live")).headers["x-request-id"]);
      const payload = JSON.stringify({
        object: "instagram",
        entry: [{ id: randomUUID() }],
      });
      const signature =
        "sha256=" +
        createHmac("sha256", process.env.INSTAGRAM_APP_SECRET!)
          .update(payload)
          .digest("hex");
      for (let i = 0; i < 2; i++) {
        const res = await server.inject({
          method: "POST",
          url: "/v1/instagram/webhook",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": signature,
          },
          payload,
        });
        assert.equal(res.statusCode, 200);
      }
      assert.equal(
        (
          await server.inject({
            method: "POST",
            url: "/v1/instagram/webhook",
            headers: { "content-type": "application/json" },
            payload,
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT count(*)::int AS n FROM commerce.instagram_inbox WHERE payload=$1::jsonb",
            [payload],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await request("DELETE", "/v1/identity/session", undefined, token))
          .status,
        200,
      );
      assert.equal(
        (await request("GET", "/v1/identity/me", undefined, token)).status,
        401,
      );
    } finally {
      await app.close();
    }
  },
);
