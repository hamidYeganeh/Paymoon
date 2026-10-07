import Redis from "ioredis";
import { createServer } from "node:http";
import { readConfig, redisConnection } from "@paymoon/config";
import { database, transaction } from "@paymoon/db";
import {
  publishBatch,
  QUEUE,
  routeInstagramInbox,
  expireOrders,
  consumeEvent,
  pruneTransientData,
} from "@paymoon/events";
import { createLogger } from "@paymoon/logger";
import { Queue, Worker } from "bullmq";
const config = readConfig(),
  logger = createLogger("commerce-worker", config.LOG_LEVEL);
const { pool } = database(config.COMMERCE_DATABASE_URL),
  connection = redisConnection(config.COMMERCE_REDIS_URL);
const redis = new Redis(config.COMMERCE_REDIS_URL, {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
});
const queue = new Queue(QUEUE, { connection });
const worker = new Worker(
  QUEUE,
  async (job) =>
    transaction(pool, async (c) => {
      const processed = await consumeEvent(c, job.data.eventId);
      if (processed)
        logger.info(
          { eventId: job.data.eventId, traceparent: job.data.traceparent },
          "event processed",
        );
    }),
  { connection, concurrency: 4 },
);
worker.on("failed", (job) =>
  logger.error({ jobId: job?.id }, "job failed; inspect retained failed queue"),
);
worker.on("error", () => logger.error("worker connection error"));
let stopping = false;
let active: Promise<unknown> | undefined;
let lastSuccess = 0;
let lastRetention = 0;
function poll() {
  if (stopping || active) return;
  active = transaction(pool, async (c) => {
    await expireOrders(c);
    if (Date.now() - lastRetention > 3600000) {
      await pruneTransientData(c);
      lastRetention = Date.now();
    }
    await routeInstagramInbox(c);
    return publishBatch(c, queue);
  })
    .then(() => {
      lastSuccess = Date.now();
    })
    .catch(() => logger.error("outbox publication failed; retrying"))
    .finally(() => {
      active = undefined;
    });
}
const timer = setInterval(poll, 1000);
poll();
const server = createServer((req, res) => {
  if (req.url === "/health/live") {
    res.end("ok");
    return;
  }
  if (req.url !== "/health/ready") {
    res.writeHead(404).end();
    return;
  }
  void Promise.all([pool.query("SELECT 1"), redis.ping()])
    .then(() => {
      res
        .writeHead(!stopping && Date.now() - lastSuccess < 15000 ? 200 : 503)
        .end();
    })
    .catch(() => res.writeHead(503).end());
});
server.listen(config.COMMERCE_WORKER_PORT, "127.0.0.1");
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  server.close();
  await active;
  await worker.close();
  await queue.close();
  await redis.quit();
  await pool.end();
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
