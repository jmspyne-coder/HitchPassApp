# CLAUDE.md — Hitch Pass

Repo: `github.com/jmspyne-coder/HitchPassApp`. Mobile-first PWA wallet for RV campground
membership networks (Thousand Trails / Encore / ELS — **unofficial, customer-made, not
affiliated**). Jim's side project — sole proprietorship, a low-touch passive-income experiment,
legally separate from Rootwork Energy. Derived from the `hitch-pass` skill in claude.ai and
reconciled against the live repo, July 3, 2026 — if this file and a session directive conflict,
the directive wins; flag the conflict so both get patched.

## Acquisition posture (North star) — added 2026-07-05

Hitch Pass is **build-to-be-acquired**, not just monetized. Restated 2026-07-05: the target is
an exit to an ELS-level acquirer, and the core asset is the multi-network geocoded parks database
(~939+ parks across Thousand Trails, Encore, Trails Collection, Coast to Coast, and RPI), networks
that do not interoperate and cannot cheaply rebuild this. Raw user count is a weak anchor; the
database plus engagement evidence is the moat. Revenue is signal, not the goal.

North star, in priority order: database depth/coverage/quality, then the pipeline that maintains
it, then user base and engagement evidence, then feature surface. Never polish the feature surface
while the first three have open gaps. Canonical production domain is `hitchpass.vercel.app` as of
the 2026-07-10 SEO/landing directive (this supersedes the earlier 2026-07-05 note that kept
`hitch-pass-app.vercel.app` and called the flip backwards; James reversed that call in the directive,
so the flip IS now applied). `hitch-pass-app.vercel.app` remains a live alias to the same Vercel
project, so old links still resolve; all new canonical/OG/share/sitemap URLs use `hitchpass.vercel.app`.
Stripe redirect URLs in `api/*` still reference the old alias and were intentionally left untouched
(payment code is out of scope for that directive); both aliases work.

## Product facts

- Name is **Hitch Pass** (two words). "TrailHopper" is only the Asana project name — never
  letter UI, assets, or copy as TrailHopper or HitchPass.
- Pricing: free tier + Pro at $4.50/mo billed annually ($54/yr, `5400`) or $6.50/mo monthly
  (`650`).
- Support email: supporthitchpass@gmail.com. Production: `hitchpass.vercel.app`
  (auto-deploys from `main` via Vercel; `hitch-pass-app.vercel.app` is a live legacy alias).
  Never treat a preview URL as production.

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

## Product direction (updated 2026-07-07, supersedes 2026-06-29)

Strategy: free app, ad-supported, grow user base for potential acquisition by ELS (Thousand
Trails parent). No Pro tier, no subscription gating, no restrictive free tier. All features
available to all users for free.

- **AdSense:** approved in principle, pending Google account approval. A public landing page
  (`landing.html`) was built to satisfy AdSense's crawlable-content requirement. AdSense
  containers will be added in a future directive once the pub-ID is issued.
- **Tip jar:** stays as-is (one-time donations, 14-day cadence).
- **Share prompt:** 7-day cadence overlay encouraging users to share the app. Offset from
  tip jar so they never stack.
- **Pro tier / Stripe checkout:** dormant. The checkout flow, serverless functions, and
  Supabase subscriptions table remain in the codebase but are not exposed in UI. Do not
  remove — may be reactivated if strategy changes. Plan-choice screen still shows on
  onboarding; leave as-is for now (future directive may remove it).
- **Growth channels:** organic Facebook posting, Reddit, SEO landing page, in-app share
  mechanic. Paid ads may follow once AdSense revenue offsets cost.

## Known bugs / open work

- **Webhook race (mitigated, not deleted):** `customer.subscription.created` can overwrite an
  `active` status with `incomplete`. On the normal return path this is neutralized by
  `confirm-checkout.js`, which reconciles Stripe→Supabase synchronously before the app reads
  entitlement. Treat the raw webhook ordering as still fragile — any webhook change must address
  or explicitly preserve-and-note this race.
- **SHELVED — restrictive-free-tier monetization spec:** a spec proposing Free = demo mode
  (no cross-session persistence), a persistent upgrade banner, a blurred Perks tab with Pro
  badge, and killing the giveaway path is **permanently shelved**. The 2026-07-07 direction
  (free, ad-supported, no gating — see Product direction above) settles this: the restrictive
  free tier is not coming back. Note the split from AdSense: the shelved spec gated Free users
  behind ads-plus-limits; the current plan runs ads across a fully free app with no limits. The
  11 existing beta "Pro" accounts are honored regardless.

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

## Transferability Standard (added 2026-07-05)

Hitch Pass must be handoff-ready: a competent acquirer IT team should run it without Jim by end
of week one. Transfer friction is deal friction and prices directly into any deal. Test every
build decision against "does this make the handoff harder?" (Origin: AA World Services acquiring
the Everything AA app and immediately changing its features. Acquirers modify what they buy.)

Standing rules:

1. **Substrate over surface.** Priority: (a) parks database depth/coverage/quality, (b) the
   pipeline that maintains it, (c) user base and engagement evidence, (d) feature surface, in
   that order. Acquirers keep a through c and rebuild d. Never polish d while a through c have gaps.
2. **Feature-flag anything an acquirer would change.** Monetization gating, ads, tier limits,
   branding are config flags, never hard-coded logic. Governs monetization work regardless of the
   free-tier decision.
3. **Boring stack is a protected asset.** Vanilla JS + Supabase + Vercel + Stripe, precisely
   because any competent IT team can absorb it. Sophistication goes in the data, not the code.
4. **Docs ship with code.** Every directive touching Hitch Pass updates the Transfer Packet as an
   in-scope step, not a follow-up.
5. **No founder-in-the-loop dependencies.** Nothing operational may require Jim's personal
   accounts, memory, or manual intervention. Where it does, log it as transfer debt.

The Transfer Packet (lives in the HitchPass Drive folder; the artifact a buyer's IT lead reads):

- Architecture one-pager: stack, data flow, hosting, auth, payments.
- Runbook: deploy, rollback, env vars, secrets inventory, account handoff (Vercel, Supabase
  `rhqnsjnmlrshrifewxtr`, Stripe, domain `hitchpass.vercel.app`, legacy alias `hitch-pass-app.vercel.app`).
- Data dictionary: parks database schema, sources, update pipeline, quality notes.
- Cost-to-operate sheet: every service, tier, monthly cost.
- Admin guide: user management, subscription states, webhook behavior, known issues.
- Transfer-debt log: anything founder-dependent, with remediation notes.

Acceptance test: a competent IT generalist with no prior context can deploy from scratch and
answer "what breaks if X goes down" from the packet alone.

## Posting Campaign Protocol (added 2026-07-05)

Organic outreach runs as a repeatable protocol, not one-off posts. Three rounds have run
(9 groups logged). Tracker: Google Drive sheet `1FsijZGfK4lxZWUKTp5ZvgNuTalYsGaRwwWzlPV-lPOw`.
Any session can run a round from this section plus the tracker.

Rules per round:

1. Variant E is the canonical post copy.
2. Link goes in the first comment, never the post body.
3. Canary rule: post to one group first, wait for the engagement pass before continuing.
4. Space groups 15 to 20 minutes apart.
5. Run a per-group duplicate scan before posting (never repeat a logged group).
6. Log each group to the tracker with an engagement-pass approval before the next.
7. Read each group's own rules first (see GROWTH.md channel notes and the not-affiliated
   disclaimer).

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
  `hitchpass.vercel.app` (legacy alias `hitch-pass-app.vercel.app` still resolves); a preview
  deploy is not production and must be labeled.

## Jim's standing 2-minute smoke script (use as the manual test baseline)
Hard-refresh production → login → walk all six tabs → add a membership card → reload →
confirm persistence matches the account's tier → tap upgrade and confirm it reaches Stripe
checkout (do not complete payment). Any step failing = session not done.
