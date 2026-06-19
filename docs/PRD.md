# Rbabikerentals.com Product Requirements Document (Phase 1)

## 1. Product Summary
Rbabikerentals.com is a web-first bike rental platform with three role experiences in one product:
- `customer`
- `partner_investor`
- `admin`

Phase 1 goal is to launch end-to-end booking and operations for bikes/scooters with strong policy transparency, KYC-first onboarding, and partner/admin operational control.

This PRD uses Selfspin-like feature coverage as a baseline reference (location-based booking flow, policy pages, coupons, partner/invest hooks), but not Selfspin UI design.

## 2. Scope and Defaults
- Build scope: web-first only (no native mobile app in Phase 1).
- Role model: partner and investor are the same role in Phase 1 (`partner_investor`).
- KYC model: Aadhaar + Driving Licence via Setu DigiLocker; manual-review fallback by admin.
- CIBIL: not a hard auto-block in Phase 1. Used as manual-review signal only.
- Geography: Bengaluru-only in Phase 1 (all customer bookings, fleet operations, and admin operations scoped to Bengaluru).

## 3. Personas and Jobs-to-be-Done
### 3.1 Customer
- Find available vehicles in Bengaluru by date/time and pickup area.
- Understand full pricing and policies before payment.
- Complete KYC once and rebook quickly.
- Manage active booking (extend, support, incident reporting).

### 3.2 Partner/Investor
- Track invested vehicles and utilization.
- Monitor booking lifecycle and earnings by period.
- Block vehicles for maintenance/unavailability.
- Track document expiry and compliance.

### 3.3 Admin
- Manage platform-wide bookings and KYC queue.
- Approve/reject/override exceptional cases.
- Manage vehicle lifecycle and maintenance windows.
- Update policy/document/compliance records.

## 4. Role-Wise Module Definition
## 4.1 Customer Modules
1. Discovery and listing
- Bengaluru area/station selector (single-city mode).
- Vehicle listing with filters (type, price, availability, brand/category).
- Vehicle detail: specs, images, policy summary, deposit.

2. Booking and pricing
- Date/time selection for pickup/drop.
- KM limits per booking slab (`day`, `week`, `month`).
- Pricing breakdown: base, duration, add-ons, coupon discount, taxes, deposit.
- Terms and conditions acceptance gate.

3. Policies and charges
- Extension charges.
- Cancellation charges and rules.
- Excess kilometre charge per km.
- Extra helmet charges.
- Security deposit rules (collection, hold/release workflow).

4. Checkout and payment
- Razorpay payment integration for booking and deposit collection.
- Booking confirmation with invoice/receipt metadata.

5. KYC and account
- Aadhaar OTP verification flow via DigiLocker.
- Driving licence verification via DigiLocker.
- KYC status visibility.

6. Post-booking operations
- Booking history (`upcoming`, `ongoing`, `completed`, `cancelled`).
- Active ride extension request.
- Damage report submission with photo upload.

## 4.2 Partner/Investor Modules
1. Fleet and investment
- Invested vehicles list.
- Vehicle operational status and utilization.

2. Booking lifecycle visibility
- View by status: `upcoming`, `ongoing`, `extended`, `completed`, `cancelled`.
- Per-vehicle and per-booking timeline.

3. Revenue analytics
- Booking-wise revenue.
- Vehicle-wise revenue.
- Period-wise dashboards (weekly/monthly).

4. Availability and maintenance
- Block/unblock vehicle windows with start/end date and reason.
- Maintenance schedule and block enforcement.

5. Compliance documents
- Storage and tracking of vehicle docs (RC, road tax, permit, insurance, PUC where applicable).
- Expiry reminders and compliance status.

## 4.3 Admin Modules
1. Booking operations
- Global booking view and filters.
- Reject booking action with reason.
- Override status in controlled operational cases.

2. KYC operations
- KYC completion/failure/manual review queue.
- Escalate or approve manual-review cases.

3. Fleet operations
- Add vehicle.
- Activate/deactivate vehicle.
- Damage and maintenance case tracking.

4. Policy and document governance
- Update service records and operational documents.
- Maintain charge/policy configurations.

## 5. Feature Matrix (Role Ownership)
| Feature | Customer | Partner/Investor | Admin |
|---|---|---|---|
| Vehicles available for booking | Primary | View own fleet status | Global control |
| Pricing and slabs | Primary visibility | View revenue impact | Configure and govern |
| Terms and conditions | Accept | View policy changes | Maintain |
| KM limits (day/week/month) | View in quote | View utilization impact | Configure |
| Extension flow and charges | Request/pay | Visibility | Override exceptional cases |
| Cancellation charges/conditions | Trigger and view | Visibility | Configure/review |
| Security deposit | Pay/view | Visibility for payouts | Configure/reconcile |
| Coupon codes | Apply | N/A | Create/manage |
| Excess kilometre charges | Pay on closeout | Visibility | Configure |
| Extra helmet charges | Opt-in/pay | Visibility | Configure |
| Vehicle docs storage and expiry tracking | View vehicle-level basics | Upload/manage own docs | Validate/compliance |
| Insurance expiry reminders | N/A | Receive and act | Monitor |
| KYC (Aadhaar OTP + DL) | Complete | N/A | Review fallback queue |
| CIBIL handling | Consent/signal only | N/A | Manual review signal |
| Booking status lifecycle | Own bookings | Fleet-wide own vehicles | All bookings |
| Revenue dashboard | N/A | Booking/vehicle/period views | Cross-platform reports |
| Block/maintenance windows | N/A | Create/edit own vehicles | Override/control |
| Booking rejection | N/A | N/A | Primary owner |

## 6. Public Interface Contracts (Phase 1)
### 6.1 Core Types
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

### 6.2 Service Contracts
- `POST /api/quotes`
- `POST /api/bookings`
- `POST /api/bookings/{id}/extend`
- `POST /api/bookings/{id}/cancel`
- `POST /api/kyc/digilocker/start`
- `GET /api/kyc/{userId}`
- `GET /api/partner/revenue`
- `POST /api/vehicles/{id}/block`
- `GET /api/admin/bookings`
- `POST /api/admin/bookings/{id}/reject`

## 7. Phase 1 Acceptance Criteria
1. Customer can complete booking from discovery to payment with full pricing and policy visibility.
2. KYC supports DigiLocker-based Aadhaar + DL with manual-review fallback.
3. Extension and cancellation paths apply configured charge rules correctly.
4. Partner can view revenues and enforce block/maintenance windows.
5. Admin can reject bookings, review KYC exceptions, and control vehicle activation.
6. Policy and charge configuration is reflected in quote generation and booking closeout.

## 8. Out of Scope for Phase 1
- Native mobile app implementation.
- Hard auto-reject based on CIBIL threshold.
- Real-time dynamic surge pricing engine.
- Full loyalty/subscription ecosystem.
