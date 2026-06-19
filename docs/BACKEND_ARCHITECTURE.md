# Rbabikerentals.com Backend Architecture (Phase 1)

## 1. Architecture Overview
Backend follows a modular monolith/BFF architecture inside one Next.js-based deployment with Supabase as data platform.  
Core principles:
- Clear domain boundaries.
- Explicit booking state machine.
- Rule-driven pricing.
- Strict role and row-level security.
- Auditability for operational actions.

## 2. Bounded Modules
## 2.1 `auth`
- Better Auth integration, session handling, role claim resolution.
- Authorization middleware for API routes.

## 2.2 `users`
- Customer, partner_investor, admin profiles.
- KYC status metadata and account lifecycle.

## 2.3 `vehicles`
- Vehicle catalog, availability windows, operational status.
- Activation/deactivation controls.

## 2.4 `pricing`
- Rule engine for rates, slabs, add-ons, penalties, coupons.
- Quote generation and quote lock snapshot.

## 2.5 `bookings`
- Booking create/update lifecycle and transitions.
- Extension, cancellation, completion workflows.

## 2.6 `payments`
- Razorpay order creation, callbacks/webhooks, reconciliation.
- Booking payment and deposit accounting records.

## 2.7 `kyc`
- DigiLocker start/check flows via Setu.
- KYC decisioning with manual-review fallback path.

## 2.8 `documents`
- Vehicle compliance docs and expiry tracking.
- Incident evidence and KYC artifact references.

## 2.9 `partner_ops`
- Revenue aggregates and booking insights.
- Block/maintenance window management for owned vehicles.

## 2.10 `admin_ops`
- Platform-wide booking oversight.
- KYC queue operations.
- Reject/override actions and governance workflows.

## 2.11 `tracking`
- Vehicle live location ingestion from internal jobs/webhooks/device pings.
- Role-scoped read APIs for partner and admin dashboards.
- GPS metadata normalization (lat/lng, heading, speed, updated timestamp).

## 2.12 `notifications`
- Template registry and provider adapter.
- Event-driven dispatch (SMS/WhatsApp).

## 2.13 `audit`
- Immutable event log for sensitive actions.
- Actor, resource, before/after snapshots, timestamp.

## 3. Core Enums and Contracts
- `Role`: `customer | partner_investor | admin`
- `KycStatus`: `not_started | in_progress | verified | manual_review | failed | expired`
- `BookingStatus`: `draft | pending_kyc | admin_review | payment_pending | confirmed | ongoing | extension_requested | extended | completed | cancelled`

```ts
interface PricingQuote {
  base_amount: number
  duration_amount: number
  addon_amount: number
  coupon_discount: number
  deposit_amount: number
  tax_amount: number
  total_payable: number
  km_included: number
  excess_km_rate: number
}
```

## 4. Booking State Machine
Canonical lifecycle:
`draft -> pending_kyc -> admin_review -> payment_pending -> confirmed -> ongoing -> extension_requested -> extended -> completed`

Alternate terminal transition:
`payment_pending|confirmed|ongoing|extended -> cancelled`

Transition control rules:
- `draft -> pending_kyc`: customer submits booking intent.
- `pending_kyc -> admin_review`: KYC/DL review is verified or manually approved.
- `admin_review -> payment_pending`: admin accepts the booking request and opens payment.
- `payment_pending -> confirmed`: payment success callback + quote lock validation.
- `confirmed -> ongoing`: pickup check-in completed.
- `ongoing -> extension_requested`: customer triggers extension request.
- `extension_requested -> extended`: availability + payment differential success.
- `ongoing|extended -> completed`: return inspection and closeout complete.
- `payment_pending|confirmed|ongoing|extended -> cancelled`: policy engine calculates cancellation/refund.

## 5. Pricing Engine Model
Pricing model hierarchy:
1. Base rate by vehicle category.
2. City override.
3. Vehicle-specific override.
4. Duration slab multiplier (`hour/day/week/month`).
5. Add-ons (helmet, extras).
6. Coupon discounts.
7. Penalties/adjustments (excess km, cancellation, extension delta).
8. Taxes and deposit line items.

Pricing output is always materialized into `PricingQuote` and persisted as booking quote snapshot to avoid drift after configuration changes.
In Phase 1, only Bengaluru rules are active; `city` dimensions remain in schema for future multi-city rollout.
For booking creation and extension, the server derives billable duration from actual timestamps instead of trusting client-submitted duration counts.

## 6. Operational Flow Definitions
## 6.1 Booking creation + quote lock + payment/deposit
1. Customer calls `POST /api/quotes`.
2. Pricing service computes `PricingQuote`.
3. Customer submits booking via `POST /api/bookings`.
4. Booking service recomputes duration from pickup/drop timestamps and refuses mismatched duration plans.
5. Booking overlap is checked both in application logic and at the database constraint layer.
6. Booking enters `pending_kyc` or `admin_review` based on KYC status.
7. Admin approval moves the booking to `payment_pending`.
8. Customer payment creates or reuses a single active Razorpay order for that booking.
9. On verified success callback, status moves to `confirmed`.

## 6.2 Extension and recalculation
1. Customer calls `POST /api/bookings/{id}/extend`.
2. Check vehicle availability for extension window.
3. Recompute differential amount with rules.
4. Capture payment differential.
5. Move state to `extended`.

## 6.3 Cancellation and refund
1. Customer/admin triggers `POST /api/bookings/{id}/cancel`.
2. Policy engine computes cancellation charge and refundable amount.
3. Payment service initiates refund where applicable.
4. Booking moves to `cancelled`.

## 6.4 Damage incident and auto vehicle block
1. Customer submits incident with media evidence.
2. Incident record created and linked to booking/vehicle.
3. Vehicle auto-block window can be created by policy or admin decision.
4. Partner/admin receive alerts and resolve case.

## 6.5 Document expiry reminders
1. Scheduled job evaluates document expiry thresholds.
2. Create reminder events at configured intervals.
3. Notify partner/admin.
4. Escalate to admin if expiry breaches hard compliance threshold.

## 6.6 Vehicle live tracking
1. Internal GPS source posts to `POST /api/internal/tracking/update` with `x-job-secret`.
2. Service validates coordinates and normalizes payload.
3. Latest position is upserted per vehicle.
4. Partner/admin dashboards read via role-scoped tracking endpoints.

## 7. Public API Surface (Phase 1)
- `POST /api/quotes`
- `POST /api/bookings`
- `POST /api/bookings/{id}/extend`
- `POST /api/bookings/{id}/cancel`
- `POST /api/kyc/digilocker/start`
- `GET /api/kyc/{userId}`
- `GET /api/partner/revenue`
- `GET /api/partner/tracking`
- `POST /api/vehicles/{id}/block`
- `GET /api/admin/bookings`
- `GET /api/admin/vehicles`
- `POST /api/admin/vehicles`
- `PATCH /api/admin/vehicles/{id}`
- `DELETE /api/admin/vehicles/{id}`
- `POST /api/admin/vehicles/{id}/images`
- `GET /api/admin/tracking`
- `POST /api/admin/bookings/{id}/reject`
- `POST /api/internal/tracking/update`

## 8. Security Model
## 8.1 Authentication and authorization
- Better Auth session required for all protected endpoints.
- Role-based route authorization at API boundary.
- Resource-level ownership checks in domain layer.
- Header-based dev auth is disabled by default and never allowed in production mode.
- First authenticated session bootstraps an `app_users` row when missing.

## 8.2 Supabase RLS strategy
- Enable RLS on all exposed app tables.
- Customer sees only own booking/KYC scoped rows.
- Partner sees only owned/invested vehicle and derived booking/revenue rows.
- Admin role can view/operate all governed rows via secure server-side pathways.

## 8.3 Service-role boundaries
- Supabase service role used only in server runtime for privileged operations.
- Never exposed to browser clients.

## 8.4 Audit and traceability
- All admin rejects/overrides, partner block changes, and KYC decisions are audit logged.
- Audit records immutable and queryable for incident review.
- System-driven events such as webhook processors are allowed to write audit entries without requiring a matching human `app_users` row.

## 8.5 KYC and PII handling
- Store only necessary KYC metadata and document references.
- Apply retention windows and deletion/archive policy for sensitive artifacts.
- Restrict raw document access to authorized admin workflows.
- DigiLocker callback ingestion requires a shared webhook secret and does not auto-verify users from boolean fields alone.

## 8.6 Transport and browser hardening
- Global HTTP responses include a Content Security Policy and baseline browser security headers.
- `5xx` responses are sanitized before being returned to clients.

## 9. Test Plan for Implementation Readiness
## 9.1 Completeness checks
1. Each requested feature maps to exactly one primary module owner.
2. All pricing/penalty items map into `PricingQuote`.
3. Every state transition has trigger, permission, and side-effects.

## 9.2 Scenario validation
1. Successful booking with coupon + deposit collection.
2. KYC pass path vs manual-review fallback.
3. Extension flow with availability check and differential charging.
4. Cancellation with policy-based charges/refund.
5. Partner block window preventing new booking.
6. Admin reject action with complete audit trail.

## 9.3 Security validation
1. Role-to-endpoint access matrix enforced.
2. RLS policy intent validated by role simulation.
3. KYC document access constraints and retention enforcement confirmed.

## 10. Assumptions and Constraints
- Phase 1 remains web-only.
- `partner_investor` merged role for velocity.
- CIBIL remains non-blocking, manual-review signal.
- DigiLocker design follows current requester/partner consent constraints and June 2, 2025 requester terms, implemented through Setu-first integration path.
- Geography is Bengaluru-only in Phase 1; location data model remains extensible for later city expansion.
