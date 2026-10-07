import { test } from "node:test";
import assert from "node:assert/strict";
import { can, hashPassword, verifyPassword } from "@paymoon/auth";
import { assertBalanced, money } from "@paymoon/money";
import {
  assertOrderTransition,
  moveStock,
  productInput,
} from "@paymoon/validation";
import { readConfig } from "@paymoon/config";
import { traceContext } from "@paymoon/observability";
test("password hashing rejects a wrong password and missing identity", async () => {
  const hash = await hashPassword("long-enough-password");
  assert.ok(await verifyPassword("long-enough-password", hash));
  assert.equal(await verifyPassword("different-password", hash), false);
  assert.equal(await verifyPassword("long-enough-password", undefined), false);
});
test("RBAC prevents viewers writing and staff managing the organization", () => {
  assert.equal(can("viewer", "inventory:write"), false);
  assert.equal(can("staff", "organization:manage"), false);
  assert.equal(can("owner", "organization:manage"), true);
});
test("inventory reserve, commit and ship conserve stock and reject overselling", () => {
  let s = { available: 5, reserved: 0, committed: 0 };
  s = moveStock(s, "reserve", 3);
  assert.deepEqual(s, { available: 2, reserved: 3, committed: 0 });
  assert.throws(() => moveStock(s, "reserve", 3));
  s = moveStock(s, "release", 1);
  s = moveStock(s, "commit", 2);
  s = moveStock(s, "ship", 2);
  assert.deepEqual(s, { available: 3, reserved: 0, committed: 0 });
  assert.throws(() => moveStock(s, "receive", -1));
});
test("orders cannot bypass payment or return from cancellation", () => {
  assertOrderTransition("pending_payment", "paid");
  assert.throws(() => assertOrderTransition("draft", "paid"));
  assert.throws(() => assertOrderTransition("cancelled", "paid"));
});
test("ledger rejects mixed-sided and unbalanced postings; money is integer IRR", () => {
  assertBalanced([
    { accountId: "a", debit: 100n, credit: 0n },
    { accountId: "b", debit: 0n, credit: 100n },
  ]);
  assert.throws(() =>
    assertBalanced([
      { accountId: "a", debit: 99n, credit: 0n },
      { accountId: "b", debit: 0n, credit: 100n },
    ]),
  );
  assert.throws(() =>
    assertBalanced([{ accountId: "a", debit: 1n, credit: 1n }]),
  );
  assert.equal(money("9007199254740993").amountMinor, 9007199254740993n);
  assert.throws(() => money("1.5"));
});
test("environment fails closed and product prices use strings", () => {
  assert.throws(() => readConfig({}));
  assert.throws(() =>
    productInput.parse({
      title: "shoe",
      variants: [{ sku: "x", priceMinor: 2.5 }],
    }),
  );
});
test("traceparent validates input and creates a new span", () => {
  const a = traceContext(),
    b = traceContext(a.traceparent);
  assert.equal(a.traceId, b.traceId);
  assert.notEqual(a.spanId, b.spanId);
  assert.notEqual(
    traceContext("00-" + "0".repeat(32) + "-" + "0".repeat(16) + "-01").traceId,
    "0".repeat(32),
  );
});

test("staging accepts provider env aliases, isolates sandbox, and production forbids it", () => {
  const env = {
    NODE_ENV: "production",
    COMMERCE_ENVIRONMENT: "staging",
    DATABASE_URL: "postgresql://test:test@db.example/paymoon_staging",
    REDIS_URL: "rediss://default:test@redis.example:6380",
    COMMERCE_API_PUBLIC_URL: "https://api.example.com",
    COMMERCE_PAYMENT_MODE: "sandbox",
  };
  const config = readConfig(env);
  assert.equal(config.COMMERCE_DATABASE_URL, env.DATABASE_URL);
  assert.equal(config.COMMERCE_ENVIRONMENT, "staging");
  assert.throws(() =>
    readConfig({ ...env, COMMERCE_ENVIRONMENT: "production" }),
  );
  assert.throws(() =>
    readConfig({
      ...env,
      DATABASE_URL: "postgresql://test:test@db.example/paymoon_production",
    }),
  );
  assert.throws(() =>
    readConfig({ ...env, REDIS_URL: "https://redis.example.com" }),
  );
  assert.throws(() => readConfig({ ...env, VERCEL: "1" }));
});
