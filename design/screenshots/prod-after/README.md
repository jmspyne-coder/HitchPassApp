# Prod verification — 2026-08-22, after PRs #17 and #18

Captured against **https://hitchpass.vercel.app** (production), not a preview or a local
server, at both viewports (mobile 390px, desktop 1440px). Prod was serving
`hitchpass-v22` at capture time.

## Why these exist separately from `before/` and `after/`

`design/screenshots/{before,after}/` were captured against a **local** server pre-merge.
These are the post-deploy **production** captures the directive's step 4 asks for.

## FL-H5 — `landing.html` theme-color: the honest evidence

`landing.html`'s only change was `<meta name="theme-color">` `#1f3d2c` → `#E8461E`.
A page-content screenshot **cannot** show this — `theme-color` paints OS/browser chrome,
outside the captured viewport. The prod before/after captures are byte-identical
(`d432d9c6b81d` mobile, `33d3d89cdf28` desktop), which is the correct and expected result,
not a failed capture.

The real paired evidence is the live DOM attribute, read from production across the deploy:

| viewport | before deploy | after deploy |
|---|---|---|
| mobile  | `#1f3d2c` | `#E8461E` |
| desktop | `#1f3d2c` | `#E8461E` |

Reproduce: `curl -s https://hitchpass.vercel.app/landing.html | grep theme-color`

## home-empty-state / home-populated-no-regression

The FL-H3 designed empty state, live on prod, alongside the populated wallet proving no
regression for existing users:

| wallet | designed card | Explore tile | bytes (mobile) |
|---|---|---|---|
| `[]`             | yes | "Browse all parks" | 151472 |
| `["tt","enc"]`   | no  | "154 locations"    | 135620 |

The populated capture is byte-identical to the pre-existing `before/mobile/tab-home.png`
(135620 bytes) — existing users see exactly what they saw before.

**Reachability caveat (FL-H3 is NOT fully closed):** new signups are still seeded
`["tt","enc"]`, so they do not land on the empty state. It is reached by clearing your
cards in Profile. Making it the new-user default is a product-behavior call parked for
Jim — see `design/POLISH_SPEC.md` HIGH-3.

## Capture method — no test accounts were created

The app fails open when Supabase is unreachable (`index.html`: `sb===null` → fall through
to the app, rather than lock the user out). Blocking the Supabase CDN therefore renders the
authenticated app shell with no account at all, and `localStorage` seeds the wallet state.
Zero signups, so this adds nothing to the outstanding `jmspyne+polish*` cleanup.
