# Product: Paymoon

Last updated: 2026-10-06. Method: repository scan and user-defined product scope in this conversation.

## Product Identity

Sellers turn their own Instagram posts into priced, stocked products; customers discover them and complete an order. Hybrid B2B/B2C social commerce with seller team collaboration and individual shopping.

## Business Model

Planned SaaS, marketplace and transaction fees in the supplied proposal. This release has no subscription pricing tiers or billing integration; no fees are collected.

## Tech Stack

TypeScript, Next.js, Capacitor, Nest/Fastify, PostgreSQL/Drizzle, Redis/BullMQ, Fetch. Modular backend domains and shared pnpm packages.

## Value Mapping

Primary value: a fulfilled purchase. Core: authorized media import into drafts, product publishing, stock-controlled checkout, fulfillment. Supporting: identity, moderation, team access, addresses, notifications, support.

## Entity Model

Users use stable UUIDs. Owners/admin/staff/viewers join multiple organizations; buyers need no organization. Accounts are organizations with UUIDs, one merchant profile each. Platform admin is an explicit environment allowlist.

## Group Hierarchy

Organization is the only analytics group. Seller events use their authorized organization; buyer events attach to the ordered organization after validation. Products and orders are properties, not groups. Platform moderation is outside engagement scoring.

## Current State

Backend outcome events persist transactionally. No external SDK, tracking cookies or generic clicks/pageviews. Tracking-plan.yaml covers committed value actions.

## Integration Targets

Local PostgreSQL is the only destination. Admin consumes grouped counts. Accoil, Segment, PostHog and other external transmission are not enabled.

## Codebase Observations

Catalog, inventory, orders, merchant moderation, Instagram, notifications and support; UUID identity/session/membership or buyer ownership determine attribution.
