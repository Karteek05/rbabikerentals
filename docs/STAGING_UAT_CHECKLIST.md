# Bengaluru Staging and UAT Checklist

Last updated: April 19, 2026

## 1) Environment Preparation
1. Configure `.env` with:
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `APP_BASE_URL`, `NEXT_PUBLIC_SITE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_VEHICLE_DOC_BUCKET=vehicle-documents` (private)
   - `SUPABASE_VEHICLE_IMAGE_BUCKET=vehicle-images` (public)
   - `SUPABASE_DB_URL`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `GOOGLE_MAPS_API_KEY`
   - `SETU_CLIENT_ID`
   - `SETU_CLIENT_SECRET`
   - `SETU_PRODUCT_INSTANCE_ID`
   - `SETU_DIGILOCKER_BASE_URL`
   - `SETU_REDIRECT_URL`
   - `SETU_WEBHOOK_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `ADMIN_EMAIL`
   - `CIBIL_PROVIDER_MODE=mock` until live CIBIL credentials are handed off
   - `JOB_SECRET`
2. Set `ALLOW_DEV_HEADERS=false` in staging.
3. Set `APP_ENV=production` in staging-like validation environments that are meant to mirror production behavior.

## 2) Database Setup
1. Run migration:
   - `npm run migrate`
2. Run seed:
   - `npm run seed`
3. Validate RLS:
   - customer reads own bookings only
   - partner reads only owned-vehicle bookings
   - admin has full operational visibility
4. Create and deactivate a pickup location in admin; confirm only active locations appear in homepage, browse, and booking, and an inactive location is rejected by booking APIs.

## 3) Payment Validation
1. Create booking and confirm it reaches `admin_review` after KYC is verified.
2. Admin approves it and confirms it moves to `payment_pending`.
3. Create Razorpay order via `/api/payments/order`.
4. Re-hit `/api/payments/order` for the same booking and confirm the existing open order is reused.
5. Confirm a customer cannot create a payment order for another customer booking.
6. Trigger webhook test event to `/api/webhooks/razorpay`.
7. Confirm booking moves to `confirmed` on `payment.captured`.
8. Confirm admin refund creation via `/api/payments/refund` after captured payment reconciliation.
9. Verify payment is not marked paid when Razorpay is unavailable; no manual UPI/third-party QR path is offered.
10. On `/admin/payments`, verify Razorpay mode is `test`, `live`, `unconfigured`, or `unknown` without exposing credentials; production must use a matching `rzp_live_` key ID and secret.
11. After a refund request, verify customer My Bookings shows the initiated/partial/refunded state accurately; “initiated” means provider accepted, not bank settlement.

## 4) KYC Validation
1. Start KYC: `/api/kyc/digilocker/start`.
2. Validate callback handling: `/api/kyc/digilocker/callback` with correct `x-setu-webhook-secret`.
3. Validate callback rejection with an invalid or missing webhook secret.
4. Validate status polling: `/api/kyc/digilocker/status/[requestId]`.
5. Confirm a customer cannot poll another user's KYC request.
6. Validate admin queue and approve/reject:
   - `/api/admin/kyc/manual-review`
   - `/api/admin/kyc/[userId]/approve`
   - `/api/admin/kyc/[userId]/reject`

## 4.1) Booking integrity validation
1. Create a booking with a valid duration window for the selected plan.
2. Attempt a booking where `duration_bucket` does not match the actual pickup/drop window and confirm API returns `400 duration_window_mismatch`.
3. Attempt two overlapping bookings for the same vehicle and confirm one is rejected.
4. Attempt an overlapping extension on the same vehicle and confirm it is rejected.

## 4.2) Investor reporting validation
1. Select one Bengaluru calendar day and verify bookings created between 00:00 and 23:59 IST are included.
2. Verify monthly and weekly totals assign a booking using its `created_at` in `Asia/Kolkata`.


## 5) Operational Job Validation
1. Run document expiry job:
   - `npm run job:documents`
2. Run incident escalation job:
   - `npm run job:incidents`
3. Validate notifications queued in `notification_jobs`.

## 6) Live Tracking Validation
1. Trigger vehicle GPS update ping:
   - `POST /api/internal/tracking/update` with `x-job-secret`.
2. Validate partner tracking visibility:
   - `GET /api/partner/tracking` returns only partner-owned vehicles.
3. Validate admin tracking visibility:
   - `GET /api/admin/tracking` returns all tracked vehicles.
4. Validate dashboard map rendering:
   - Partner page (`/partner`) shows fleet-only map markers.
   - Admin page (`/admin`) shows platform tracking.
5. Validate map utility APIs:
   - `POST /api/maps/distance`
   - `POST /api/maps/reverse-geocode`

## 7) UI UAT Flows
1. Customer dashboard:
   - Quote -> booking -> list bookings -> damage report.
2. Partner dashboard:
   - Revenue view -> tracking map -> block vehicle window.
3. Admin dashboard:
   - Fleet ops: add/edit/deactivate/delete vehicles.
   - Fleet ops: upload/remove vehicle images.
   - Fleet ops: edit hourly, daily, weekly, and monthly rates, deposit, included mileage by duration, and extra-kilometre fee for scooter, bike, and EV-bike catalogues; verify public browse cards and booking quotes use saved values.
   - Confirm tax, package discount, and payment balance remain system-calculated rather than manually editable.
   - View bookings -> reject booking.
   - View KYC queue -> approve/reject entries.
   - Monitor live fleet locations.

4. Payments & refunds: inspect payment mode and request a valid full/partial refund; confirm failure messages remain visible.
5. Incident triage: update status and notes; confirm the record leaves the open queue after resolution.
6. Policies & promotions: change cancellation percentages, create/edit/deactivate a coupon, and verify customer booking disclosure and server-generated quote behavior.
7. Pickup locations: add/deactivate a location and verify active-only customer selectors plus server validation.
8. Partner settlements: record an actual transfer; confirm only the selected partner sees its recorded amount and no payout entitlement is calculated.
9. Partner vehicles: create and remove a maintenance window; verify confirmation before removal, availability changes, and ownership isolation.
10. Partner dashboard: verify document expiry alerts and settlement history contain only the partner’s own vehicles/transfers.
11. Customer site: verify rates/categories come from the public catalog, pickup points match active configuration, and no internal operations jargon is shown.

## 8) Release Sign-Off
1. `npm run typecheck` passes.
2. `npm run test` passes.
3. `npm run build` passes.
4. Business owner confirms payment + KYC credentials are production-approved.
5. `npm audit` shows no unresolved production-blocking auth/payment vulnerabilities.
6. Bengaluru UAT approval received before production release.
