# Rbabikerentals.com Tech Stack Decision (Phase 1)

## 1. Decision Summary
Phase 1 will ship as a single web application with role-segmented experiences (`customer`, `partner_investor`, `admin`) for Bengaluru operations using:
- Next.js (App Router) for web frontend and BFF-style API routes.
- Better Auth for authentication/session handling with role claims.
- Supabase (PostgreSQL + Storage + RLS) for core data, files, and access control.
- Razorpay for booking payments and security deposit collection workflows.
- No Aadhaar/DigiLocker provider is active; identity-document verification is paused pending required permissions.
- Notification provider abstraction for WhatsApp/SMS alerts.

## 2. Stack Components
## 2.1 Frontend: Next.js (App Router)
Why:
- Mature SSR/ISR patterns for SEO-friendly listing pages.
- Good fit for role-based route guards in one codebase.
- Native API routes support quick BFF integration pattern.

Phase 1 usage:
- Public marketing and policy pages.
- Authenticated dashboards for all 3 roles.
- Booking and checkout UI.
- Bengaluru-only location flows in Phase 1 (single-city mode).

## 2.2 Auth: Better Auth + RBAC Claims
Why:
- TypeScript-first auth model.
- Bring-your-own Postgres pattern aligns with Supabase Postgres.
- Flexible plugin and session model for multi-role app.

Auth strategy:
- Session-based auth with secure cookies.
- Role claim attached to session user profile (`customer`, `partner_investor`, `admin`).
- API authorization checks enforced server-side for all non-public endpoints.

## 2.3 Data + Storage: Supabase
Why:
- Managed Postgres with strong SQL modeling and easy migrations.
- Storage: vehicle compliance docs and incident media. Existing KYC records are retained only for historical compatibility.

Usage:
- Postgres: users, vehicles, bookings, pricing rules, blocks, payouts, audits.
- Storage: vehicle compliance docs and incident media. Historical KYC records remain in the database only for compatibility; active code has no access to them.
## 2.4 Payments: Razorpay
Why:
- India-first payment rails (UPI/cards/wallets).
- Fits booking checkout and deposit collection/reconciliation.
- Operationally standard for local rental workflows.

Phase 1 payments:
- Booking amount capture.
- Security deposit capture/hold-style operational flow (actual implementation depends on configured Razorpay pattern and legal/accounting setup).
- Refund support for cancellations and deposit return flows.

## 2.5 Identity verification: Paused
Automated Aadhaar/DigiLocker verification is disabled pending required permissions. Provider integration code and identity-facing UI/API routes are removed. Historical database records are retained; application runtime does not access or update them. Credit bureau checks remain unimplemented and non-blocking.

## 2.6 Notifications: Provider Abstraction
Why:
- Vendor lock-in avoidance.
- Uniform templating/event model for OTP, booking alerts, policy reminders.

Phase 1 events:
- Booking and account updates.
- Ride reminders.
- Cancellation/refund updates.
- Insurance/document expiry reminders.

## 3. Architecture Style
- Monorepo-friendly modular web app and API.
- BFF + domain service modules in the same deployment.
- Relational source of truth (Postgres) with explicit state transitions.
- Event-triggered notification dispatch from domain events.
- City-aware schema (`city_id`) retained for future expansion, seeded with Bengaluru only in Phase 1.

## 4. Security and Compliance Posture
- RLS enabled on all app-facing tables in exposed schema.
- Service role key only on trusted server-side paths.
- Restrict access to account PII and vehicle documents; legacy identity records are not used by active flows.
- Audit logging for admin and partner operational actions.
- Retention policy for sensitive documents with controlled lifecycle.

## 5. Performance and Reliability Notes
- Cache public listing pages and static policy content.
- Use indexed query paths for availability search and booking timeline views.
- Add idempotency keys for payment and booking-confirm endpoints.
- Queue outbound notifications and retry failures safely.

## 6. Phase 2 Candidates
1. Native mobile apps (React Native).
2. Dynamic surge pricing and demand-aware rules.
3. Loyalty, referral, and subscription plan engine.
4. Stronger automated risk scoring beyond manual-review fallback.

## 7. Alternatives Considered and Rejected (Phase 1)
- Separate frontend apps per role: rejected due to velocity and operational overhead.
- Direct DigiLocker integration is paused until permissions are obtained.
