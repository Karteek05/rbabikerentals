# Competitor Feature Gap Analysis (India Bike Rentals)

Last updated: April 19, 2026

## Scope
- Goal: compare this Phase 1 product against major India bike/scooty rental players.
- Focus: customer UX, operations, partner/admin controls, and monetization features.
- Markets reviewed: Bengaluru-first plus India multi-city patterns.

## Competitors Reviewed
- Royal Brothers
- ONN Bikes
- Rentrip
- FREEDO
- Yulu Long-Term Rentals
- Rentora (newer app-led doorstep model)

## What We Already Have (Strong)
- Role-gated dashboards (customer, partner, admin).
- Admin fleet operations: add/edit/deactivate/delete vehicles + image upload/remove.
- Partner/admin live vehicle tracking map.
- Booking lifecycle (create, extend, cancel) with pricing quote flow.
- DigiLocker KYC integration boundary + admin manual-review queue.
- Razorpay order + webhook confirmation flow.

## Missing Features vs Market (Priority)
## P0 (Launch-critical)
1. Real offers/promo engine UI + rules:
   - Competitors run frequent offers and first-ride codes.
   - Add admin-managed coupons with validity, city scope, usage caps, and audit logs.
2. Policy transparency module in booking UX:
   - Explicitly show cancellation slabs, late fees, fuel, KM limits, and deposit/refund ETA before payment.
   - Current backend supports pricing logic, but policy explainability UI is still light.
3. Doorstep delivery scheduling:
   - Competitors highlight home delivery heavily (especially for monthly plans).
   - Add delivery slot selection, fee logic, and ops assignment.
4. Subscription productization (not just monthly duration bucket):
   - Add true subscription entity with start/end, autopay mandate state, pause/resume, swap flow.

## P1 (High-impact, near-term)
1. Referral and wallet growth loops:
   - Referral code issuance, reward ledger, wallet credits, and expiry logic.
2. Hub/coverage intelligence UX:
   - "Nearest pickup hub" view with live stock by model and open hours.
3. Partner supply onboarding:
   - Admin flow to invite/onboard partners with KYC, payouts, and SLA acceptance.
4. Standardized incident assistance workflow:
   - 24x7 support ticketing and roadside-assistance states tied to booking and vehicle.
5. Evidence-first trust section:
   - Replace generic/fake-looking trust copy with verifiable signals (real counts from DB, policy badges, compliance status).

## P2 (Scale and differentiation)
1. Inter-city / one-way drop products (select corridors first).
2. Corporate/B2B rental plans (last-mile fleets, delivery teams).
3. Dealer/host marketplace model (list idle vehicles with quality checks).
4. Dynamic pricing and demand-aware promos by hub/time window.

## Competitor Evidence Snapshot
1. Royal Brothers:
   - Long-term rental + broad Bengaluru hub network + policy-heavy FAQ and subscription terms.
   - Mentions RBX subscription with maintenance, doorstep delivery, and autopay.
2. ONN Bikes:
   - Strong daily/monthly positioning, "cancel anytime", doorstep delivery, and multi-hub framing.
3. Rentrip:
   - Strong policy and trust framing: "No Riding Limits", "Verified Dealers", "100% Moneyback*".
   - Host/dealer business onboarding is explicit.
4. FREEDO:
   - Repeated city pages emphasize home delivery, free insurance, instant KYC + payments.
5. Yulu Rentals:
   - Long-term rental playbook includes doorstep battery swap and unlimited rides framing.
6. Rentora:
   - Two-app model (user + partner app) with digital partner onboarding and doorstep workflow.

## Recommended Execution Order (for this project)
1. P0-1: Offers + policy transparency (fast impact on conversion/trust).
2. P0-2: Doorstep delivery scheduling + ops assignment.
3. P0-3: Subscription entity + autopay lifecycle.
4. P1-1: Referral/wallet system.
5. P1-2: Partner onboarding + SLA/compliance workflows.

## Maps Note
- Current implementation uses OpenStreetMap embed for tracking surfaces.
- If switching to Google Maps Platform, estimate costs using SKU-level pricing and free usage caps before rollout (Dynamic Maps, Geocoding, Routes, Places).

## Sources
- Royal Brothers Bengaluru rentals: https://www.royalbrothers.com/bangalore/bike-rentals
- Royal Brothers Partner with Us: https://www.royalbrothers.com/partner-with-us
- Royal Brothers FAQ: https://www.royalbrothers.com/faq
- Royal Brothers Terms (RBX): https://www.royalbrothers.com/terms-and-conditions
- ONN Bikes homepage: https://www.onnbikes.com/
- Rentrip rent-bike: https://www.rentrip.in/rent-bike
- FREEDO city page sample: https://freedo.rentals/bike-rentals-in-greater-noida
- Yulu long-term rentals: https://rentals.yulu.bike/index.html
- Rentora: https://rentora.me/
- Google Maps pricing overview: https://developers.google.com/maps/billing-and-pricing/overview?hl=en_US
- Google Maps core pricing list: https://developers.google.com/maps/billing-and-pricing/pricing
