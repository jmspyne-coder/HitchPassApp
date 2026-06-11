// POST /api/create-portal-session
// Body: { email?: "user@example.com", customerId?: "cus_..." }
// Opens the Stripe Customer Portal so the user can cancel, change plan,
// update their card, or view invoices. This is the compliant "cancel anytime"
// path your Terms promise — no custom UI needed.
//
// Works as a Vercel serverless function (file at /api/...) OR a Next.js
// Pages API route (file at /pages/api/...). Same contents either way.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { email, customerId } = req.body || {};

    // If you didn't store the Stripe customer id yet, look it up by email.
    // (Storing customerId on the user later is more robust, but this works day one.)
    if (!customerId && email) {
      const list = await stripe.customers.list({ email, limit: 1 });
      if (list.data.length) customerId = list.data[0].id;
    }

    if (!customerId) {
      return res.status(404).json({ error: 'No subscription found for this account' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/account`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-portal-session error:', err);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
