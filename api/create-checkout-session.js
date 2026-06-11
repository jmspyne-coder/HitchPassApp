// POST /api/create-checkout-session
// Body: { plan: "annual" | "monthly", email?: "user@example.com" }
// Creates a Stripe Checkout session for a subscription and returns its URL.
//
// Works as a Vercel serverless function (file at /api/...) OR a Next.js
// Pages API route (file at /pages/api/...). Same contents either way.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  annual: process.env.STRIPE_PRICE_ANNUAL,   // $54.00 / year  ($4.50/mo)
  monthly: process.env.STRIPE_PRICE_MONTHLY, // $6.50 / month
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, email } = req.body || {};
    const price = PRICE_IDS[plan];
    if (!price) return res.status(400).json({ error: 'Invalid plan' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],

      // Forces a REQUIRED "I agree to the Terms of Service" checkbox in Checkout.
      // Requires a Terms of Service URL set in Stripe Dashboard (see STRIPE-SETUP.md, step 4).
      consent_collection: { terms_of_service: 'required' },

      // Checkout natively displays the recurring price + interval ("$54.00 per year"),
      // which satisfies the auto-renewal disclosure requirement at the point of sale.
      allow_promotion_codes: true,

      // Associating the email lets the billing portal find this customer later by email.
      ...(email ? { customer_email: email } : {}),

      success_url: `${process.env.APP_URL}/account?checkout=success`,
      cancel_url: `${process.env.APP_URL}/pricing?checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
