# Paymoon testable product slice

Problem: Instagram sellers repeat product, inventory, payment and shipping work in direct messages; buyers cannot place a structured, trackable order.

Seller success: create a shop, receive permission to import the seller's own professional-account media, convert to drafts, confirm product details/price/stock, publish and fulfill a paid order. Buyer success: discover a published product, choose a variant, checkout with server-owned totals, track delivery and confirm receipt. Platform operations: approve shops and respond to support requests with explicit administrator authorization.

Acceptance criteria: unauthorized tenants cannot mutate or see another seller's data; buyers cannot read or pay another buyer's order; replayed checkout creates one order; simultaneous checkout cannot oversell; unpaid expiry restores stock; sandbox payment creates one balanced journal; published products have positive prices/images and approved merchants; imported posts never fabricate prices; Meta tokens stay encrypted on the server; failed/empty states remain actionable in clients.

Out of this test slice: real money collection/settlement/escrow, automated refunds/disputes, OTP/password recovery, third-party message sending, full Instagram messaging inbox, arbitrary-image search, AI caption inference and public deployment. These are explicit release boundaries, not hidden success mocks.
