import { context } from "@paymoon/observability";
import { createHash } from "node:crypto";
import { type PoolClient } from "@paymoon/db";
import type { Queue } from "bullmq";
export const QUEUE = "commerce-events";
export async function emit(
  c: PoolClient,
  topic: string,
  payload: Record<string, unknown>,
  traceparent?: string,
) {
  await c.query(
    "INSERT INTO commerce.outbox(topic,payload,traceparent) VALUES($1,$2,$3)",
    [
      topic,
      JSON.stringify(payload),
      traceparent ?? context.getStore()?.traceparent ?? null,
    ],
  );
}
export class IdempotencyConflict extends Error {}
export async function idempotent<T>(
  c: PoolClient,
  scope: string,
  key: string,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key))
    throw new IdempotencyConflict(
      "Idempotency-Key must be 8-128 letters, digits, _ or -",
    );
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    JSON.stringify([scope, key]),
  ]);
  const existing = await c.query(
    "SELECT hash,response FROM commerce.idempotency WHERE scope=$1 AND key=$2",
    [scope, key],
  );
  if (existing.rowCount) {
    if (existing.rows[0].hash !== hash)
      throw new IdempotencyConflict("Key already used with a different body");
    return existing.rows[0].response as T;
  }
  const response = await fn();
  await c.query(
    "INSERT INTO commerce.idempotency(scope,key,hash,response) VALUES($1,$2,$3,$4)",
    [scope, key, hash, JSON.stringify(response)],
  );
  return response;
}
// Caller owns the transaction. A crash after enqueue can redeliver: consumers must dedupe in PostgreSQL.
export async function publishBatch(c: PoolClient, queue: Queue) {
  const rows = await c.query(
    "SELECT id,topic,traceparent FROM commerce.outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED",
  );
  for (const e of rows.rows) {
    await queue.add(
      e.topic,
      { eventId: e.id, traceparent: e.traceparent },
      {
        jobId: e.id,
        attempts: 8,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    );
    await c.query("UPDATE commerce.outbox SET published_at=now() WHERE id=$1", [
      e.id,
    ]);
  }
  return rows.rowCount;
}

// Webhook ingestion is independent of notification delivery. Unknown account IDs never select a tenant.
export async function routeInstagramInbox(c: PoolClient) {
  const rows = await c.query(
    "SELECT id,payload FROM commerce.instagram_inbox WHERE status='received' ORDER BY created_at LIMIT 25 FOR UPDATE SKIP LOCKED",
  );
  for (const row of rows.rows) {
    const entries = Array.isArray(row.payload?.entry) ? row.payload.entry : [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (typeof entry?.id !== "string") continue;
      const connection = (
        await c.query(
          "SELECT organization_id FROM commerce.instagram_connections WHERE account_id=$1 FOR SHARE",
          [entry.id],
        )
      ).rows[0];
      if (!connection) continue;
      const inserted = await c.query(
        "INSERT INTO commerce.instagram_deliveries(inbox_id,organization_id,entry_index,payload) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING inbox_id",
        [row.id, connection.organization_id, index, JSON.stringify(entry)],
      );
      if (inserted.rowCount)
        await emit(c, "instagram.webhook.received", {
          organizationId: connection.organization_id,
          inboxId: row.id,
          entryIndex: index,
        });
    }
    await c.query(
      "UPDATE commerce.instagram_inbox SET status='processed' WHERE id=$1",
      [row.id],
    );
  }
  return rows.rowCount;
}

export async function expireOrders(c: PoolClient) {
  const expired = (
    await c.query(
      "SELECT id,organization_id,buyer_id FROM commerce.orders WHERE status='pending_payment' AND expires_at<now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 25",
    )
  ).rows;
  for (const o of expired) {
    const items = (
      await c.query(
        "SELECT variant_id,quantity FROM commerce.order_items WHERE order_id=$1 ORDER BY variant_id",
        [o.id],
      )
    ).rows;
    for (const item of items) {
      const updated = await c.query(
        "UPDATE commerce.inventory SET available=available+$2,reserved=reserved-$2 WHERE variant_id=$1 AND reserved>=$2",
        [item.variant_id, item.quantity],
      );
      if (!updated.rowCount)
        throw new Error("Order stock reservation invariant failed");
      await c.query(
        "INSERT INTO commerce.stock_movements(variant_id,kind,quantity,actor_id) VALUES($1,'release',$2,$3)",
        [item.variant_id, item.quantity, o.buyer_id],
      );
    }
    await c.query(
      "UPDATE commerce.orders SET status='cancelled',version=version+1,updated_at=now() WHERE id=$1",
      [o.id],
    );
    await c.query(
      "INSERT INTO commerce.user_notifications(user_id,order_id,kind) VALUES($1,$2,'order.cancelled')",
      [o.buyer_id, o.id],
    );
    await emit(c, "order.transitioned", {
      organizationId: o.organization_id,
      orderId: o.id,
      status: "cancelled",
    });
  }
  return expired.length;
}
