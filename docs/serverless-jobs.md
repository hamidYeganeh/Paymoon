# Background work on Vercel

Set `COMMERCE_BACKGROUND_MODE=request` and a random server-only `CRON_SECRET` (32+ characters). Vercel calls `GET /internal/maintenance` with its bearer secret daily at 03:00 UTC; Hobby scheduling has hour-level precision. Normal `/v1/` requests also await a bounded batch, throttled to once per five seconds per instance. Work is committed before the invocation ends. No permanent timer or BullMQ consumer runs in the API Function.

PostgreSQL is the durable source of work. Migration `0007_background_jobs.sql` adds indexes for pending scans. Daily cleanup removes up to 500 processed raw inbox items older than 30 days (including their deliveries), expired OAuth state/tickets and analytics older than 90 days. One batch expires up to 25 orders, routes up to 25 Instagram inbox items and delivers up to 50 known outbox events as in-app notifications. Row/advisory locks and event deduplication protect concurrent requests, cron and BullMQ retries. A failure rolls back for the next attempt. Unknown event topics remain unprocessed for a future handler. External email/push delivery is not implemented.

No traffic means daily cleanup only; there is no precise 30-minute timer on Hobby. Expired payments are rejected by the payment operation even before cleanup. For timely processing independent of traffic, deploy the existing BullMQ worker on a long-lived host and set the API mode back to `worker`. Both consumers use the same event handler.

The endpoint returns counts, never tenant payloads, and rejects missing/wrong secrets. Cron is excluded from public OpenAPI and responses are not cached. Monitor cron failures and backlog; one batch does not promise to clear an arbitrary backlog. See https://vercel.com/docs/cron-jobs/usage-and-pricing .
