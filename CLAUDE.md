# CLAUDE.md — Hitch Pass

Repo: `github.com/jmspyne-coder/HitchPassApp`. Mobile-first PWA wallet for RV campground
membership networks (Thousand Trails / Encore / ELS — **unofficial, customer-made, not
affiliated**). Jim's side project — sole proprietorship, a low-touch passive-income experiment,
legally separate from Rootwork Energy. Derived from the `hitch-pass` skill in claude.ai and
reconciled against the live repo, July 3, 2026 — if this file and a session directive conflict,
the directive wins; flag the conflict so both get patched.

## Product facts

- Name is **Hitch Pass** (two words). "TrailHopper" is only the Asana project name — never
  letter UI, assets, or copy as TrailHopper or HitchPass.
- Pricing: free tier + Pro at $4.50/mo billed annually ($54/yr, `5400`) or $6.50/mo monthly
  (`650`).
- Support email: supporthitchpass@gmail.com. Production: `hitch-pass-app.vercel.app`
  (auto-deploys from `main` via Vercel). Never treat a preview URL as production.

## Architecture

- Single self-contained `index.html`, vanilla JS, six-tab navigation, no build step. Client
  persistence: localStorage key `hitchpass.v1`.
- Vercel serverless functions in `api/`: `create-checkout.js` (starts Stripe Checkout),
  `confirm-checkout.js` (server-verifies the session on return, reconciles Stripe→Supabase
  synchronously), `stripe-webhook.js` (upserts `subscriptions` on checkout/sub events),
  `create-portal-session.js` (Stripe Customer Portal self-serve cancel/manage), `tip.js` (tip
  jar), `claim-invite.js` (`?invite=CODE` launch comps), and push plumbing (`push-register.js`,
  `cron-push.js`).
- Supabase project `rhqnsjnmlrshrifewxtr`: email+password auth, email-confirm OFF (magic links
  were abandoned — do not reintroduce); `public.subscriptions` table with RLS (`user_id` uuid PK
  FK auth.users, `status`, `stripe_subscription_id`, `stripe_customer_id`, `current_period_end`,
  `updated_at`). Client computes `isPro`/entitlement from the subscriptions row, re-checked on
  focus and via realtime.
- Stripe. Serverless functions handle checkout + webhooks.
- Service worker versioned (`hitchpass-v12` as of July 3, 2026) — BUMP the cache version on any
  cache-relevant change or users get stale builds.
- Full-screen login front door (replaced the legacy "hitch" passcode gate) → Free/Pro
  plan-choice screen → app.

## Product direction (decided 2026-06-29, still current)

The Free tier stays **freemium**: limited features but data persists and **no ads**. A "demo
mode" that wipes the wallet each session, plus in-app ads, was proposed in a monetization
directive and **rejected** by Jim. Reason: don't degrade a working free experience to chase early
income. Grow via outreach instead. The tip jar (one-time donation via `/api/tip`, shown once per
14 days) fits this: it asks, it doesn't punish. The `?invite=CODE` launch comps stay. **Don't
re-propose demo-mode or ads** unless Jim reverses this in a session directive.

## Known bugs / open work

- **Webhook race (mitigated, not deleted):** `customer.subscription.created` can overwrite an
  `active` status with `incomplete`. On the normal return path this is neutralized by
  `confirm-checkout.js`, which reconciles Stripe→Supabase synchronously before the app reads
  entitlement. Treat the raw webhook ordering as still fragile — any webhook change must address
  or explicitly preserve-and-note this race.
- **SUPERSEDED — restrictive-free-tier monetization spec:** a spec proposing Free = demo mode
  (no cross-session persistence), a persistent upgrade banner, a blurred Perks tab with Pro
  badge, AdSense containers for Free users, and killing the giveaway path was written but is
  **superseded by the 2026-06-29 freemium decision above**. Do not implement without an explicit
  new directive from Jim reversing that decision. Honor the 11 existing beta "Pro" accounts
  regardless.

## QA harness

`C:\Users\jmspy\hitchpass-qa\` — scripts that drive the live site: `run-suite.mjs`, `run-pay.mjs`,
`run-monthly.mjs`, `run-downgrade.mjs`, `run-cancel-check.mjs`, `run-portal.mjs`. Outputs:
`lastrun.json` (pay-flow trace + RESULT_JSON), `dg.out`, screenshots. Test accounts use
`hitchpassqa+<ts>@gmail.com`. Stripe test card `4242 4242 4242 4242` exp `12/34` CVC `123`
ZIP `42424`.

## Conventions

- Deliver COMPLETE files, never snippets or diffs. One directive document per task with exact
  paths and success criteria.
- Cost ceiling ~zero: Vercel/Supabase/Stripe free-tier posture. Flag anything recurring.
- Jim handles all git pushes and dashboard actions unless a session says otherwise. He sets true
  secrets himself via `printf '<val>' | vercel env add <NAME> production`; never hardcode keys.
- Stripe mode trap: confirm `livemode` matches intent before creating products/prices/webhooks.
  A reconnected connector needs a fresh session to re-handshake.
- Product corrections from Jim are immediate redirects — implement, don't re-litigate.
- Keep Hitch Pass and Rootwork fully separate (entities, accounts, branding). If Rootwork's
  EIN is found on any Hitch Pass service account, flag it as a cleanup item.

---

# SESSION CONTROLS (mandatory — these exist because simple tasks were taking hours)

## Before writing any code
1. Restate the task in one sentence and list every file you will touch.
2. **Ambiguity gate — one batch, up front.** Ask BEFORE building when the question touches:
   product behavior, money or data paths (Stripe, orders, DB writes), deleting anything,
   deploy/schedule changes. Proceed WITHOUT asking on cosmetic/internal calls (naming, styling,
   internal structure) — state the assumption inline instead. Never drip questions one at a
   time across a session, and never guess on the ask-first categories.
3. **Scope lock.** Touch ONLY the listed files. No opportunistic refactors of working code.
   Adjacent breakage gets reported, not fixed unprompted.

## Definition of done (nothing is "done" without proof)
- Every completion claim ships with pasted verification output. "Should work" is not a status.
- File-change claims: show the changed hunk or diff, plus `ls -la` timestamps. Standing
  lesson: stale files were once reported as fixed and it cost a full session.
- Run this repo's validation gates (below) and paste the results before reporting done.

## End-of-session report (always exactly this format)
1. Changed files, one line each
2. Verification output — pasted, not summarized
3. **Manual test script for Jim**: exact URL or command, exact steps, expected result per
   step. Two minutes max to execute. If it can't be tested in two minutes, say what to test
   first and why.
4. Assumptions made (from the ambiguity gate)
5. Rollback: the exact git command(s) to undo this session

## Validation gates — this repo
- JS syntax gate on the inline script before any deploy claim (extract and `node --check`, or
  equivalent parse verification); paste the result.
- **Service worker bump gate:** if ANY cached asset changed, `hitchpass-vN` increments. Verify
  with grep and paste the version line. A missed bump means users see stale builds and the
  session's work looks broken.
- localStorage key stays `hitchpass.v1` unless the change includes migration code for
  existing users' data.
- Stripe is LIVE-capable: any change to checkout, webhook, or subscription logic is ask-first,
  and the manual test script must not require a real charge — use Stripe's test tooling or
  hand Jim the pre-deploy verification steps explicitly.
- Webhook logic changes must address or explicitly preserve-and-note the known race
  (`customer.subscription.created` overwriting `active` with `incomplete`).
- State WHICH URL the report's claims were verified against. Production is
  `hitch-pass-app.vercel.app`; a preview deploy is not production and must be labeled.

## Jim's standing 2-minute smoke script (use as the manual test baseline)
Hard-refresh production → login → walk all six tabs → add a membership card → reload →
confirm persistence matches the account's tier → tap upgrade and confirm it reaches Stripe
checkout (do not complete payment). Any step failing = session not done.
