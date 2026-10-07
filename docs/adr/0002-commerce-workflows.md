# ADR 0002: Stock-controlled social-commerce workflows

Status: accepted. Date: 2026-10-07.

Keep the local pnpm/Turbo modular backend and Next/Capacitor clients. Shared product views live alongside the UI kit, public response types in contracts; clients never import database or backend modules. Base44 cloud provisioning is not required by the user's chosen architecture.

One checkout contains one merchant. The server re-reads published products, approved merchant, prices and stock; it snapshots item and address data, reserves stock and writes the event within one transaction. Lock products, merchants, variants in deterministic order, then stock. Payment commits reserved stock; shipping removes committed stock. Expiry/cancellation releases reserved stock. No user-facing API can manually reserve/commit/ship stock outside the order workflow.

Web authentication uses HttpOnly same-site cookies with an Origin and custom-header check on cookie-based mutations. Native bearer tokens use the Android encrypted secure-storage plugin; its web fallback is never invoked. Meta OAuth uses a one-time launch ticket for the system browser, browser-bound state and revalidation of membership/session. No bearer or Meta token is carried in the launch URL.

Imported media becomes a draft with zero price/stock. Seller confirmation is required. Image persistence accepts only official Meta CDN hosts, rejects redirects, caps reads at 5 MB and 10 seconds and checks image signatures. Local public media needs persistent volume/backup before production; external object storage is a subsequent deployment decision.

Real payments remain disabled until a verified provider is implemented. Sandbox payments are explicitly labeled, prohibited in production and record balanced double entries. They do not constitute real merchant revenue or buyer protection.
