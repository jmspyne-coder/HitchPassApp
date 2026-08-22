# Hitch Pass — Polish Spec

Directive: `DIRECTIVE 2026-08-21-polish-hitch-pass`. Review target: `https://hitchpass.app`
(production, live at review time — same content as `hitchpass.vercel.app`). Reviewed 2026-08-22.
Viewports: mobile 390×844 (primary), desktop 1440×900 (secondary). Every finding below is backed
by a screenshot in `design/screenshots/before/{mobile,desktop}/` — filenames are cited inline.
Grading categories per the DESIGN file: visual hierarchy, typography, spacing/rhythm, color
discipline, empty states, loading/progress states, error copy, mobile behavior, identity basics,
first-30-seconds cold read.

**Standing constraint this round:** this session's Gate-0 (the merge-gate agent bootstrap) is
unavailable — see close-out report for detail. The three items marked **BUILT** below are
implemented and verified with before/after screenshots on a local server running this branch, but
are **not merged and not deployed to prod**. Everything else is spec only — ranked backlog for a
future round.

---

## Severity legend

- **HIGH** — actively damages the first-30-seconds cold read or contradicts the product's own
  stated behavior/documentation.
- **MEDIUM** — visible, credibility-costing, but doesn't block or mislead.
- **LOW** — polish; fix opportunistically.

---

## HIGH-1 — App has no desktop layout (spec only)

**Category:** visual hierarchy, mobile/desktop behavior, first-30-seconds cold read
**Screens:** every app tab at desktop viewport (`before/desktop/tab-*.png`)
**Evidence:** `before/desktop/tab-home.png` — a ~660px mobile-width column floats in the center of
a 1440px viewport with plain cream background on both sides. The bottom nav bar sits directly under
the content rather than pinned to the viewport edge, leaving a large dead band beneath it before
the page ends.

The `/welcome` marketing page (`landing.html`) genuinely reflows for desktop — full-width hero,
multi-column feature grid, works well (`before/desktop/01-welcome-landing.png`). The app itself
(`index.html`) does not; it is a fixed mobile-width column with no desktop breakpoint anywhere in
its ~40-line inline `<style>` block.

**Why it matters:** the directive frames Hitch Pass as build-to-be-acquired, graded in ten seconds
by an acquirer or a Facebook-group skeptic. An acquirer's first look is as likely to be a laptop as
a phone. A centered mobile column on a wide screen reads as an unfinished demo, not a product.

**Recommendation:** this is a structural layout project, not a spot-fix — nearly every screen is
built from inline `position`/`width` strings with no CSS variables (see MEDIUM-4). Two viable paths,
ranked by cost: (a) cap the mobile column's width, keep single-column content, but give desktop a
purpose-built surrounding treatment (subtle branded background, pinned nav) — low-risk, ~1 round;
(b) real responsive breakpoints (multi-column Explore grid, wider Perks table, etc.) — high-value,
multi-round, touches every view. Recommend (a) as the next round's top item, (b) as longer-term
backlog. **Not built this round** — sizing this correctly needs its own round, and Gate-0 being down
means nothing built this round can be proven on prod anyway.

---

## HIGH-2 — Tip-jar and share overlays fire on a zero-day-old account — BUILT

**Category:** empty states, error/interruption timing, first-30-seconds cold read
**Screens:** every tab, first session after signup
**Evidence (before):** `before/mobile/03-post-signup-RAW-with-overlay.png` (tip jar, "Enjoying
Hitch Pass?", appears seconds after account creation) and `before/mobile/tab-home.png` (share
prompt, "Know someone who'd use this?", appears on the very first nav tap after dismissing the tip
jar).
**Evidence (after):** `after/mobile/03-post-signup-RAW-with-overlay.png`,
`after/mobile/tab-home.png` — clean, no overlay.

**Root cause:** `tipDue()` and `shareDue()` (`index.html`, tip-jar/share-prompt section) both read
"never shown before" as license to show *immediately*: `!(last > 0) || (Date.now()-last) >=
INTERVAL`. CLAUDE.md documents these as a "14-day cadence" and a "7-day cadence... offset from the
tip jar," which only describes the gap between repeat showings — there was no floor on the very
first one. Every brand-new signup got asked for money, then asked to recruit friends, before doing
anything else in the app.

**Fix (built):** added a 3-day first-use grace period, anchored to a new `hitchpass.firstSeen`
localStorage timestamp stamped on first check. `tipDue()`/`shareDue()` apply the grace period only
to the never-shown-before case (`!(last>0)`); an existing user already mid-cadence (has a prior
`*LastShown` timestamp) keeps their original interval check unaffected — verified by simulating a
20-day-overdue existing user with no `firstSeen` key (predates this deploy) and confirming the
prompt still fires normally rather than being newly delayed. This is a bug fix against the
product's own documented intent, not a new product decision — the 3-day figure is my assumption
(no grace period was specified anywhere); flag if a different number is wanted.

**Diff:** `index.html`, ~20 new lines (helper functions) + 2 one-line changes to `tipDue()`/
`shareDue()`. `git diff --stat`: see close-out report.

---

## HIGH-3 — The "empty state" is not empty; the real empty state is unreachable (spec only)

**Category:** empty states, color/data discipline, first-30-seconds cold read
**Screens:** Home (`before/mobile/tab-home.png` / `05-wallet-home-empty.png`)
**Evidence:** `index.html` — `wallet: saved.wallet || ["tt","enc"]` defaults every brand-new
signup into a populated wallet. The two hero stat tiles reading "82 / Thousand Trails" and "72 /
Trails Collection · Encore" are **not the user's data** — they're hardcoded network park-count
totals (`NETWORKS.tt.count`, `NETWORKS.enc.count`), verified against `parks.data.json` (82 + 72 =
154, matching the "Explore parks · 154 locations" tile). They render in the exact visual slot a
user reads as "my stuff." The code path for a genuinely empty wallet exists (`"No cards yet — add
them in Profile"`) but is dead in the live product — no signup reaches it.

**Why it matters:** the directive explicitly calls out "the new-user empty state (first impression
for nearly everyone)" — 2 of 63 active users are not new, so this *is* the first-run experience for
practically the entire funnel, and it's currently showing fabricated-looking familiarity ("your"
network totals) rather than an honest zero-state.

**This is a product-behavior call, not a cosmetic one — flagging per the ambiguity gate rather than
guessing:**
- Option A: change the default to a truly empty wallet (`[]`) and build out the dead empty-state
  branch into the "designed, not blank" state FL-H3 asks for (icon, one-line explanation, a
  `Add my memberships` CTA into Profile — mirroring Trips' well-built empty state, see MEDIUM-1).
- Option B: keep the pre-populated `["tt","enc"]` default (it may be deliberate — TT/Encore are the
  most common combo) but re-label the stat tiles so they can't be mistaken for personal data (e.g.
  "154 parks available across your 2 networks" as one line, not two number-first tiles).

Recommend Option A — it's what "empty state" is supposed to mean, and it's a one-line default
change plus new markup, low risk. **Not built this round**: changes what every new user sees by
default, which is squarely inside the ambiguity gate's "product behavior" category.

---

## HIGH-4 — The 21-day clock has no hero treatment anywhere in the app (spec only)

**Category:** visual hierarchy, identity/brand coherence
**Screens:** Home, Trips, Profile, Perks
**Evidence:** the phrase "21-day booking clock" is the hero of the `/welcome` marketing page
(`before/desktop/01-welcome-landing.png` — "The 21-day rule shouldn't require a spreadsheet") and
the product's stated differentiator per CLAUDE.md and the directive itself ("the 21-day clock as
the hero feature it is"). Inside the app it never gets its own surface:
- Trips tab: a small always-present text card ("On Adventure you can book TT parks up to 180 days
  ahead...") — informative but typographically identical to every other card on the screen
  (`before/mobile/tab-trips.png`).
- Profile: `Day N of 21 · depart by <date>` only when a stay is currently active — invisible
  otherwise (`before/mobile/tab-profile.png`, off-screen below the fold in this capture).
- Perks: "Days In / Days Out: 21 Days In / Park-to-Park" as one line in a dense included-benefits
  list (`before/mobile/tab-perks.png`).

**Why it matters:** a user who read the landing page's "21-day clock" hook and signs up cannot find
that feature by scanning the Home screen — it's the product's namesake and has less visual weight
than a static "Refer a friend" tile.

**Recommendation:** promote a dedicated Home hero element — a compact status card showing either
"Day N of 21 — depart by <date>" (active stay) or "No active stay — log a check-in to start your
clock" (the genuine empty case, which is the majority state and needs its own considered design,
not a placeholder). This is meaningful new UI, not a tweak — sized for its own round.
**Not built this round.**

---

## HIGH-5 — Four different "brand orange" values in production simultaneously

**Category:** color discipline, identity basics
**Screens:** all (cross-cutting)

| Hex | Where used | Evidence |
|---|---|---|
| `#E8461E` | PWA icon set, `manifest.json` background/theme color, `index.html` `<meta theme-color>` | `manifest.json`, `icon-192.png` |
| `#cf5a26` | In-app accent — active nav icon, primary buttons (`.btnP`) — what users actually see most | `before/mobile/tab-explore.png` (active "Explore" nav item) |
| `#e0875a` | Splash screen subtitle + loading spinner | splash overlay, not separately screenshotted |
| `#a8472f` | "Refer a friend" home tile, error/clay text | `before/mobile/tab-home.png` |

**Built this round:** `landing.html`'s `<meta name="theme-color">` was `#1f3d2c` (dark green) —
neither of the app's own two thematic oranges, and different from its own manifest reference.
Synced to `#E8461E` to match `manifest.json` and `index.html`, so OS chrome (address-bar tint on
mobile Safari/Chrome) is consistent between the marketing page and the installed app. One-line,
zero-risk internal-consistency fix — no new color introduced.

**Not built:** reconciling `#cf5a26` (in-app accent) vs `#E8461E` (icon/manifest) into one color is
a genuine brand decision — which orange *is* Hitch Pass — not a bug fix, and there are zero CSS
custom properties in the codebase (~40 hardcoded hex literals across a 5,653-line inline-styled
file per the scout pass), so resolving it is a wide find-and-replace, not a token edit. Flagging for
Jim's call: pick one, and budget a follow-up round to introduce CSS custom properties so this
doesn't recur.

---

## MEDIUM-1 — Refer tab: one card, then ~700px of dead space — BUILT

**Category:** spacing/rhythm, empty states
**Evidence (before):** `before/mobile/tab-refer.png` — a single "Add your salesperson's info"
prompt card, then blank cream background all the way to the footer.
**Evidence (after):** `after/mobile/tab-refer.png` — added a second "How this works" card
explaining the referral-text flow (factual, no invented incentive claims — there is no referral
reward mechanic in the code, so none is claimed). Dead space cut roughly in half; the tab now reads
as designed rather than unfinished.
**Diff:** `index.html`, `referView()` — wrapped the existing CTA in a padded container, added one
static info card matching the Share tab's existing "How to share" pattern for visual consistency.

---

## MEDIUM-2 — Stat tiles look tappable, aren't

**Category:** visual hierarchy, mobile behavior (spec only)
**Evidence:** Home's two hero stat tiles ("82 / Thousand Trails", "72 / Trails Collection ·
Encore") use the same rounded-card visual language as the four genuinely-tappable tiles below them
(Explore parks, Free in my wallet, Booking dates, Coverage & savings — all `data-act="nav"`
buttons). Tapping a stat tile does nothing; confirmed via automated click during this review
(`membership-detail.png` before/after are pixel-identical to the home screen — no navigation
occurred).
**Recommendation:** either make them tap through to a per-network detail view (aligns with the
directive's "membership detail" screen, which does not currently exist as a distinct view), or
visually de-emphasize them as data, not affordance (remove the card elevation/border they share
with real buttons). Left unbuilt — bound up with the HIGH-3 empty-state decision above (what these
tiles should even represent for a new user).

---

## MEDIUM-3 — Service worker cache was already stale — BUILT

**Category:** identity basics / PWA correctness
**Evidence:** `sw.js` was pinned at `hitchpass-v20`, cut 2026-07-11 (commit `c87ed6b`). Two
`index.html`-touching commits shipped since (`9df736a`, `3910a0d`, both the install-prompt feature)
with no cache bump — already violating CLAUDE.md's own bump gate before this directive touched
anything. This round's edits to `index.html`/`landing.html` make it a hard requirement.
**Built:** bumped `CACHE` to `hitchpass-v21` in `sw.js`. `node --check sw.js` passes.

---

## MEDIUM-4 — Zero CSS custom properties; brand is ~40 hardcoded hex literals

**Category:** color discipline (spec only, cross-cutting)
**Evidence:** `grep -- "--[a-z]" index.html landing.html` returns nothing. Colors live in a JS
object (`var C = {...}`, 8 entries) plus dozens of literal hex strings inline in concatenated JS
markup. Any brand-color change (see HIGH-5) is a wide find/replace across a 556KB single file, not
a token edit.
**Recommendation:** introduce CSS custom properties on a future round, scoped as its own change —
touches every screen's styling and is exactly the kind of large mechanical diff that should be
isolated from behavior changes. Not attempted this round (out of proportion to "surface polish").

---

## LOW-1 — Explore tab's region-filter row is a dense, ungrouped 13-pill wrap

**Category:** spacing/rhythm, visual hierarchy
**Evidence:** `before/mobile/tab-explore.png` — network pills (All/TT/Encore/DC/RPI/C2C/PA/KOA)
and region pills (All regions/Southeast/Pacific/.../Alaska/Mexico) sit in two visually identical
button rows with no heading or divider between them; regions mix true regions with "Canada 139" /
"Mexico 3" as siblings. Functional, not confusing once you scroll past it once, but first-glance
density is high. Recommend a small label ("Region") above the second row. Not built — cosmetic,
low value relative to the items above.

---

## LOW-2 — Profile's raw email can wrap awkwardly

**Category:** typography, mobile behavior
**Evidence:** `before/mobile/tab-profile.png` — "Signed in as" renders the full email in bold at
container width with no truncation; long addresses (test aliases, `+` tags) wrap mid-string. Low
frequency in practice (most real emails are shorter). Not built.

---

## LOW-3 — `apple-touch-icon` ships one size only

**Category:** identity basics / PWA
**Evidence:** `manifest.json` icon set is correct (192/512/512-maskable/svg, verified against
actual PNG dimensions). `index.html` links a single `apple-touch-icon-180.png` with no 152×152/
167×167 fallbacks. iOS auto-scales from the 180 in practice, so this is a checklist nit, not a
visible defect. Not built.

---

## PWA basics — checked, mostly pass

- **Manifest:** valid JSON, correct icon sizes verified by `file`, `display: standalone`,
  `start_url`/`scope` present. Pass.
- **Maskable icon safe zone:** visually inspected (`icon-maskable-512.png`) — mark is well within
  the safe circle for Android adaptive-icon masking. Pass.
- **Installability:** manifest + service worker + HTTPS all present; install-prompt logic
  (`maybeShowInstall()`) correctly gates on standalone-mode detection, sign-in state, and the
  same "never stack over tip/share" rule now protected by this round's grace-period fix. Pass,
  with one caveat below.
- **Caveat — can't verify the install sheet visually:** `deferredInstall` (Android
  `beforeinstallprompt`) and iOS Safari detection both return null in a desktop-Chromium
  Playwright session, so the actual bottom-sheet UI was not capturable this round. Marked
  CANNOT-VERIFY, not pass/fail — needs a real mobile-browser pass (or Playwright device
  emulation with a Chromium build that fires `beforeinstallprompt`, which headless Chromium does
  not).
- **Landing page identity gap:** `landing.html` has no `<link rel="manifest">` of its own. Given
  `/welcome` is a marketing page that hands off to the installable app rather than a standalone
  surface, this is likely correct as-is — flagging only as a decision point, not a defect.

---

## Discrepancies filed against CLAUDE.md (per its own instruction to flag conflicts)

1. **"Full-screen login front door... → Free/Pro plan-choice screen → app"** (Architecture
   section) — `FEATURES.SHOW_PLAN_CHOICE = false` in shipped code; the router skips straight from
   sign-up to Home. Confirmed live. `planChoiceView()` is dead code with stale pricing copy
   ($54/yr, 2-trip Free cap) that contradicts the Go-Free direction — retained per the
   Transferability Standard (feature-flagged, not deleted), but the Architecture section's prose
   should be corrected to say the plan-choice step is flagged off.
2. **"Six-tab navigation"** (Architecture section) — live nav is 7 tabs (Home, Explore, Trips,
   Refer, Share, Profile, Perks). An 8th view (`tools` — the "Coverage & savings" pitch tool) is
   routable but not in the nav bar at all.

Not corrected in CLAUDE.md this round (doc edit was not in the directive's file scope) — flagging
per instruction so both get patched.

---

## Build summary this round

| Item | Status | Files |
|---|---|---|
| HIGH-2 tip/share overlay grace period | **BUILT, verified locally** | `index.html` |
| MEDIUM-1 Refer tab dead space | **BUILT, verified locally** | `index.html` |
| MEDIUM-3 SW cache bump | **BUILT** | `sw.js` |
| HIGH-5 (partial) landing theme-color sync | **BUILT** | `landing.html` |
| HIGH-1, HIGH-3, HIGH-4, HIGH-5 (full), MEDIUM-2, MEDIUM-4, LOW-1..3 | **Spec only — backlog** | — |

Branch: `polish/hitch-pass-2026-08-21` (worktree `HitchPassApp-polish`). Not merged, not deployed —
see close-out report for why.

---

## Security-review remediation (post-PASS/PASS-conditional round)

An adversarial security-reviewer pass on this branch's diff caught two evidence-hygiene defects
that the initial commit missed:

1. **Live account identifier published to a public repo.** `tab-profile.png` (before/after, both
   viewports) rendered the "Signed in as" line with a real, plus-tagged Gmail address from a live
   Supabase-authenticated test account. This repo is public and has no build step (`vercel.json` is
   crons + one rewrite, static root serve) — merging would have made those PNGs directly fetchable
   from `hitchpass.vercel.app` as well as GitHub. **Fixed:** re-shot all four `tab-profile.png`
   files with the email element masked via Playwright's screenshot `mask` option (solid pine-green
   bar over the address) rather than deleted outright, so the surrounding layout stays intact as
   evidence.
2. **`membership-detail.png` didn't depict what its filename claimed.** All four copies (before/
   after × mobile/desktop) were byte-identical to the Home screen — the stat-tile click documented
   in MEDIUM-2 does nothing, so there is no distinct membership-detail view to capture. Filename
   implied evidence that didn't exist. **Fixed:** removed rather than relabeled — MEDIUM-2 above
   already documents the underlying non-interactivity finding; a placeholder screenshot of Home
   under a misleading name added no evidence value.
3. **Added `.vercelignore` excluding `design/`** as defense in depth — the screenshot/spec
   directory should never be served from the production domain regardless of what's in it,
   independent of fix #1.

Both fixes verified visually (masked bar fully covers the address in all four re-shot files; no
other PNG in the set was found to contain an account identifier on inspection during this remediation).
Pushed as a follow-up commit on this branch.

**A re-review (independent fresh instance) pixel-analyzed the masked files and confirmed the mask
is a solid, complete rectangle with zero residual glyph pixels in all four, confirmed the deleted
`membership-detail.png` files were provably byte-identical duplicates (nothing lost), confirmed
`.vercelignore` is correctly scoped, and swept all 24 unique screenshots (44 files reduce to 24 by
hash) for any other account identifier — none found.**

**One residual finding that no further commit can close (SEC-1, MEDIUM):** the pre-remediation
blobs (unmasked `tab-profile.png`, commit `1e5a4dc`) are already pushed to the public GitHub
remote and reachable by SHA even though the branch tip is clean — a normal merge or rebase-preserving
merge would carry them into `main`'s permanent history. **This is a decision for whoever runs the
actual merge, not something fixable from this worktree:**
1. **Merge this branch with squash-merge**, not a regular merge — keeps the unmasked commit out of
   `main`'s history entirely.
2. **Retire the exposed test account** in Supabase project `rhqnsjnmlrshrifewxtr` — squashing does
   not unpublish an already-pushed blob (GitHub retains unreachable objects by SHA), so the durable
   fix is disabling the credential, not rewriting git. All test accounts created during this
   session used the `jmspyne+polish*@gmail.com` alias pattern per the directive's pre-approved
   testing convention — there are roughly 15 of them from the various signup runs this round, all
   disposable QA accounts, none carrying real subscription state. Recommend clearing all of them
   from the Supabase dashboard, not just the one that was exposed.
3. Optionally, once account is retired, ask GitHub Support to garbage-collect the unreachable
   objects for full history hygiene — not required for the exposure to be neutralized, since the
   credential itself will no longer be live.

Not attempted directly in this session: rewriting this branch's pushed history (force-push) and
deleting live Supabase accounts are both irreversible, dashboard/history-altering actions outside
a design-polish builder's authority — flagging for Jim rather than acting unilaterally.
