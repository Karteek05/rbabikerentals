# Production Hardening Notes

Last updated: April 19, 2026

This document tracks the production-safety fixes that have already been implemented in the codebase, along with the next hardening steps for future development.

## Implemented In Code

### 1. Authentication and account bootstrap
- `better-auth` has been upgraded to `1.6.5`, and `npm audit` is clean after the dependency refresh.
- Better Auth now requires an explicit `BETTER_AUTH_SECRET` when `APP_ENV=production`.
- Development header auth is disabled by default in `.env.example`.
- Header-based auth is now allowed only when:
  - `APP_ENV` is not `production`
  - `ALLOW_DEV_HEADERS=true`
- First-time authenticated Better Auth users are bootstrapped into `app_users` automatically.
- Default KYC records are auto-created when a new user first touches KYC or booking flows.

### 2. Booking pricing integrity
- Booking creation no longer trusts client-supplied `duration_value`.
- Extension pricing no longer trusts client-supplied `duration_value`.
- The server now derives the billable duration from the actual booking window:
  - `hour` = multiples of 1 hour
  - `day` = multiples of 24 hours
  - `week` = multiples of 7 days
  - `month` = multiples of 30 days
- If the selected duration plan does not match the requested booking window, the API returns a `400 duration_window_mismatch`.

### 3. Payment order protection
- `POST /api/payments/order` now enforces booking ownership:
  - customer can create orders only for own bookings
  - admin can create orders for any booking
- The payment service now reuses an existing open payment order for a booking instead of creating duplicates on repeated requests.
- Database schema now adds a partial unique index to allow only one `created` payment order per booking.
- Admin refund support is wired through `POST /api/payments/refund` and stores Razorpay payment/refund identifiers for reconciliation.

### 4. KYC callback protection
- DigiLocker callback endpoint now requires `SETU_WEBHOOK_SECRET`.
- Missing webhook secret is treated as server misconfiguration.
- Invalid webhook secret is rejected with `401`.
- KYC status polling is now scoped to the authenticated user unless the actor is admin.
- KYC verification is no longer granted from boolean fields alone.
- Callback processing now requires provider status intent:
  - `failed` -> `failed`
  - `verified` + Aadhaar + DL verified -> `verified`
  - anything else -> `manual_review`

### 5. Database safety
- Booking table now has a GiST exclusion constraint to prevent overlapping active bookings for the same vehicle.
- Audit table no longer requires `actor_id` to exist in `app_users`, which allows system-generated audit actors such as webhook processors.

### 6. Error handling and response safety
- Server now sanitizes all `5xx` error responses before returning them to clients.
- Internal/provider/database errors are logged server-side and returned as generic `Unexpected server error.` responses.

### 7. HTTP security headers
- Global security headers are now configured in `next.config.ts`.
- Added protections include:
  - Content Security Policy
  - HSTS
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy`
  - `Permissions-Policy`

## Required Environment Variables

Before staging or production, configure all of the following:
- `APP_ENV=production`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `SETU_CLIENT_ID`
- `SETU_CLIENT_SECRET`
- `SETU_PRODUCT_INSTANCE_ID`
- `SETU_REDIRECT_URL`
- `SETU_WEBHOOK_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ADMIN_EMAIL`
- `CIBIL_PROVIDER_MODE`
- `JOB_SECRET`

## Further Development Backlog

These items are still recommended before a full production launch:

### Blockers before real public launch
- Add automated tests for:
  - spoofed KYC callbacks
  - cross-user payment order attempts
  - duration-window mismatch rejection
  - concurrent same-vehicle booking attempts
- Add rate limiting on:
  - auth endpoints
  - payment order creation
  - KYC start/status/callback endpoints
  - internal job endpoints

### Strongly recommended next
- Add true idempotency keys for payment-order creation to eliminate duplicate external Razorpay orders under concurrent requests.
- Add booking/payment reconciliation jobs for orphaned provider orders and webhook gaps.
- Add structured server logging and alerting for:
  - failed webhooks
  - KYC manual-review spikes
  - booking overlap conflicts
  - internal job failures
- Add admin tooling to replay failed webhooks safely.
- Add retention/deletion policy for KYC-related operational metadata.

### Nice next improvements
- Add request tracing / correlation IDs.
- Add security test coverage in CI.
- Add audit dashboards for privileged admin and partner actions.
- Add staging smoke tests for booking, KYC, payments, and tracking flows.

## Operational Reminder

After merging these hardening changes:
1. Run `npm run migrate` against the target Supabase database.
2. Run `npm run seed` only in non-production environments where seed data is appropriate.
3. Re-test booking creation, extension, payment order creation, KYC callback flow, and admin/partner dashboards in staging.
