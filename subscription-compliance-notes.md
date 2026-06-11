# HitchPass — Subscription Compliance Build Notes

These are the *in-app* pieces that make your written policies true. The legal docs say the app discloses auto-renewal, gets affirmative consent, and lets users cancel easily. These notes spec the UI/email behavior that has to actually exist so those statements hold up. This is where auto-renewal liability actually gets resolved — clean consent and an easy cancel path are worth more than any clause.

Why it matters: the federal "click-to-cancel" rule was vacated in July 2025, but ROSCA still applies federally and California's Automatic Renewal Law (plus similar laws in other states) still require clear disclosure, affirmative consent, and easy cancellation. Because you have nationwide users, you build to the California standard and you're covered everywhere.

---

## 1. Checkout consent — the affirmative-consent requirement

Right next to the "Subscribe / Start Plan" button, before payment is taken, show the auto-renewal terms **clearly and conspicuously** (not buried in a linked doc), and require a deliberate action to agree.

**Required disclosures, visible on the checkout screen:**
- The price and billing frequency ("$4.50/mo, billed annually at $54.00" or "$6.50/mo, billed monthly").
- That it **renews automatically until cancelled**.
- That the card on file will be charged each period.
- How to cancel (link to account settings / mention it takes effect end of period).

**Consent mechanism — use one of these:**
- A checkbox, **unchecked by default**, the user must tick:
  > ☐ I understand my subscription renews automatically at $[price]/[period] until I cancel, and I authorize HitchPass to charge my payment method each period.
- *or* a button whose label itself carries the terms, with the disclosure text directly above it:
  > **[ Subscribe — $54/yr, auto-renews until cancelled ]**

Do **not** pre-check the box. Do **not** put the disclosure only inside the linked Terms. The disclosure has to be on the screen where they hit pay.

> If you use Stripe Checkout, its subscription mode shows recurring price + interval natively. You still need your own auto-renewal sentence + the consent affirmation on the page that launches it, because Stripe's UI alone isn't treated as your disclosure.

---

## 2. Post-purchase acknowledgment email

Right after signup, send an email confirming the subscription. ARL requires the auto-renewal terms and cancellation info be available in a form the user can keep. Include:
- Plan, price, billing frequency, and **renewal date**.
- "Renews automatically until cancelled."
- One-click path / clear instructions to cancel.
- Link to Terms and Refund Policy.

---

## 3. Cancellation flow — must be easy

- **In-app cancel button** in Account → Subscription. One or two taps. No phone call, no chat, no "are you sure" maze beyond a single confirm.
- Cancel should be available through the **same medium** the user signed up in (web → web cancel).
- Honor it immediately: stop the next renewal, show "Active until [date]," keep access through the paid period.
- Send a cancellation-confirmation email with the end-of-access date.
- Also accept cancellation by email to your support address as a backstop (the Terms promise this).

---

## 4. Annual renewal reminder

For annual plans, email a reminder **before** the plan renews — a window of **15–45 days ahead** is the safe practice. Include the renewal date, the amount, and a cancel link. This is both an ARL-style requirement for longer terms and the single best way to kill "I didn't know it would renew" chargebacks.

---

## 5. Price-change notice

If you raise a plan's price, email affected users **before** it takes effect, state the old and new price and the effective date, and remind them they can cancel before renewal. The new price applies at their next renewal, not mid-period.

---

## 6. Canada & cross-border specifics

You're now serving North America in the docs, so a few extra behaviors keep the auto-renewal piece clean for Canadian users:

- **Currency at checkout.** Show prices in **USD** on the checkout screen (e.g., "$54 USD/yr"). Canadian cards are charged in USD via Stripe and their bank handles conversion — saying so up front prevents "I didn't realize it was US dollars" disputes.
- **Quebec is the strict one.** Quebec's Law 25 (privacy) and Consumer Protection Act (auto-renewal/negative-option) are the tightest in North America. Quebec also voids mandatory consumer arbitration and class-action waivers — that's why the Terms' arbitration section self-disables where local law prohibits it. Don't try to force arbitration on a Quebec user; the carve-out handles it.
- **Consent + cancel standard is the same.** PIPEDA and the provincial consumer acts want the same things the US ARL build already gives you: clear disclosure, affirmative consent, easy cancellation. Build to the California/Quebec standard once and you're covered across the US and Canada.
- **Privacy contact / complaint route.** The Privacy Policy points Canadian users to the Office of the Privacy Commissioner of Canada (and Quebec's CAI). Make sure the **supporthitchpass@gmail.com** you drop in is monitored — that's the access/correction/withdraw-consent intake.
- **Not aimed at the EU.** The docs state the Service isn't directed to EEA/UK/Switzerland residents. If you ever decide to market into Europe, that's when the GDPR layer (lawful basis, DPA, EU representative, cookie consent banner) gets added — flag me and I'll bolt it on.

---

## 7. Where the three policies have to be linked

| Location | Terms | Privacy | Refund |
|---|---|---|---|
| Site / app footer | ✓ | ✓ | ✓ |
| Account creation screen ("By signing up you agree to…") | ✓ | ✓ | — |
| Checkout screen (near pay button) | ✓ | — | ✓ |
| Account → Subscription | ✓ | — | ✓ |
| Acknowledgment + reminder emails | ✓ | — | ✓ |

Routes to deploy: `/terms`, `/privacy`, `/refunds`.

---

## 8. Fill-in checklist before you publish

- [x] Support email set to **supporthitchpass@gmail.com** (filled across all pages + emails). Swap to a domain address later if desired.
- [ ] Confirm governing-law state is **Texas** — change Section 14 of the Terms if your RVer domicile is SD/FL/elsewhere.
- [ ] Confirm the entity line — currently "a sole proprietorship operated by James Payne." Swap to the LLC name if you've formed one. (Forming the LLC is still the highest-leverage protection move — the docs limit liability by contract; the LLC limits it structurally.)
- [ ] Confirm prices ($4.50/mo annual = $54/yr; $6.50/mo monthly) match what Stripe actually charges.
- [ ] Confirm you're billing **direct via Stripe on the web** (not through the Apple/Google stores). If you ever sell through an app store, their refund and billing rules override parts of this — flag me and I'll add the store-specific language.
- [ ] Confirm prices show in **USD** at checkout for all users, including Canadian ones.
- [ ] Confirm the scope decision: docs serve **US + Canada** and disclaim EEA/UK/Switzerland. If you plan to actively market into Europe, tell me and I'll add the GDPR layer.
- [ ] Style: the pages use a neutral green accent via the `--accent` CSS variable at the top of each file — swap it to HitchPass's brand color in one place.

---

*These are strong, current templates, not legal advice. For an app at this stage that's usually the right call; if you take outside money or scale hard, have a lawyer pass over the Terms once — especially the arbitration and limitation-of-liability sections.*
