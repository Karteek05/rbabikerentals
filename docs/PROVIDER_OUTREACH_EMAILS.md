# API Provider Outreach Drafts

Use a business email on the production domain before sending these. Suggested sender pattern: `founder@rbabikerentals.com`, `ops@rbabikerentals.com`, or `partnerships@rbabikerentals.com`.

## Domain and Business Email Prerequisites

1. Buy the production domain.
2. Set up business email for that domain.
3. Configure SPF, DKIM, and DMARC records before contacting API providers.
4. Prepare business documents:
   - legal entity name
   - PAN/GST, if available
   - registered address
   - website URL
   - privacy policy URL
   - refund/cancellation policy URL
   - KYC data-use and retention policy
5. Use provider dashboards only with company-owned email IDs, not personal Gmail accounts.

## Email 1: Setu DigiLocker API Access

Subject: Request for DigiLocker API sandbox and production access for bike rental KYC

Hello Setu Team,

I am contacting you on behalf of RBA Bike Rentals. We are building a Bengaluru-based bike and scooter rental platform and want to integrate Setu DigiLocker for consent-based customer KYC.

Our intended use case:
- Aadhaar-backed DigiLocker consent flow
- Driving Licence verification for rental eligibility
- Admin manual-review fallback when automated verification is incomplete
- Consent-based KYC status tracking for booking approval

Business details:
- Brand name: RBA Bike Rentals
- Website: https://rbabikerentals.com
- Launch geography: Bengaluru, India
- Business category: bike and scooter rental
- Callback URL: https://rbabikerentals.com/api/kyc/digilocker/callback
- Redirect URL: https://rbabikerentals.com/kyc

Please share the onboarding requirements for sandbox credentials, production approval, allowed scopes, callback payload schema, pricing, compliance documents, and estimated review timeline.

Regards,  
RBA Bike Rentals

## Email 2: CIBIL Risk Signal / Credit Bureau API Access

Subject: Request for CIBIL API access for consent-based rental risk review

Hello Team,

I am contacting you on behalf of RBA Bike Rentals. We are building a Bengaluru-based bike and scooter rental platform and want to evaluate consent-based CIBIL risk signals as part of our booking review workflow.

Our intended use case:
- Customer consent captured during booking
- PAN, date of birth, mobile, and legal name submitted only after consent
- CIBIL score or risk-band signal used for admin review
- No automatic rejection solely from bureau data
- Audit trail maintained for operational review

Business details:
- Brand name: RBA Bike Rentals
- Website: https://rbabikerentals.com
- Launch geography: Bengaluru, India
- Business category: bike and scooter rental
- Data use: rental eligibility and risk review

Please share the onboarding process, API documentation, pricing, required contracts, compliance requirements, consent language requirements, production approval steps, and expected timeline.

Regards,  
RBA Bike Rentals
