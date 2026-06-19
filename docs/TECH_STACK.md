# Rbabikerentals.com Tech Stack Decision (Phase 1)

## 1. Decision Summary
Phase 1 will ship as a single web application with role-segmented experiences (`customer`, `partner_investor`, `admin`) for Bengaluru operations using:
- Next.js (App Router) for web frontend and BFF-style API routes.
- Better Auth for authentication/session handling with role claims.
- Supabase (PostgreSQL + Storage + RLS) for core data, files, and access control.
- Razorpay for booking payments and security deposit collection workflows.
- Setu DigiLocker for Aadhaar + Driving Licence KYC.
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
- Storage bucket model fits KYC docs, vehicle docs, damage photos.
- RLS enables strict multi-tenant row-level isolation.

Usage:
- Postgres: users, vehicles, bookings, pricing rules, blocks, payouts, audits.
- Storage: KYC evidence references, vehicle compliance docs, incident media.
- RLS: role and ownership enforcement.

## 2.4 Payments: Razorpay
Why:
- India-first payment rails (UPI/cards/wallets).
- Fits booking checkout and deposit collection/reconciliation.
- Operationally standard for local rental workflows.

Phase 1 payments:
- Booking amount capture.
- Security deposit capture/hold-style operational flow (actual implementation depends on configured Razorpay pattern and legal/accounting setup).
- Refund support for cancellations and deposit return flows.

## 2.5 KYC: Setu DigiLocker Integration
Why:
- Faster integration path with clean REST APIs.
- Government-backed document retrieval and consent-first approach.
- Supports Aadhaar + DL retrieval/verification scenarios needed for onboarding.

Policy:
- Primary: DigiLocker-based Aadhaar + DL verification.
- Fallback: Admin manual review queue.
- CIBIL: captured as review signal only in Phase 1, not hard auto-block.

## 2.6 Notifications: Provider Abstraction
Why:
- Vendor lock-in avoidance.
- Uniform templating/event model for OTP, booking alerts, policy reminders.

Phase 1 events:
- OTP and KYC updates.
- Booking confirmation.
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
- KYC/PII fields encrypted at rest where applicable and access-restricted by role.
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
- Supabase Auth as primary auth: deferred because team preference is Better Auth.
- Direct DigiLocker integration first: deferred to reduce integration overhead and speed execution.
