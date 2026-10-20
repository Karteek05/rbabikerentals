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

### 4. Identity verification paused
- Aadhaar/DigiLocker UI, provider integration, callback/polling routes, and KYC review APIs are disabled pending required permissions.
- Historical identity records remain in the schema for compatibility and are not read or updated by active application flows.
- No Setu credentials or migration are required for this cutover.

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
- `APP_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_VEHICLE_DOC_BUCKET=vehicle-documents` (private bucket)
- `SUPABASE_VEHICLE_IMAGE_BUCKET=vehicle-images` (public bucket)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ADMIN_EMAIL`
- `CIBIL_PROVIDER_MODE`
- `JOB_SECRET`

## Applied source fixes from the website review

- Investor reporting now interprets selected dates and weekly/monthly groups in `Asia/Kolkata`; ranges include the complete final calendar day.
- Razorpay is required for checkout. When unavailable, order creation returns `503`; the untracked UPI/third-party QR fallback is removed.
- Investor reporting uses `Asia/Kolkata`; Razorpay payment paths and internal scheduled-job/tracking routes are rate-limited. No KYC provider routes are active.
- Production vehicle-document and image uploads no longer fall back to instance-local files. Vehicle documents must use a private Supabase Storage bucket; vehicle images use the configured public image bucket.
- Empty storage bucket environment values fall back to the documented bucket names.
- Database rate-limit records older than 24 hours are cleaned during rate-limit checks.

## Further Development Backlog

These items are still recommended before a full production launch:

### Blockers before real public launch
- Add an automated database-backed test for concurrent same-vehicle booking attempts; source tests cover cross-user payment orders, duration mismatch, and disabled payment configuration.
- Verify Better Auth sign-in, email OTP, and password-reset throttling in the chosen production setup; the route-specific limits above do not cover those provider-managed endpoints.

### Strongly recommended next
- Add true idempotency keys for payment-order creation to eliminate duplicate external Razorpay orders under concurrent requests.
- Add booking/payment reconciliation jobs for orphaned provider orders and webhook gaps.
- Add structured server logging and alerting for failed webhooks, booking overlap conflicts, and internal job failures.
- Add admin tooling to replay failed webhooks safely.

### Nice next improvements
- Add request tracing / correlation IDs.
- Add security test coverage in CI.
- Add audit dashboards for privileged admin and partner actions.
- Add staging smoke tests for booking, payments, and tracking flows.

## Operational Reminder

After merging these hardening changes:
1. Run `npm run migrate` against the target Supabase database.
2. Run `npm run seed` only in non-production environments where seed data is appropriate.
3. Re-test booking creation, extension, payment order creation, and admin/partner dashboards in staging.
