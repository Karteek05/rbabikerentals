# Rbabikerentals.com (Phase 1 Scaffold)

This repository contains a Bengaluru-only Phase 1 implementation scaffold for:
- Customer booking surface
- Partner/Investor operations
- Admin operations

## Tech Direction
- Next.js (App Router)
- Better Auth session integration (`/api/auth/[...all]`)
- Supabase repository support + schema (`db/schema.sql`)
- Razorpay order + webhook flow
- Setu DigiLocker start/callback/status flow

## Quick Start
1. Copy `.env.example` to `.env.local`.
2. Fill required values (for pure local scaffold use dummy provider credentials, but keep valid Supabase vars if you want DB mode).
3. Install dependencies: `npm install`
4. Start app: `npm run dev`
5. Open `http://localhost:3000`

This project is a single Next.js app (App Router + API routes), so `npm run dev` starts both UI and backend APIs together.

## Local Development Setup (Recommended)
1. Keep `ALLOW_DEV_HEADERS=false` by default. Turn it on only when you intentionally want header-based local testing without a Better Auth session.
2. For database-backed local/staging testing, run:
   - `npm run migrate`
   - `npm run seed`
3. Use the seeded IDs:
   - Customer: `cust_001`
   - Partner: `partner_001`
   - Admin: `admin_001`
4. For local header-auth testing only, set `ALLOW_DEV_HEADERS=true` in `.env.local` and restart the dev server.

## Current Auth Model (Scaffold)
Better Auth is wired. Session users are bootstrapped into `app_users` on first authenticated request, and KYC records are auto-created on first KYC/booking access.

For local development without a Better Auth session, temporarily set `ALLOW_DEV_HEADERS=true` and use request headers:
- `x-user-id`
- `x-role` (`customer`, `partner_investor`, `admin`)

Never enable `ALLOW_DEV_HEADERS=true` in staging or production.

## Implemented APIs
- `POST /api/quotes`
- `POST /api/bookings`
- `POST /api/bookings/[id]/extend`
- `POST /api/bookings/[id]/cancel`
- `POST /api/kyc/digilocker/start`
- `GET /api/kyc/[userId]`
- `GET /api/partner/revenue`
- `POST /api/vehicles/[id]/block`
- `GET /api/admin/bookings`
- `POST /api/admin/bookings/[id]/reject`
- `GET /api/admin/vehicles`
- `POST /api/admin/vehicles`
- `PATCH /api/admin/vehicles/[id]`
- `DELETE /api/admin/vehicles/[id]`
- `POST /api/admin/vehicles/[id]/images`
- `POST /api/payments/order`
- `POST /api/payments/refund`
- `POST /api/webhooks/razorpay`
- `POST /api/kyc/digilocker/callback`
- `GET /api/kyc/digilocker/status/[requestId]`
- `POST /api/maps/distance`
- `POST /api/maps/reverse-geocode`
- `GET /api/admin/kyc/manual-review`
- `POST /api/admin/kyc/[userId]/approve`
- `POST /api/admin/kyc/[userId]/reject`
- `GET /api/customer/bookings`
- `POST /api/bookings/[id]/damage`
- `GET /api/partner/tracking`
- `GET /api/admin/tracking`
- `POST /api/internal/tracking/update`
- `POST /api/internal/jobs/document-expiry`
- `POST /api/internal/jobs/incident-escalation`

## Database and Jobs
- Run migration: `npm run migrate`
- Seed data: `npm run seed`
- Run document expiry job: `npm run job:documents`
- Run incident escalation job: `npm run job:incidents`

Security-sensitive environment variables to configure before staging/production:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `ADMIN_EMAIL`
- `RAZORPAY_WEBHOOK_SECRET`
- `SETU_WEBHOOK_SECRET`
- `CIBIL_PROVIDER_MODE` (`mock` until provider contract keys are available)
- `JOB_SECRET`
- Supabase service credentials

Vehicle image storage:
- If Supabase is configured, uploads go to `SUPABASE_VEHICLE_IMAGE_BUCKET` (default: `vehicle-images`).
- Without Supabase, uploads are saved to `public/uploads/vehicles/<vehicle_id>/`.

## Example cURL
```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "content-type: application/json" \
  -H "x-user-id: cust_001" \
  -H "x-role: customer" \
  -d '{
    "user_id":"cust_001",
    "vehicle_id":"veh_001",
    "city":"bengaluru",
    "duration_bucket":"day",
    "duration_value":1,
    "extra_helmet_count":1,
    "coupon_code":"WELCOME5"
  }'
```

Update live vehicle position (internal webhook/job style):
```bash
curl -X POST http://localhost:3000/api/internal/tracking/update \
  -H "content-type: application/json" \
  -H "x-job-secret: <JOB_SECRET>" \
  -d '{
    "vehicle_id":"veh_001",
    "latitude":12.9716,
    "longitude":77.5946,
    "speed_kmph":22,
    "heading_deg":90,
    "source":"gps_ping"
  }'
```

## Important Docs
- `docs/PRD.md`
- `docs/TECH_STACK.md`
- `docs/BACKEND_ARCHITECTURE.md`
- `docs/PHASE1_IMPLEMENTATION_STATUS.md`
- `docs/PRODUCTION_HARDENING.md`
- `docs/BUSINESS_OWNER_ACCOUNT_SETUP.md`
- `docs/STAGING_UAT_CHECKLIST.md`
- `docs/COMPETITOR_FEATURE_GAP.md`
