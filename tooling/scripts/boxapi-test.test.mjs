import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createReceiver, verifyWebhook } from "./boxapi-test.mjs";

const secret = "local-test-secret";
function headers(raw, timestamp = String(Math.floor(Date.now() / 1000))) {
  return {
    "x-boxapi-timestamp": timestamp,
    "x-boxapi-signature":
      "sha256=" +
      createHmac("sha256", secret)
        .update(timestamp + ".")
        .update(raw)
        .digest("hex"),
  };
}
test("signature authenticates raw Persian JSON and rejects tampering, expiry and missing headers", () => {
  const raw = Buffer.from('{"text":"سلام"}');
  assert.equal(verifyWebhook(raw, headers(raw), secret), true);
  assert.equal(verifyWebhook(Buffer.from("{}"), headers(raw), secret), false);
  assert.equal(verifyWebhook(raw, headers(raw, "1"), secret), false);
  assert.equal(verifyWebhook(raw, {}, secret), false);
  assert.equal(verifyWebhook(raw, headers(raw), "wrong"), false);
});
test("receiver rejects wrong accounts and unsigned requests; retries run once", async (t) => {
  let received = 0;
  const server = createReceiver({
    secret,
    accountId: "test-account",
    onEvent: () => {
      received++;
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/boxapi/webhook`;
  const raw = Buffer.from(
    JSON.stringify({
      account_id: "test-account",
      event_id: "event-1",
      event_type: "messaging",
      data: {},
    }),
  );
  const send = (body, signed = true) =>
    fetch(url, { method: "POST", headers: signed ? headers(body) : {}, body });
  assert.equal((await send(raw, false)).status, 401);
  assert.equal((await send(raw)).status, 200);
  assert.equal((await send(raw)).status, 200);
  assert.equal(received, 1);
  const wrong = Buffer.from(
    JSON.stringify({
      account_id: "other",
      event_id: "event-2",
      event_type: "messaging",
    }),
  );
  assert.equal((await send(wrong)).status, 400);
  assert.equal(received, 1);
});
