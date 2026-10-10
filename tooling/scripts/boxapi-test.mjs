import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export function verifyWebhook(raw, headers, secret, now = Date.now()) {
  const timestamp = headers["x-boxapi-timestamp"];
  const signature = headers["x-boxapi-signature"];
  if (
    !secret ||
    typeof timestamp !== "string" ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    typeof signature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export function createReceiver({ secret, accountId, onEvent = () => {} }) {
  if (!secret || !accountId)
    throw new Error("Webhook secret and test account ID required");
  const seen = new Map();
  return createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/boxapi/webhook") {
      res.writeHead(404).end();
      return;
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      if (!verifyWebhook(raw, req.headers, secret)) {
        res.writeHead(401).end();
        return;
      }
      const event = JSON.parse(raw.toString("utf8"));
      if (
        event.account_id !== accountId ||
        typeof event.event_id !== "string" ||
        !event.event_id ||
        typeof event.event_type !== "string"
      ) {
        res.writeHead(400).end();
        return;
      }
      const now = Date.now();
      for (const [id, time] of seen) if (now - time > 600_000) seen.delete(id);
      if (!seen.has(event.event_id)) {
        if (seen.size >= 10_000) {
          res.writeHead(503).end();
          return;
        }
        await onEvent(event);
        seen.set(event.event_id, now);
      }
      res
        .writeHead(200, { "content-type": "application/json" })
        .end('{"received":true}');
    } catch {
      if (!res.headersSent) res.writeHead(400).end();
    }
  });
}

async function main() {
  const command = process.argv[2];
  const accountId = process.env.BOXAPI_TEST_ACCOUNT_ID;
  if (!accountId)
    throw new Error(
      "Set BOXAPI_TEST_ACCOUNT_ID to the connected test page UUID",
    );
  if (command === "listen") {
    const server = createReceiver({
      secret: process.env.BOXAPI_WEBHOOK_SECRET,
      accountId,
      // Never print message content, sender identifiers, tokens, or full responses.
      onEvent: (event) =>
        console.log(
          JSON.stringify({ event_type: event.event_type, received: true }),
        ),
    });
    server.listen(4199, "127.0.0.1", () =>
      console.log("Test receiver: http://127.0.0.1:4199/boxapi/webhook"),
    );
    return;
  }
  if (!["posts", "reply"].includes(command))
    throw new Error("Usage: boxapi-test.mjs listen|posts|reply");
  const base = new URL(process.env.BOXAPI_BASE_URL || "");
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error(
      "BOXAPI_BASE_URL must be the HTTPS service URL shown in your BoxAPI panel",
    );
  const key = process.env.BOXAPI_API_KEY;
  if (!key) throw new Error("Set BOXAPI_API_KEY");
  const body =
    command === "posts"
      ? {
          account_id: accountId,
          fields: [
            "id",
            "media_type",
            "media_url",
            "permalink",
            "caption",
            "timestamp",
          ],
          limit: 1,
        }
      : {
          account_id: accountId,
          recipient_id: process.env.BOXAPI_TEST_RECIPIENT_ID,
          message: "پیام آزمایشی Paymoon؛ دریافت شد.",
        };
  if (
    command === "reply" &&
    (!/^\d+$/.test(body.recipient_id || "") ||
      process.env.BOXAPI_SEND_TEST_REPLY !== "true")
  )
    throw new Error(
      "Set the test sender ID and BOXAPI_SEND_TEST_REPLY=true to send the fixed test reply",
    );
  const url = new URL(
    base.href.replace(/\/$/, "") +
      "/service/actions/" +
      (command === "posts" ? "list_posts" : "send_message"),
  );
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json", "X-Api-Key": key },
    body: JSON.stringify(body),
  });
  console.log(
    JSON.stringify({ action: command, http_status: response.status }),
  );
  if (!response.ok)
    throw new Error(
      "BoxAPI rejected the action; inspect the provider panel logs",
    );
  console.log(
    "Request accepted; verify the final result in the signed webhook / test Instagram account.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
