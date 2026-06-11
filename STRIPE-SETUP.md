# Hitch Pass — Tier 1 Stripe Setup (paint-by-numbers)

Goal: take live subscriptions, with compliant auto-renewal consent and an easy cancel path, using Stripe's hosted Checkout and Customer Portal so you build almost nothing.

You'll spend most of the time clicking in the Stripe dashboard. The code is already written (the two files in `/api`). Total: ~20–30 minutes.

---

## A. In the Stripe dashboard (the clicks only you can do)

1. **Go live.** Stripe Dashboard → toggle off "Test mode" (top right). Under Settings → Business, finish your business profile. Under Settings → Payouts, add the bank account that should receive money.

2. **Create the two prices.** Product catalog → Add product, twice:
   - **Hitch Pass — Annual**: recurring, billing period **Yearly**, price **$54.00 USD**. Save → copy the **Price ID** (`price_...`).
   - **Hitch Pass — Monthly**: recurring, billing period **Monthly**, price **$6.50 USD**. Save → copy the **Price ID**.

3. **Get your secret key.** Developers → API keys → copy the **live Secret key** (`sk_live_...`).

4. **Set the Terms of Service URL** (this makes the required "I agree" checkbox appear in Checkout). Settings → search "Checkout and Payment Links" / "Public details" → set the **Terms of Service URL** to `https://hitch-pass-app.vercel.app/terms`. Save. (If you skip this, Checkout will error because the code asks for a required ToS consent.)

5. **Enable the Customer Portal** (this is your cancel/manage screen). Settings → Billing → **Customer portal** → Activate. Then:
   - Allow customers to **cancel subscriptions** → set cancellation to **at end of billing period** (matches your Refund Policy: access continues through the paid period).
   - Allow **update payment method** and **view invoice history**.
   - Set the portal **business name**, and add your **Terms** and **Privacy** links.
   - Save.

---

## B. In Vercel (environment variables)

6. Vercel → your project → Settings → Environment Variables. Add four (values from steps 2–3):
   - `STRIPE_SECRET_KEY` = your `sk_live_...`
   - `STRIPE_PRICE_ANNUAL` = the annual `price_...`
   - `STRIPE_PRICE_MONTHLY` = the monthly `price_...`
   - `APP_URL` = `https://hitch-pass-app.vercel.app`

---

## C. In your repo (the code — already written)

7. Add the Stripe package: in your project run `npm install stripe`, then commit the changed `package.json` / lockfile.

8. Drop the two endpoint files in:
   - If your app is **not** Next.js → put them in a top-level **`/api`** folder: `api/create-checkout-session.js`, `api/create-portal-session.js`.
   - If your app **is** Next.js → put them in **`/pages/api`** instead: `pages/api/create-checkout-session.js`, `pages/api/create-portal-session.js`.
   - The file contents are identical either way.

9. Paste the snippets from `frontend-snippets.html`:
   - Subscribe buttons + auto-renewal note → your **pricing** screen.
   - Manage/cancel button → your **account** screen.
   - 18+ agreement checkbox → your **signup** screen.
   - Footer policy links → your global footer.
   - Make sure `window.CURRENT_USER_EMAIL` is set to the logged-in user's email (used to link checkout + portal to their account).

10. Commit and push. Vercel auto-deploys.

---

## D. Test it (5 minutes)

11. Best practice: do a dry run in **test mode** first (use test keys + test prices and Stripe's test card `4242 4242 4242 4242`, any future expiry/CVC). Then repeat the env vars with live keys.
12. Click **Subscribe** → you should land on Stripe Checkout showing the recurring price, the interval, and a required "I agree to the Terms" checkbox.
13. Complete checkout → you're sent to `/account?checkout=success`.
14. Click **Manage / cancel subscription** → the Stripe portal opens → cancel → confirm it shows "cancels at period end."

If all four of those work, Tier 1 payments are live and compliant.

---

## What this gives you (and what it skips)

Covered: live payments, the two plans + your free tier, auto-renewal disclosure at point of sale, required Terms agreement, and self-serve cancel/manage. That's the Tier 1 compliance core.

Deferred to "at scale" (Tier 2/3), by your call: LLC + business bank, acknowledgment/renewal-reminder emails, failed-payment dunning, Stripe Tax (US states + Canada GST/HST/QST), and the custom domain + transactional email sender. Stripe still sends an automatic payment receipt in the meantime, so you're not silent on confirmations.
