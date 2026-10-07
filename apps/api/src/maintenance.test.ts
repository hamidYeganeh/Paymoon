import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./platform";
import { transaction } from "@paymoon/db";
import { consumeEvent, maintenanceBatch } from "@paymoon/events";
const url = process.env.COMMERCE_DATABASE_TEST_URL;
test(
  "maintenance authenticates cron, skips overlapping work and deduplicates queue/request delivery",
  { skip: !url },
  async () => {
    if (
      !new URL(url!).pathname.endsWith("_test") ||
      !process.env.COMMERCE_REDIS_TEST_URL
    )
      throw new Error("Isolated test services required");
    Object.assign(process.env, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      COMMERCE_DATABASE_URL: url,
      COMMERCE_REDIS_URL: process.env.COMMERCE_REDIS_TEST_URL,
      COMMERCE_BACKGROUND_MODE: "request",
      CRON_SECRET: "maintenance-test-secret-at-least-32-characters",
    });
    const app = await createApp(),
      store = app.get(Store),
      server = app.getHttpAdapter().getInstance();
    try {
      for (const authorization of [
        undefined,
        "Bearer incorrect",
        "Bearer " + "x".repeat(44),
      ]) {
        assert.equal(
          (
            await server.inject({
              method: "GET",
              url: "/internal/maintenance",
              headers: authorization ? { authorization } : {},
            })
          ).statusCode,
          401,
        );
      }
      const org = (
        await store.db.pool.query(
          "INSERT INTO commerce.organizations(name,slug) VALUES('Maintenance test',$1) RETURNING id",
          [randomUUID()],
        )
      ).rows[0].id;
      const event = (
        await store.db.pool.query(
          "INSERT INTO commerce.outbox(topic,payload) VALUES('merchant.created',$1) RETURNING id",
          [JSON.stringify({ organizationId: org })],
        )
      ).rows[0].id;
      const holder = await store.db.pool.connect();
      try {
        await holder.query("BEGIN");
        await holder.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('paymoon-maintenance',0))",
        );
        assert.equal(
          (await transaction(store.db.pool, (c) => maintenanceBatch(c)))
            .skipped,
          true,
        );
      } finally {
        await holder.query("ROLLBACK");
        holder.release();
      }
      await Promise.all([
        transaction(store.db.pool, (c) => consumeEvent(c, event)),
        transaction(store.db.pool, (c) => maintenanceBatch(c)),
      ]);
      assert.equal(
        (
          await store.db.pool.query(
            "SELECT count(*)::int n FROM commerce.notifications WHERE event_id=$1",
            [event],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        await transaction(store.db.pool, (c) => consumeEvent(c, event)),
        false,
      );
      const cron = await server.inject({
        method: "GET",
        url: "/internal/maintenance",
        headers: { authorization: "Bearer " + store.config.CRON_SECRET },
      });
      assert.equal(cron.statusCode, 200);
      assert.equal(cron.headers["cache-control"], "no-store");
      assert.equal(cron.json().skipped, false);
      assert.equal(JSON.stringify(cron.json()).includes(org), false);
      const spec = await server.inject({ method: "GET", url: "/openapi.json" });
      assert.equal(spec.json().paths["/internal/maintenance"], undefined);
    } finally {
      await app.close();
    }
  },
);
