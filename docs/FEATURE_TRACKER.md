# Platform Feature Tracker

This document tracks requested features, missing items, and next steps for the Rbabikerentals platform.

## P0: Launch-Critical Features

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Policy Transparency Module | Done | Karteek / AI | UI implemented on checkout page |
| Doorstep Delivery Toggle | Done | Karteek / AI | UI implemented on checkout page; API logic still needs final policy rules |
| Razorpay Test Flow | Pending | Jagadeep / Karteek | Add test keys to `.env.local` and verify order/webhook/refund flow |
| Setu DigiLocker Test Flow | Pending | Jagadeep / Karteek | Waiting on Setu sandbox keys |
| Google Sign-In | Pending | Karteek / AI | Code added; waiting on Google Client ID/Secret |
| Mobile OTP Sign-In | Pending | Karteek / AI | UI and Better Auth plugin added; production SMS/WhatsApp sender still required |
| Real Offers / Promo Engine | Backlog | TBD | Requires admin UI to create coupons and API validation |
| Subscription Productization | Backlog | TBD | Requires subscription entity and autopay mandates |

## P1: High-Impact Next Items

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Referral and Wallet Loops | Backlog | TBD | Issuance, reward ledger, expiry |
| Partner Supply Onboarding | Backlog | TBD | Admin flow to invite/onboard partners |
| Hub/Coverage Intelligence | Backlog | TBD | Nearest pickup hub view with live stock |

## Data and ML Future Scope

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Dynamic Pricing Engine | Backlog | Karteek | Python FastAPI service for demand-aware pricing |
| Analytics ETL Pipeline | Backlog | Karteek | Partner payouts and utilization metrics |
| Predictive Maintenance | Backlog | Karteek | ML model using live tracking telemetry |
