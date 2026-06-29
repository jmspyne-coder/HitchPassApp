# Hitch Pass — Project Instructions

## What This Is
Hitch Pass is a paid web app (membership/perks for Thousand Trails / Encore / ELS RV campers —
**unofficial, customer-made, not affiliated**). Goal: a sellable, live, paid web app.
Live at **https://hitch-pass-app.vercel.app/**.

**Nature of the project:** this is Jim's **passive-income experiment** — a low-touch test of whether a
small paid web app can earn on its own. It's deliberately separate from the REMS Group BESS work
(that's the day job). Treat it as a lean, ship-it side project: bias toward simple, self-serve,
low-maintenance solutions over anything that needs ongoing hand-holding. Framing has shifted before —
Jim is iterating on the concept with claude.ai chat in parallel, so re-confirm scope if it feels stale.

## Stack (verified)
- **Frontend** — a single static `index.html` (~287KB, all UI/logic inline) + `sw.js` service worker, PWA manifest, icons. No build step.
- **Backend** — Vercel serverless functions in `api/`:
  - `create-checkout.js` — starts Stripe Checkout (annual/monthly price)
  - `confirm-checkout.js` — server-verifies the session on return, reconciles Stripe→Supabase synchronously (kills webhook race)
  - `stripe-webhook.js` — upserts `subscriptions` on checkout/sub events
  - `create-portal-session.js` — Stripe Customer Portal (self-serve cancel/manage)
- **Auth + DB** — Supabase project `rhqnsjnmlrshrifewxtr`. Email+password (email-confirm is OFF). `public.subscriptions` table (RLS on): `user_id` (uuid PK, FK auth.users), `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `updated_at`.
- **Billing** — Stripe. Pro = $54/yr (5400) or $6.50/mo (650). Entitlement (`isPaid`/Pro gating) is derived from the `subscriptions` row, re-checked on focus + via realtime.
- **Tooling available** — authenticated Vercel CLI (project linked), live Supabase + Stripe MCP.

## Status — verified 2026-06-15
**Functionally working end-to-end in Stripe TEST mode; NOT yet cut over to LIVE (cannot take real money yet).**

- ✅ Full paid flow passes in QA: signup → plan → Stripe Checkout (test card) → return → `confirm-checkout` → subscription row → app flips to PRO (~2s). Result `PRO_FLIP_SUCCESS`.
- ✅ Cancel/downgrade held PRO correctly (no false free-flip over 160s). Self-serve portal shipped (commit `26edbea`).
- ✅ Legal pages exist: privacy, terms, refund policy, subscription-compliance-notes.
- ⚠️ **Release gate = Stripe test→live cutover.** Set live values in Vercel **production**:
  `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_MONTHLY`, `STRIPE_WEBHOOK_SECRET`
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` already set). Then redeploy + one live-card smoke test.
- ⚠️ Keep repo == deployed: commit pending changes before claiming release.

## QA harness
`C:\Users\jmspy\hitchpass-qa\` — Playwright-style scripts that drive the live site:
`run-suite.mjs`, `run-pay.mjs`, `run-monthly.mjs`, `run-downgrade.mjs`, `run-cancel-check.mjs`, `run-portal.mjs`.
Outputs: `lastrun.json` (full pay-flow trace + RESULT_JSON), `dg.out` (downgrade trail), screenshots (`prepay.png`, `final.png`).
Test accounts use `hitchpassqa+<ts>@gmail.com`. Test card `4242 4242 4242 4242` exp `12/34` CVC `123` ZIP `42424`.

## Key files / docs
- `hitchpass-handover-addendum.md` — verified state delta (env wiring, Stripe live-vs-test handshake gotcha)
- `STRIPE-SETUP.md`, `subscription-compliance-notes.md`, `TEST_PLAN.md`
- `tools/` — park dataset generation (`gen_parks.py`, `parks.js`, geocode cache); `recon/` — scraping scripts
- More directives in `C:\Users\jmspy\Downloads\hitchpass-*.md` (phase/job directives, perks, region filter, deploy verify)

## Product direction (decided 2026-06-29)
The Free tier stays **freemium**: limited features but data persists and **no ads**. A "demo mode"
that wipes the wallet each session, plus in-app ads, was proposed in a monetization directive and
**rejected** by Jim. Reason: don't degrade a working free experience to chase early income. Grow via
outreach instead. The tip jar (one-time donation, `/api/tip`, shown once per 14 days) fits this: it
asks, it doesn't punish. The `?invite=CODE` launch comps stay. Don't re-propose demo-mode or ads.

## Conventions
- Env-driven secrets only — never hardcode keys. James sets true secrets himself via `printf '<val>' | vercel env add <NAME> production`.
- Stripe mode trap: confirm `retrieve_balance` → `livemode` matches intent before creating products/prices/webhooks. A reconnected connector needs a fresh session to re-handshake.
- This is a **separate project from the REMS Group BESS workspace** — different repo, different domain. Don't mix the two.
