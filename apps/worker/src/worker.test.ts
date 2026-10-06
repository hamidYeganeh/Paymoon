import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { database, transaction } from "@paymoon/db";
import { emit, QUEUE } from "@paymoon/events";
import { redisConnection } from "@paymoon/config";
import { Queue } from "bullmq";
const url = process.env.COMMERCE_DATABASE_TEST_URL,
  redis = process.env.COMMERCE_REDIS_TEST_URL;
test(
  "worker publishes committed outbox and consumes duplicate delivery once",
  { skip: !url || !redis, timeout: 30000 },
  async () => {
    if (!new URL(url!).pathname.endsWith("_test"))
      throw new Error("Isolated test database required");
    const { pool } = database(url!);
    const queue = new Queue(QUEUE, { connection: redisConnection(redis!) });
    const child = spawn(process.execPath, [join(__dirname, "main.js")], {
      env: {
        ...process.env,
        COMMERCE_DATABASE_URL: url,
        COMMERCE_REDIS_URL: redis,
        COMMERCE_WORKER_PORT: "14901",
        LOG_LEVEL: "silent",
      },
      stdio: "ignore",
    });
    const exited = once(child, "exit");
    try {
      const org = (
        await pool.query(
          "INSERT INTO commerce.organizations(name,slug) VALUES($1,$2) RETURNING id",
          ["Worker test", randomUUID()],
        )
      ).rows[0].id;
      await transaction(pool, (c) =>
        emit(c, "merchant.created", { organizationId: org }),
      );
      const event = (
        await pool.query(
          "SELECT id FROM commerce.outbox WHERE payload->>'organizationId'=$1",
          [org],
        )
      ).rows[0].id;
      let processed = false;
      for (let i = 0; i < 80; i++) {
        if (child.exitCode !== null)
          throw new Error("Worker exited unexpectedly");
        const row = (
          await pool.query(
            "SELECT processed_at FROM commerce.outbox WHERE id=$1",
            [event],
          )
        ).rows[0];
        if (row.processed_at) {
          processed = true;
          break;
        }
        await delay(100);
      }
      assert.ok(processed, "outbox was processed");
      const repeat = await queue.add(
        "merchant.created",
        { eventId: event },
        { jobId: randomUUID() },
      );
      let completed = false;
      for (let i = 0; i < 60; i++) {
        if ((await repeat.getState()) === "completed") {
          completed = true;
          break;
        }
        await delay(100);
      }
      assert.ok(completed, "duplicate delivery completed");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM commerce.notifications WHERE event_id=$1",
            [event],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      child.kill("SIGTERM");
      await exited;
      await queue.close();
      await pool.end();
    }
  },
);
