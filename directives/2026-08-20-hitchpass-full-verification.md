# Function Ledger — DIRECTIVE 2026-08-20-hitchpass-full-verification

Repo: HitchPassApp. No drafted test plan was found in this repo's own tracking (no
`directives/` tree existed before this session — created by this session) or on the
Rootwork Business Board (searched; only this directive card and an unrelated 21-day
notification idea card reference "Hitch Pass" + "21-day"/"test plan"). This ledger is
authored in-session from a full static read of `index.html` (~556KB single-file vanilla-JS
PWA), `sw.js`, `landing.html`, and the public marketing/legal pages, per the card's own
rule that the ledger is FL-0 and its completeness is the first gated claim.

Product context (from `CLAUDE.md`, 2026-07-07 pivot): Hitch Pass is now **fully free,
ad-supported, no tier gating** — Pro/Stripe checkout remains in the codebase but is
feature-flagged off (`FEATURES.SHOW_PLAN_CHOICE=false`, `FEATURES.ENABLE_STRIPE_CHECKOUT=false`,
`index.html:3138-3139`). This means the mandatory "free-tier wallet flows" coverage named
by Jim is, in practice, coverage of **every** wallet state and transition in the app, since
every user is on the free tier now.

## FL-1..FL-14 — Auth flow
1. Boot splash screen — index.html:72-77, 5640-5641
2. Supabase client init (soft-fails to null, no app-lockout on CDN failure) — index.html:89-92
3. Auth-loading gate (shows loading view while session check pending) — index.html:5007-5009, 5405
4. Front-door login/signup form (email+password) — index.html:5021-5033
5. Toggle login <-> signup mode — `authToggleMode()` index.html:4253
6. Submit login or signup — `authPassword()`; signup returns session immediately (email-confirm OFF) — index.html:4234-4252
7. Sign out — `authSignOut()` — index.html:4254-4258
8. **GAP**: no password-reset/forgot-password flow exists anywhere in index.html (grepped `resetPasswordForEmail`, "forgot" — zero hits)
9. Free/Pro plan-choice screen — `planChoiceView()`, dead code in production (`SHOW_PLAN_CHOICE=false` short-circuits it) — index.html:5037-5067, 3138, 5408
10. "Start free" choice handler — `choosePlanFree()` (unreachable, see FL-9) — index.html:4231
11. Post-Stripe "Confirming your subscription..." screen — index.html:5011-5019, 4149-4192 (reachable only via dormant Stripe path)
12. Master session-gated screen router — index.html:5401-5408
13. `?invite=CODE` capture to localStorage — index.html:5616
14. Invite claim against a signed-in session (`/api/claim-invite`) — index.html:4051-4070, 5502

## FL-15..FL-24 — Top-level navigation
15. **DOC/CODE MISMATCH**: CLAUDE.md says "six-tab navigation" (line 40); code defines 7 tabs — index.html:3358-3361
16. Home tab (`homeView()`) — index.html:3363-3422
17. Explore tab, list/map of parks (`exploreView()`) + park detail (`detailView()`) — index.html:3501-3530, 3616-3719
18. Trips tab (`tripsView()`) — index.html:3810-3842
19. Refer tab (`referView()`) — index.html:4910-4945
20. Share tab (`shareTabView()`) — index.html:4946-4981
21. Profile tab (`profileView()`) — index.html:4610-4631
22. Perks tab (`perksView()`) — index.html:4767-4819
23. Tab-switch dispatch (`data-act="nav"`) — index.html:5434-5440
24. Active-tab highlighting — `navView()` index.html:4983-4988

## FL-25..FL-50 — Wallet / membership card flows (mandatory row: every free-tier wallet state + transition)
25. Add a network card to wallet — index.html:3938-3954, 5506-5510
26. Remove a network card from wallet — index.html:5507-5508
27. Available wallet networks: TT, Encore/Trails Collection, RPI, Coast to Coast, Passport America, KOA, Harvest Hosts, Good Sam (DC excluded, displayOnly) — index.html:97-107, 3939
28. Select/change TT membership tier (Zone Camping Pass, Journey, Explore, Adventure + 3 legacy) — index.html:4315-4322, 5512, 3199
29. Toggle Trails Collection add-on — index.html:4325, 5513
30. Toggle Trails Collection Plus add-on (Adventure-only) — index.html:4326
31. Toggle RPI add-on — index.html:4327
32. Enter annual dues / purchase price / purchase date (drives ROI) — index.html:4329-4330, 5584-5585, 5594
33. Increment/decrement high-use reservations counter (capped) — index.html:5514, 4331-4339
34. Add booking — search-park path — index.html:3868-3874, 5536
35. Add booking — manual/custom-park path — index.html:3875-3881, 5534-5535
36. Save a new booking (validates, computes overStay at save time) — index.html:3903-3931
37. Edit an existing trip — index.html:5540-5547
38. Update (save) an edited trip — index.html:3903, 3925
39. Cancel add/edit booking form — index.html:5537
40. Remove/delete a trip (confirm dialog, clears push reminders) — index.html:5555-5559
41. Mark a trip "booked" (confirmation-number step) — index.html:3862-3864, 3922
42. "Book now" handoff to network's external booking site — index.html:3291-3297, 5458-5459
43. Post-handoff return prompt ("did you book?") — index.html:5617-5633, 5460
44. Active-stay check-in — index.html:4406-4407, 4408-4413, 5518
45. Active-stay check-out — index.html:4414, 5516
46. Remove a stay-history entry — index.html:5517
47. Favorite/un-favorite a park — index.html:5447
48. Set/clear target-arrival date on a favorited park — index.html:5597, 5521
49. Membership-tier recommendation wizard (5 questions) — index.html:4531-4554, 5522-5526
50. Apply wizard-recommended tier — index.html:5526

## FL-51..FL-67 — The 21-day / booking-window clock (mandatory row: start trigger, expiry behavior, both sides of the window)
51. Per-network base window/max-stay config — index.html:98-106
52. Audited TT tier rules derived from PERKS matrix, self-checking — index.html:221-248 (camping 60d/14-in/7-out non-park-to-park; journey 120d/21/park-to-park; explore 150d/21/park-to-park; adventure 180d/21/park-to-park)
53. `MEMBERSHIP_TIERS` catalog (7 tiers, each with maxStayDays/bookingWindowDays/timeoutDays/parkToPark) — index.html:264-324
54. `effectiveBooking(p)` — single source of truth resolving a park's live window/max-stay — index.html:3303-3315
55. `maxStayFor(network)` — index.html:3318
56. Over-stay detection at booking-form-fill time and at save time — index.html:3319-3322, 3298, 3891-3896, 3923
57. Over-stay flag persisted on saved trip, recomputed for legacy trips — index.html:3325-3329
58. Booking-window countdown for a specific arrival date (**the clock's start trigger**: `openDate = arrival - window days`) — index.html:3330-3336
59. Booking-window countdown for a favorited park's target date — index.html:4462-4468
60. User-facing status copy: not-set / open ("book now") / not-yet-open ("Opens in N days") — index.html:4484-4487
61. Booking Dates dashboard buckets (Book now / Opening soon <=14d / Upcoming) — index.html:4499-4519, 5528
62. In-app alert: window opening within 3 days — index.html:4585-4588
63. In-app alert: active stay approaching max-stay ceiling (3 days out) — index.html:4590-4597
64. Dismiss alert banner (per-signature dedup) — index.html:5527, 4599
65. Download .ics reminder for a booking-window open date — index.html:3341-3355, 5456, 5548
66. Push-notification booking-window reminders — index.html:4009-4034
67. **GAP — no explicit "expired" UI state**: once `dateOut` passes, a trip just moves to history; the only post-window signal is the over-stay warning (FL-56) if logged stay exceeds the limit — index.html:4406 (activeStay), no expiry-specific view found

## FL-68..FL-97 — Other user-facing functions
68. Tip jar prompt (14-day cadence) — index.html:5121-5158
69. Send a tip (`/api/tip`, Stripe Checkout redirect) — index.html:5161-5171, 5474-5481
70. Dismiss tip prompt (hands off to share prompt) — index.html:5173-5177
71. Post-tip "thanks" toast (`?tip=thanks`) — index.html:4083-4087, 5267
72. Share prompt (7-day cadence, offset from tip jar) — index.html:5133-5147
73. Share the app (native share sheet / clipboard fallback) — index.html:3247-3259, 5441, 5485
74. Dismiss share prompt — index.html:5178
75. Install-to-homescreen prompt (signup-moment, 14-day cadence) — index.html:5205-5221
76. Perform install (Android, replays captured prompt) — index.html:5225-5233
77. Dismiss install prompt — index.html:5222
78. Push-notification opt-in — index.html:4035-4046, 5554
79. Push support/enabled-state checks — index.html:4000-4001
80. Invite-code claim flow — see FL-13/14
81. Stripe checkout/upgrade CTAs — confirmed dormant via feature flags (`ENABLE_STRIPE_CHECKOUT=false`, `SHOW_PLAN_CHOICE=false`), not merely unreachable via nav — index.html:5051-5052, 4289-4291, 3139, 3138, 4196, 3995
82. Stripe Customer Portal button (legacy comped `isPaid` accounts only) — index.html:4211-4221, 4284, 4271-4285
83. Settings/profile fields (member numbers, rig length, referral fields) — index.html:3958-3976, 5576-5579
84. Copy member number to clipboard — index.html:5471
85. ROI / payback calculator card — index.html:4355-4405
86. Savings calculator (Tools) — index.html:4820-4839, 5531
87. Referral SMS builder — index.html:4881-4909, 5532
88. Trip directions overlay (Google/Apple Maps) — index.html:5315-5343, 5552-5553
89. Add trip to device calendar (.ics) — index.html:5356-5385, 5549, 5551
90. Error state — bad login/signup credentials — index.html:4246, 5024, 5030
91. Error state — Supabase/network unreachable at boot (degrades gracefully, wallet stays usable offline) — index.html:4262-4264
92. Error state — booking form validation — index.html:3908-3910
93. Error state — tip submission failure — index.html:5170-5171
94. Error state — offline map ("Map needs a connection...") — index.html:3559
95. Error state — payments not live (dormant Stripe paths) — index.html:4207-4208, 4220-4221
96. **GAP — no theme toggle** (grepped, zero hits)
97. **GAP — no data export/import** (grepped, zero hits; wallet data is localStorage-only, no backup/restore)

## FL-98..FL-108 — Service worker / offline behavior
98. Cache version `hitchpass-v20` — sw.js:3
99. Precached local app shell (index.html, manifest.json, icons, `?v=2` busted) — sw.js:7-18
100. Best-effort cross-origin precache (Google Fonts, Supabase UMD bundle) — sw.js:20-24, 29-30
101. Cache cleanup on activate (deletes stale cache keys) — sw.js:36-43
102. Navigation fetch: network-first, cache-fallback to index.html, never caches non-OK/redirect — sw.js:49-65
103. `parks.data.json` fetch: network-first with cache fallback — sw.js:67-78
104. Everything else: cache-first, runtime-cached — sw.js:80-94
105. Offline fallback = cached index.html shell (no dedicated offline page) — sw.js:60-62
106. Web Push notification display — sw.js:98-109
107. Notification click -> focus/open app — sw.js:110-119
108. Service worker registration (silent no-op if unsupported) — index.html:5646-5650

## FL-109..FL-111 — Admin / hidden functions
109. No admin panel, debug mode, or hidden query-param gate found (grepped)
110. `FEATURES` flag block (SHOW_PLAN_CHOICE, ENABLE_STRIPE_CHECKOUT, SHOW_DONATION_PROMPT, SHOW_ADS) — hardcoded, not live-togglable, matches CLAUDE.md's free/no-gating description — index.html:3137-3142
111. `IS_IOS_APP` UA-sniff flag hiding Stripe buttons for the wrapped iOS app (App Store 3.1.1) — index.html:5073

## FL-112..FL-121 — Public/static surface (exercised live this session, see report for evidence)
112. Production root `hitchpass.vercel.app/` loads, no leaked data
113. Legacy alias `hitch-pass-app.vercel.app/` resolves to same app
114. `manifest.json` served correctly
115. `sw.js` served, content matches source (cache version, strategies)
116. `landing.html` public marketing page, crawlable, "Free forever" messaging
117. `robots.txt` correct, points to sitemap
118. `sitemap.xml` lists expected pages
119. `terms-of-service.html` loads
120. `privacy-policy.html` loads
121. `refund-policy.html` loads
122. Guide page `thousand-trails-14-day-rule` loads, content matches code-derived tier rules (FL-52)
123. `/api/tip` rejects bare GET (405) — endpoint exists, method-gated
