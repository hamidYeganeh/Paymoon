# Instrumentation

First-party PostgreSQL destination. Generic HTTP architecture and Accoil references reviewed; no external SDK/destination configured. Server-owned transactions replace browser ingestion. Worker deletes events older than 90 days.

identify(): IdentityService.actor(req) resolves validated session to stable user UUID. No email trait is copied. group(): OrganizationsService.require or buyer-owned order resolves explicit organization UUID; no unchecked browser analytics input or mutable current group. track(): persist commerce.analytics_events in the successful mutation transaction. Idempotency replay skips both mutation and event; failures roll back both.

```ts
await c.query(
  "INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'order.created',$3)",
  [actor.id, order.organization_id, JSON.stringify({ orderId: order.id })],
);
```

Use only tracking-plan.yaml names/property keys. No captions, URLs, contact details, addresses, access tokens or raw input. Admin aggregates counts. Sandbox payments do not represent revenue. Tests assert replayed checkout emits one event. Update the plan and guide with new outcomes.
