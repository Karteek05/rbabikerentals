# Business Owner Setup Guide (Rbabikerentals.com)

Last updated: April 19, 2026  
Scope: Bengaluru-only launch (Phase 1)

This guide is for the business owner to complete all external account setup needed for go-live.

## 1) What You Must Set Up
1. Razorpay business account (for booking and deposit payments).
2. Setu account + DigiLocker product configuration (for Aadhaar + DL KYC).
3. Business email/domain and compliance docs ready for onboarding checks.
4. Notification provider account (WhatsApp/SMS) if sending live alerts.

## 2) Razorpay: What To Do
## 2.1 Actions
1. Sign up on Razorpay dashboard.
2. Complete KYC using CKYC/Video KYC/manual flow as requested.
3. Add and verify settlement bank account.
4. Generate Test and Live API keys.
5. Share with engineering team:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET` (after webhook creation)

## 2.2 Documents/Inputs Usually Needed
1. PAN details (personal and/or business PAN based on entity type).
2. Business identity docs (for registered business, required + additional docs).
3. Bank account details and, if needed, bank proof (cancelled cheque/branch letter).
4. Website/app links and business category details.

## 2.3 Verification Timeline (Important)
1. Razorpay’s India docs state that from January 1, 2026, if CKYC records exist, onboarding can complete in minutes.
2. If CKYC is not available or fails, fallback KYC steps and Razorpay review are required; this is not instant.
3. Settlements after activation are generally on a T+2 working-day cycle (subject to risk/bank approvals).

Operational advice:
- Keep a 3-5 business day buffer for non-CKYC cases before launch commitments.

## 3) Setu + DigiLocker: What To Do
## 3.1 Actions
1. Create/confirm your Setu Bridge account.
2. Configure DigiLocker product on sandbox first.
3. Obtain sandbox credentials:
   - `x-client-id`
   - `x-client-secret`
   - `x-product-instance-id`
4. Complete production config:
   - callback/redirect URLs
   - KYC/compliance details on Bridge
5. Submit for production review and wait for LIVE approval.
6. Share with engineering team:
   - `SETU_CLIENT_ID`
   - `SETU_CLIENT_SECRET`
   - `SETU_PRODUCT_INSTANCE_ID`
   - `SETU_DIGILOCKER_BASE_URL` (`https://dg.setu.co`)
   - `SETU_REDIRECT_URL`

## 3.2 Verification Timeline (Important)
1. Setu docs indicate production reviews typically take about 2-5 days depending on product/config completeness.
2. If additional clarifications are requested, timeline extends.

Operational advice:
- Plan 5 business days buffer for Setu production readiness.

## 4) Legal/Compliance Notes You Should Know
Even with Setu integration, your business still owns consent/compliance obligations for KYC data use.

From DigiLocker requester terms:
1. Access must be consent-based.
2. You must clearly state purpose of data access.
3. Avoid caching/storing documents longer than permitted by law/policy.
4. Security incidents should be reported promptly (terms mention 24-hour breach notification expectations).
5. Annual compliance audit requirements apply in requester terms context.

## 5) Owner-to-Engineering Hand-off Checklist
## 5.1 Must Share Securely
1. Razorpay live keys + webhook secret.
2. Setu production headers/credentials.
3. Official business legal name and brand display name.
4. Settlement bank account details (masked in non-finance channels).
5. Final callback URLs approved by owner.

## 5.2 Must Confirm in Writing
1. Refund/cancellation policy percentages.
2. Security deposit rules (collect/release conditions).
3. Excess KM and extension charge policy.
4. KYC rejection/manual-review business policy.

## 6) Suggested Timeline You Can Follow
If work starts on Monday, April 20, 2026:
1. April 20-21: Razorpay signup + KYC + bank verification submission.
2. April 20-22: Setu sandbox configuration and API credentials sharing.
3. April 22-24: Setu production submission + review cycle starts.
4. April 24-29: Resolve review clarifications, confirm LIVE credentials.
5. April 30+: Payment+KYC UAT in staging, then production go-live prep.

## 7) References
1. Razorpay set-up and KYC (India):  
   https://razorpay.com/docs/payments/set-up/?preferred-country=IN
2. Razorpay account activation details:  
   https://razorpay.com/docs/payments/dashboard/account-settings/activation-details/?preferred-country=IN
3. Razorpay settlements FAQ (India):  
   https://razorpay.com/docs/payments/settlements/faqs/?preferred-country=IN
4. Setu DigiLocker quickstart:  
   https://docs.setu.co/data/digilocker/quickstart
5. Setu Bridge configuration/review timeline:  
   https://docs.setu.co/dev-tools/bridge/explore-and-configure-products
6. DigiLocker requester terms (June 2, 2025):  
   https://img1.digitallocker.gov.in/circulars/termsofuse/DigiLocker-Terms-of-Use-Requester-june-2025.pdf

