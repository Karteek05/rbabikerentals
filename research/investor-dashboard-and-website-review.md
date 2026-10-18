# Investor dashboard and website improvement review

## Scope and limits

This report records the source/document review and repository-owned fixes to the Next.js app, product requirements, launch checklists, and public primary sources. It is not a live production, provider, legal, deployment, or runtime validation. No credentials, deployments, or customer data were accessed. Tests/build and local server startup were not run because no OS-enforced sandbox is available; the production Vercel logs remain unavailable because the former project account is inaccessible.

## Investor dashboard decisions

1. **Keep operational booking figures, but define what they mean.** The service filters the selected week and monthly totals on `booking.created_at`, and sums `quote.total_payable` for paid-status bookings. Those values are not accounting revenue, net income, or an investor distribution. IFRS 15 describes revenue in relation to performance obligations and when promised goods or services are transferred; the dashboard must not relabel booking value as recognized revenue. Source: [IFRS 15, paragraphs 2 and 31](https://www.ifrs.org/content/dam/ifrs/publications/html-standards/english/2026/issued/ifrs15.html).

2. **Separate period and lifecycle.** Show the selected week on the weekly KPIs and identify booking creation date as the basis. Keep all-time totals in their own section. Separate paid-status, completed, and pending-review/payment amounts; pending quotes are not cash collected. The SEC's KPI guidance recommends defining metrics, explaining why they are useful, describing management use, and disclosing assumptions where needed to prevent misleading presentation. That guidance is a design reference here, not a claim that SEC rules govern this business. Source: [SEC Release 33-10751](https://www.sec.gov/files/rules/interp/2020/33-10751.pdf).

3. **Do not show ROI, yield, profit, or payout until there is a defined ledger and business rule.** The current service has booking totals, not investor contributions, costs, settlement reconciliation, or payout rules. The PRD specifies booking-, vehicle-, and period-wise reporting, but not payout calculations (`docs/PRD.md`, §4.2, lines 73-93; `docs/FEATURE_TRACKER.md`, lines 26-32).

4. **Treat utilization as a later metric with an agreed formula.** Vehicle count and tracking status do not establish utilization. Define the denominator (available hours/days, downtime, maintenance blocks, and fleet included) before adding a utilization percentage. DOE FEMP fleet guidance recommends utilization studies to understand the mission and use of assets; fleet KPI guidance also highlights utilization, downtime, maintenance, cost, and compliance. Sources: [DOE FEMP fleet-management principles](https://www.energy.gov/cmei/femp/articles/federal-best-practices-core-principles-sustainable-fleet-management), [Fleetio fleet KPI guide](https://www.fleetio.com/blog/fleet-management-kpis).

5. **Make the tracking snapshot actionable without implying it is investment performance.** The current status breakdown is vehicle location state (`idle`, `halt`, `running`, `waiting`), not financial performance. Link it to live tracking; retain the vehicle-level booking table and add a compact month trend. PRD evidence: `docs/PRD.md`, lines 27-31 and 73-90.

## Implemented in this pass

- Investor reporting now interprets calendar dates, weekday counts, week starts, and month totals in `Asia/Kolkata`. The selected end date is inclusive through the local day's final millisecond. Regression cases cover a Bengaluru day boundary and a UTC-to-IST month boundary.
- Checkout now fails closed with `503` when Razorpay is not configured. Removed the untracked UPI fallback, third-party QR image request, and UPI intent. Payment creation is rate-limited, and a regression case confirms no payment order is created without Razorpay.
- Added rate limits to payment order, KYC start/status/read/callback, and internal job/tracking endpoints. The schema removes rate-limit records older than 24 hours.
- Production vehicle document and image uploads no longer use instance-local storage. Document files use a private Supabase bucket; images use the configured public bucket. Supabase read errors no longer fall through to a local copy.
- Added regression cases for cross-customer payment-order rejection, invalid Setu callback secrets, and invalid booking duration windows. These tests and the full suite have not been run in this environment.
- Updated `.env.example`, launch checklists, and the implementation-status page. Removed broken absolute Windows links and old UPI fallback instructions.

## Remaining website work list

### P0: Required before production launch

- **Restore deployment ownership and build visibility.** GitHub's latest known `main` commit had a failed Vercel status; the former Vercel account is inaccessible. Choose a host/account the business controls, configure its project and domain, then inspect that host's build logs. The build failure cause remains unknown.
- **Complete staging/UAT with authorized test identities and provider sandboxes.** Apply `db/schema.sql` to the real Supabase project, validate RLS and the new rate-limit cleanup, then exercise booking, payment/webhook/refund, Setu consent/callback/status/manual review, storage privacy, and role-owned visibility. No production credentials or provider project were accessed.
- **Run the updated checks.** Typecheck/build and test suite remain unrun here; the regression tests are source changes, not pass evidence. The user's requested UI test also requires a local runtime, which could not be started without an OS-enforced sandbox.
- **Finish real provider setup.** Setu callback payload/configuration, Razorpay live keys/webhook, SMTP, Maps, Supabase buckets, migrations, and `JOB_SECRET` require account-owner credentials and provider-side configuration.

### P1: Payments, access, and operations

- **Implement payment-order idempotency and reconciliation.** Existing open-order reuse and the database uniqueness constraint do not prevent concurrent provider order creation from leaving an orphaned external order. No provider idempotency contract was assumed.
- **Add database-backed concurrent booking/extension race tests.** The application checks overlap, but production concurrency guarantees need validation against the configured database.
- **Verify Better Auth sign-in, email OTP, and password-reset rate limits** in the selected production setup; the added route-specific throttles do not cover those provider-managed endpoints.
- **Wire document-expiry, incident-escalation, and booking-lifecycle jobs to the selected host's scheduler.** A deployment host and execution cadence are not selected. Add alerting for failed webhooks, KYC manual-review spikes, booking conflicts, and job failures; add safe webhook replay tooling.
- **Set retention/deletion rules for KYC-related metadata** with the business/legal owner. Vehicle document cleanup is already handled by the existing cleanup queue and job; KYC retention is a separate policy.

### P2: Product decisions and polish

- **Define investor payout/return rules before adding ROI, yield, profit, or payout figures.** The current data supports gross booking totals only, not contributions, costs, settlements, or distributions. Also define utilization's denominator before showing a utilization percentage.
- **Prioritize the explicit product backlog after launch gates.** Offers/coupons, subscription/autopay, referral/wallet, partner supply onboarding, coverage intelligence, dynamic pricing, and predictive maintenance need owners, acceptance criteria, and business rules.

## REA tool note

The official [REA setup guide](https://github.com/us-oyster/rea/blob/main/docs/installation.md) describes `npx rea-agents@latest setup` as configuring an agent's REA MCP registration and bundled reverse-engineering workflow. The guide lists `analyze-javascript-application` as a separate static-analysis command. I inspected these instructions but did not execute `npx`: setup changes local agent configuration and downloads/runs a third-party package; this environment does not provide the required OS-enforced sandbox. The repository review and UI work used source inspection instead.
