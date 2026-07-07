# SEO & Production Launch Checklist

Last updated: July 8, 2026

Use this alongside `docs/PRODUCTION_HARDENING.md` and `docs/STAGING_UAT_CHECKLIST.md`.

---

## Part 1 — Get indexed on Google (Bangalore / Bengaluru bike rentals)

Ranking for **"bike rental bangalore"** needs both **technical SEO** (in code) and **off-site/local signals** (manual setup). Code alone is not enough.

### A. Already in the codebase

- `src/app/robots.ts` — tells crawlers what to index
- `src/app/sitemap.xml` — auto-generated from public routes
- Root metadata — title, description, Open Graph, Twitter cards
- `LocalBusinessJsonLd` — structured data for Bengaluru scooter/bike rental
- Browse page metadata — scooter rental keywords for `/browse`

Set this in production:

```env
NEXT_PUBLIC_SITE_URL=https://www.rbabikerentals.com
BETTER_AUTH_URL=https://www.rbabikerentals.com
```

### B. Manual steps (required for Google visibility)

#### 1. Google Search Console
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://www.rbabikerentals.com`
3. Verify via DNS TXT record (recommended) or HTML file
4. Submit sitemap: `https://www.rbabikerentals.com/sitemap.xml`
5. Use **URL Inspection** → **Request indexing** for:
   - `/`
   - `/browse`
   - `/book/veh_001`, `/book/veh_002`, `/book/veh_003`
   - `/faq`, `/about`, `/contact`

#### 2. Google Business Profile (critical for local search)
This is often **more important than on-page SEO** for "bike rental near me" / city searches.

1. Create/claim profile: [Google Business](https://business.google.com)
2. Business name: **RBA Bike Rentals**
3. Category: **Motorcycle rental agency** or **Scooter rental service**
4. Service area: **Bengaluru** (list neighborhoods you serve: Sarjapur Road, etc.)
5. Add phone, website, hours, photos of fleet
6. Post weekly updates (offers, new scooters)
7. Ask happy customers for Google reviews (reviews strongly affect local rank)

#### 3. Bing Webmaster Tools (optional but easy)
- Add site + submit same sitemap at [Bing Webmaster](https://www.bing.com/webmasters)

#### 4. Consistent NAP (Name, Address, Phone)
Use the **same** business name, address area, and phone everywhere:
- Website footer
- Google Business Profile
- Instagram / WhatsApp business
- Justdial / Sulekha listings (if used)

Inconsistent details hurt local SEO.

### C. Content & keyword recommendations

Target phrases naturally in visible page copy (not keyword stuffing):

| Priority keywords | Where to use |
|-------------------|--------------|
| bike rental bangalore / bengaluru | Homepage H1, about, meta |
| scooter rental bangalore | Browse page, vehicle pages |
| activa rental bangalore | Activa book page |
| monthly bike rental bengaluru | Homepage plans section |
| two wheeler rental sarjapur | Contact / locations |

**Homepage note:** The homepage is currently a client component (`"use client"`). Crawlers still see the HTML shell, but for stronger SEO consider splitting it into a server page + client sections so key headings and copy are server-rendered.

### D. SEO improvements to do next (code)

| Item | Why |
|------|-----|
| Per-vehicle book page metadata | Rank for "Activa rental Bangalore" etc. |
| FAQ schema (`FAQPage` JSON-LD) on `/faq` | Rich results in Google |
| `og:image` social preview image | Better click-through from shares |
| Location landing pages | e.g. `/bike-rental-sarjapur` if you expand hubs |
| Blog/guides | "Monthly scooter rental Bangalore — what to know" |
| Core Web Vitals pass | Speed affects ranking; test with PageSpeed Insights |

### E. What NOT to expect

- Indexing usually takes **days to a few weeks**, not hours
- Ranking on page 1 for "bike rental bangalore" is competitive — incumbents (Rapido Rento, ONN, local shops) have authority
- Paid ads (Google Ads) can bring traffic while organic SEO builds

---

## Part 2 — Production launch checklist

### Infrastructure
- [ ] `APP_ENV=production` on Render/Vercel
- [ ] Custom domain `www.rbabikerentals.com` with HTTPS
- [ ] `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` set to production URL
- [ ] Supabase production project (not dev DB)
- [ ] Run `npm run migrate` on production DB
- [ ] **Do not** run seed in production unless intentional

### Auth & security
- [ ] `BETTER_AUTH_SECRET` — strong random secret
- [ ] `ALLOW_DEV_HEADERS=false`
- [ ] Google OAuth redirect URIs include production domain
- [ ] All webhook secrets configured (Razorpay, Setu DigiLocker)
- [ ] `JOB_SECRET` set for internal cron/tracking endpoints

### Payments
- [ ] Razorpay live keys (not test) in production
- [ ] Webhook URL: `https://www.rbabikerentals.com/api/webhooks/razorpay`
- [ ] Test full flow: approve booking → pay → webhook → confirmed
- [ ] UPI fallback / `NEXT_PUBLIC_UPI_ID` if used

### KYC & email
- [ ] Setu DigiLocker production credentials
- [ ] SMTP sending works (`EMAIL_FROM`, `ADMIN_EMAIL`)
- [ ] Test booking confirmation + payment emails

### Operations
- [ ] Admin accounts on `@rbabikerentals.com`
- [ ] Fleet data matches live inventory (rates, images, stock)
- [ ] Document expiry job scheduled (`npm run job:documents`)
- [ ] Incident escalation job scheduled

### Monitoring
- [ ] Error logging (Sentry / Render logs / similar)
- [ ] Uptime monitor on `/` and `/api/health` (add health route if missing)
- [ ] Alert on failed Razorpay webhooks
- [ ] Weekly check: Search Console coverage + Core Web Vitals

### Legal & trust
- [ ] Terms, Privacy, Cookies pages live and linked in footer
- [ ] GSTIN on invoices/receipts if applicable
- [ ] Refund/cancellation policy matches actual engine rules

### Pre-launch smoke test (30 min)
1. Browse fleet → book → sign in → submit booking
2. Admin approves → customer pays → booking confirmed
3. Cancel flow + refund path (admin)
4. KYC start → callback (staging first)
5. Mobile checkout on real phone

---

## Quick post-deploy SEO verification

```bash
# Should return Allow rules + sitemap URL
curl https://www.rbabikerentals.com/robots.txt

# Should list public pages
curl https://www.rbabikerentals.com/sitemap.xml
```

In browser DevTools → View Page Source on homepage:
- Confirm `<title>` contains "Bengaluru" / "Bangalore"
- Confirm JSON-LD `AutoRental` script is present
- Confirm canonical URL is correct
