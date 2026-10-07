-- Serverless and BullMQ consumers share a durable pending-work scan.
CREATE INDEX outbox_unprocessed ON commerce.outbox(created_at) WHERE processed_at IS NULL;
CREATE INDEX instagram_inbox_received ON commerce.instagram_inbox(created_at) WHERE status='received';
CREATE INDEX instagram_inbox_retention ON commerce.instagram_inbox(created_at) WHERE status='processed';
