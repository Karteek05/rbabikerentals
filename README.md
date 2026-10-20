# Rbabikerentals.com (Phase 1 Scaffold)

This repository contains a Bengaluru-only Phase 1 implementation scaffold for:
- Customer booking surface
- Partner/Investor operations
- Admin operations

## Tech Direction
- Next.js (App Router)
- Better Auth session integration (`/api/auth/[...all]`)
- Supabase repository support + schema (`db/schema.sql`)
- Razorpay order + webhook flow. Aadhaar/DigiLocker identity verification is paused pending required permissions; existing records remain in the database and no identity provider is contacted.

## Quick Start
1. Copy `.env.example` to `.env`.
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
4. For local header-auth testing only, set `ALLOW_DEV_HEADERS=true` in `.env` and restart the dev server.

## Current Auth Model (Scaffold)
Better Auth is wired. Session users are bootstrapped into `app_users` on first authenticated request. Identity verification is paused; historical identity records are not created, read, or updated by active application flows.

For local development without a Better Auth session, temporarily set `ALLOW_DEV_HEADERS=true` and use request headers:
- `x-user-id`
- `x-role` (`customer`, `partner_investor`, `admin`)

Never enable `ALLOW_DEV_HEADERS=true` in staging or production.

## Implemented APIs
- `POST /api/quotes`
- `POST /api/bookings`
- `POST /api/bookings/[id]/extend`
- `POST /api/bookings/[id]/cancel`
- `GET /api/partner/revenue` (partner/investor-scoped gross booking analytics)
- `GET /api/partner/dashboard`
- `GET /api/partner/vehicles`
- `POST /api/vehicles/[id]/block`
- `DELETE /api/vehicles/[id]/block-windows/[blockId]`
- `GET /api/locations`
- `GET /api/policies`
- `GET /api/partner/vehicle-blocks`
- `GET /api/partner/documents`
- `GET /api/partner/settlements`
- `GET /api/admin/bookings`
- `GET /api/admin/payments`
- `GET/PATCH /api/admin/incidents`
- `GET/PATCH /api/admin/policies`
- `GET/POST /api/admin/coupons`
- `GET/POST /api/admin/locations`
- `GET/POST /api/admin/settlements`
- `POST /api/admin/bookings/[id]/reject`
- `GET /api/admin/vehicles`
- `POST /api/admin/vehicles` (admin assigns each vehicle to an investor account)
- `PATCH /api/admin/vehicles/[id]`
- `DELETE /api/admin/vehicles/[id]`
- `POST /api/admin/vehicles/[id]/images`
- `POST /api/admin/vehicles/[id]/documents`
- `PATCH /api/admin/vehicles/[id]/documents` (edit expiry)
- `DELETE /api/admin/vehicles/[id]/documents`
- `GET /api/admin/documents` (fleet-wide investor-attributed document library)
- `GET /api/vehicles/[id]/documents`
- `POST /api/payments/refund`
- `POST /api/webhooks/razorpay`
- `POST /api/maps/distance`
- `POST /api/maps/reverse-geocode`
- `GET /api/customer/bookings`
- `POST /api/bookings/[id]/damage`
- `GET /api/partner/tracking`
- `GET /api/admin/tracking`
- `POST /api/internal/tracking/update`
- `POST /api/internal/jobs/document-expiry`
- `POST /api/internal/jobs/incident-escalation`

## Database and Jobs
- Run migration: `npm run migrate`
- Migration source: `db/schema.sql`; `npm run migrate` applies it.
- Seed data: `npm run seed`
- Run document expiry reminders and retry orphaned vehicle-document cleanup: `npm run job:documents`
- The matching `POST /api/internal/jobs/document-expiry` endpoint requires `x-job-secret: $JOB_SECRET`; schedule it regularly. Failed cleanup entries are retried after one hour and are never deleted while a document record still references the file.
- Run incident escalation job: `npm run job:incidents`
- `.github/workflows/supabase-keepalive.yml` calls `https://www.rbabikerentals.com/api/fleet/catalog` three times daily at `17 0,8,16 * * *` UTC; it needs no database secret. GitHub scheduled workflows on public repositories can be delayed and are disabled after 60 days without repository activity.
- For a scheduler independent of repository activity, use the free [cron-job.org](https://cron-job.org/en/) service with the same URL, method `GET`, and schedule. In Supabase mode the endpoint reads fleet records from the database; Supabase says a few database requests per day typically prevent inactivity pausing, but this is best-effort. [Pro projects are not auto-paused](https://supabase.com/docs/guides/platform/free-project-pausing).

Security-sensitive environment variables to configure before staging/production:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `ADMIN_EMAIL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CIBIL_PROVIDER_MODE` (`mock` until provider contract keys are available)
- `JOB_SECRET`
- Supabase service credentials
- Production uses a matching Razorpay live key pair (`rzp_live_` key ID); test keys (`rzp_test_`) select test mode. The application has no separate mode switch.

Vehicle image storage:
- If Supabase is configured, uploads go to `SUPABASE_VEHICLE_IMAGE_BUCKET` (default: `vehicle-images`).
- Without Supabase, uploads are saved to `public/uploads/vehicles/<vehicle_id>/`.

Vehicle document storage:
- Supabase Storage documents are served only through authenticated application routes; configure the document bucket (`SUPABASE_VEHICLE_DOC_BUCKET`, default `vehicle-documents`) as private.
- Without Supabase, documents are stored under `.data/vehicle-documents/` and require persistent, private server storage.
- Replacements use fresh object names. The old file is deleted only after the database points to its replacement; failed removals are queued and retried by the document job.

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
