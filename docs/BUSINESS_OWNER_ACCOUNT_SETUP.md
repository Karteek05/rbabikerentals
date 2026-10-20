# Business Owner Setup Guide (Rbabikerentals.com)

Last updated: April 19, 2026  
Scope: Bengaluru-only launch (Phase 1)

This guide is for the business owner to complete all external account setup needed for go-live.

## 1) What You Must Set Up
1. Razorpay business account (for booking and deposit payments).
2. Business email/domain and compliance docs ready for onboarding checks.
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
## 3) Aadhaar/DigiLocker verification (paused)
Identity-document verification is disabled until the business obtains required permissions. Do not configure Setu credentials or register callbacks. No migration is required. Existing database records remain for historical compatibility.

Before reconsidering identity verification, resolve applicable permissions, consent, data-use purpose, retention, and security obligations with the appropriate advisors.

## 4) Owner-to-engineering hand-off checklist
1. Share Razorpay live keys and webhook secret securely.
2. Confirm the official business legal name and brand display name.
3. Confirm settlement bank account details through a secure channel.
4. Confirm refund/cancellation policy, security-deposit rules, and excess-kilometre charges in writing.

## 5) References
1. Razorpay setup and KYC (India):  
   https://razorpay.com/docs/payments/set-up/?preferred-country=IN
2. Razorpay account activation details:  
   https://razorpay.com/docs/payments/dashboard/account-settings/activation-details/?preferred-country=IN
3. Razorpay settlements FAQ (India):  
   https://razorpay.com/docs/payments/settlements/faqs/?preferred-country=IN

