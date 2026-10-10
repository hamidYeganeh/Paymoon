import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyBoxApiSignature,
  BoxApiTestController,
} from "./modules/instagram/boxapi-test.controller";
import type { Store } from "./platform";
import type { FastifyRequest } from "fastify";
import type { RawBodyRequest } from "@nestjs/common";

test("BoxAPI authenticates exact bytes and timestamp, rejects altered and expired events", () => {
  const raw = Buffer.from('{"text":"سلام"}');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = "a-test-secret-of-32-characters";
  const signature =
    "sha256=" +
    createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest("hex");
  assert.ok(verifyBoxApiSignature(raw, timestamp, signature, secret));
  assert.equal(
    verifyBoxApiSignature(Buffer.from("{}"), timestamp, signature, secret),
    false,
  );
  assert.equal(
    verifyBoxApiSignature(
      raw,
      timestamp,
      signature,
      secret,
      Date.now() + 301_000,
    ),
    false,
  );
  assert.equal(verifyBoxApiSignature(raw, undefined, signature, secret), false);
});

test("test receiver fails closed and rejects a signed event from another account", async () => {
  const disabled = new BoxApiTestController({ config: {} } as Store);
  await assert.rejects(
    () => disabled.receive({} as RawBodyRequest<FastifyRequest>),
    /disabled/,
  );
  const secret = "a-test-secret-of-32-characters";
  const body = {
    account_id: "00000000-0000-4000-8000-000000000001",
    event_id: "1",
    event_type: "messaging",
    data: {},
  };
  const rawBody = Buffer.from(JSON.stringify(body));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const controller = new BoxApiTestController({
    config: {
      BOXAPI_WEBHOOK_SECRET: secret,
      BOXAPI_TEST_ACCOUNT_ID: "00000000-0000-4000-8000-000000000002",
      BOXAPI_TEST_STATUS_TOKEN: "test-status-token-of-32-characters",
      BOXAPI_TEST_EXPIRES_AT: new Date(Date.now() + 60_000).toISOString(),
    },
  } as Store);
  await assert.rejects(
    () =>
      controller.receive({
        rawBody,
        body,
        headers: {
          "x-boxapi-timestamp": timestamp,
          "x-boxapi-signature":
            "sha256=" +
            createHmac("sha256", secret)
              .update(timestamp + ".")
              .update(rawBody)
              .digest("hex"),
        },
      } as unknown as RawBodyRequest<FastifyRequest>),
    /Unauthorized/,
  );
});
