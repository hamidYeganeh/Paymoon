import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  MetaInstagramAdapter,
  MetaApiError,
} from "./modules/instagram/meta.adapter";
import { encryptToken, decryptToken } from "./modules/instagram/token-vault";
import { InstagramService } from "./modules/instagram/instagram.service";
import { createApp } from "./app";
import { Store } from "./platform";
const config = {
  appId: "123",
  appSecret: "test-secret-123456",
  redirectUri: "https://api.example.test/v1/instagram/oauth/callback",
  version: "v25.0",
  scopes: ["instagram_business_basic"],
};
function fixture() {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const accessToken = "provider-secret-token";
  const accountId =
    String(Date.now()) + String(Math.floor(Math.random() * 1000));
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    let body: unknown;
    if (url.hostname === "api.instagram.com") {
      assert.equal(init?.method, "POST");
      assert.ok(String(init?.body).includes("grant_type=authorization_code"));
      body = {
        access_token: "short-secret",
        permissions: ["instagram_business_basic"],
      };
    } else if (url.pathname === "/access_token")
      body = { access_token: accessToken, expires_in: 5184000 };
    else if (url.pathname === "/refresh_access_token")
      body = { access_token: "refreshed-secret", expires_in: 5184000 };
    else if (url.pathname.endsWith("/me"))
      body = { user_id: accountId, username: "test_shop" };
    else if (url.pathname.endsWith("/media"))
      body = {
        data: [
          {
            id: "123456789",
            caption: "A product",
            media_type: "IMAGE",
            media_url: "https://cdn.example.test/image.jpg",
          },
        ],
        paging: {
          cursors: { after: "next-cursor" },
          next: "https://malicious.example/steal?access_token=secret",
        },
      };
    else body = { success: true };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    adapter: new MetaInstagramAdapter(config, transport),
    requests,
    accessToken,
    accountId,
  };
}
test("Meta adapter uses official hosts, OAuth form, minimal scopes and cursor-only pagination", async () => {
  const f = fixture();
  const auth = new URL(f.adapter.authorizationUrl("state"));
  assert.equal(auth.origin, "https://www.instagram.com");
  assert.equal(auth.searchParams.get("scope"), "instagram_business_basic");
  assert.equal(auth.searchParams.get("client_secret"), null);
  const connected = await f.adapter.exchangeCode("code");
  assert.equal(connected.accountId, f.accountId);
  const page = await f.adapter.listMedia(f.accountId, connected.accessToken);
  assert.equal(page.after, "next-cursor");
  await f.adapter.listMedia(f.accountId, connected.accessToken, page.after);
  assert.ok(
    f.requests.every((r) =>
      ["graph.instagram.com", "api.instagram.com"].includes(r.url.hostname),
    ),
  );
  assert.ok(f.requests.every((r) => r.init?.redirect === "error"));
  const last = f.requests.at(-1)!;
  assert.equal(last.url.searchParams.get("after"), "next-cursor");
  assert.equal(last.url.searchParams.get("access_token"), null);
  assert.equal(
    (last.init?.headers as Record<string, string>).Authorization,
    "Bearer " + f.accessToken,
  );
});
test("Meta errors never expose provider message or credentials", async () => {
  const adapter = new MetaInstagramAdapter(
    config,
    async () =>
      new Response(
        JSON.stringify({
          error: { code: 190, message: "secret-token-in-provider-error" },
        }),
        { status: 400 },
      ),
  );
  await assert.rejects(
    () => adapter.refresh("secret"),
    (e) =>
      e instanceof MetaApiError &&
      e.code === 190 &&
      !e.message.includes("secret-token"),
  );
});
test("encrypted tokens are tenant-bound and reject tampering", () => {
  const key = randomBytes(32).toString("hex");
  const value = encryptToken("secret", key, "org-a");
  assert.ok(!value.includes("secret"));
  assert.equal(decryptToken(value, key, "org-a"), "secret");
  assert.throws(() => decryptToken(value, key, "org-b"));
  assert.throws(() => decryptToken(value.replace("v1.", "v2."), key, "org-a"));
});
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test(
  "OAuth state is browser-bound, single-use and role-bound; tokens never leave API",
  { skip: !url },
  async () => {
    if (
      !new URL(url!).pathname.endsWith("_test") ||
      !process.env.COMMERCE_REDIS_TEST_URL
    )
      throw new Error("Isolated test DBs required");
    Object.assign(process.env, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      COMMERCE_DATABASE_URL: url,
      COMMERCE_REDIS_URL: process.env.COMMERCE_REDIS_TEST_URL,
      INSTAGRAM_APP_ID: config.appId,
      INSTAGRAM_APP_SECRET: config.appSecret,
      INSTAGRAM_REDIRECT_URI: config.redirectUri,
      INSTAGRAM_API_VERSION: config.version,
      INSTAGRAM_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    });
    const app = await createApp(),
      server = app.getHttpAdapter().getInstance(),
      store = app.get(Store),
      f = fixture();
    app.get(InstagramService).adapter = () => f.adapter;
    const ip = "127.0.0." + (10 + Math.floor(Math.random() * 200));
    const request = async (
      method: "GET" | "POST" | "DELETE",
      path: string,
      headers: Record<string, string> = {},
      payload?: object,
    ) =>
      server.inject({
        method,
        url: path,
        headers,
        remoteAddress: ip,
        ...(payload ? { payload } : {}),
      });
    try {
      const user = (
        await request(
          "POST",
          "/v1/identity/register",
          {},
          {
            email: randomUUID() + "@test.invalid",
            password: "strong-test-password",
          },
        )
      ).json();
      const auth = { authorization: "Bearer " + user.token };
      const org = (
        await request(
          "POST",
          "/v1/organizations",
          { ...auth, "idempotency-key": randomUUID() },
          { name: "Instagram shop", slug: randomUUID() },
        )
      ).json().id;
      const base = `/v1/organizations/${org}/instagram`;
      const begin = await request("POST", base + "/authorize", auth);
      assert.equal(begin.statusCode, 201);
      const state = new URL(begin.json().authorizationUrl).searchParams.get(
        "state",
      );
      const cookie = String(begin.headers["set-cookie"]).split(";")[0]!;
      const path =
        "/v1/instagram/oauth/callback?state=" + state + "&code=test-code";
      assert.equal((await request("GET", path)).statusCode, 403);
      const callback = await request("GET", path, { cookie });
      assert.equal(callback.statusCode, 200);
      assert.equal(callback.json().connected, true);
      assert.ok(!callback.body.includes(f.accessToken));
      assert.equal((await request("GET", path, { cookie })).statusCode, 403);
      const stored = (
        await store.db.pool.query(
          "SELECT * FROM commerce.instagram_connections WHERE organization_id=$1",
          [org],
        )
      ).rows[0];
      assert.ok(!stored.token_ciphertext.includes(f.accessToken));
      assert.equal(
        (await request("POST", base + "/media/sync", auth, {})).statusCode,
        201,
      );
      const media = await request("GET", base + "/media", auth);
      assert.equal(media.json().length, 1);
      assert.equal(
        (await request("POST", base + "/refresh", auth)).statusCode,
        409,
      );
      assert.equal(
        (
          await request("POST", base + "/subscriptions", auth, {
            fields: ["messages"],
          })
        ).statusCode,
        409,
      );
      const status = await request("GET", base, auth);
      assert.ok(!status.body.includes("ciphertext"));
      assert.ok(!status.body.includes(f.accessToken));
      const stale = await request("POST", base + "/authorize", auth);
      const staleState = new URL(
        stale.json().authorizationUrl,
      ).searchParams.get("state");
      const staleCookie = String(stale.headers["set-cookie"]).split(";")[0]!;
      await store.db.pool.query(
        "UPDATE commerce.memberships SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
        [org, user.user.id],
      );
      assert.equal(
        (
          await request(
            "GET",
            "/v1/instagram/oauth/callback?state=" + staleState + "&code=x",
            { cookie: staleCookie },
          )
        ).statusCode,
        403,
      );
      await store.db.pool.query(
        "UPDATE commerce.memberships SET role='owner' WHERE organization_id=$1 AND user_id=$2",
        [org, user.user.id],
      );
      assert.equal((await request("DELETE", base, auth)).statusCode, 200);
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT * FROM commerce.instagram_media WHERE organization_id=$1",
            [org],
          )
        ).rowCount,
        0,
      );
    } finally {
      await app.close();
    }
  },
);
