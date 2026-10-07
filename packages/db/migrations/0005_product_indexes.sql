CREATE INDEX products_shop_status ON commerce.products(organization_id,status,created_at DESC);
CREATE INDEX orders_buyer_time ON commerce.orders(buyer_id,created_at DESC);
CREATE INDEX orders_shop_time ON commerce.orders(organization_id,created_at DESC);
CREATE INDEX analytics_retention ON commerce.analytics_events(created_at);
CREATE INDEX support_user_time ON commerce.support_tickets(user_id,created_at DESC);
ALTER TABLE commerce.products ADD CONSTRAINT products_media_array CHECK(jsonb_typeof(media)='array');
