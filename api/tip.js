/* Vercel serverless function: create a one-time Stripe Checkout Session for a "tip" (donation).
   Unlike create-checkout.js (mode: subscription), this is mode: payment — a single charge that
   NEVER creates a subscriptions row, so it can't be mistaken for a Pro grant. Amount is validated
   server-side (the client value is never trusted). Secrets come from Vercel env only.

   Auth is optional: a tip works whether or not the caller is signed in. When a valid Supabase JWT
   is present we attach the user's email to the Checkout Session for a cleaner receipt; otherwise the
   tip stays anonymous and Stripe collects an email at checkout. */
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const APP_URL = "https://hitch-pass-app.vercel.app";
const MIN_CENTS = 100;     // $1 floor
const MAX_CENTS = 50000;   // $500 ceiling (matches the UI custom-input bounds)

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(500).json({ error: "Server not configured" }); return; }

    var body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // Validate the amount: a finite integer number of cents within the allowed band.
    var amount = Math.round(Number(body.amount));
    if (!isFinite(amount) || amount < MIN_CENTS || amount > MAX_CENTS) {
      res.status(400).json({ error: "Enter a tip between $1 and $500." }); return;
    }

    // Best-effort: identify the caller to attach their email to the receipt (never trusted for anything else).
    var email = null;
    var supaUrl = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY;
    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (token && supaUrl && anonKey) {
      try {
        var supa = createClient(supaUrl, anonKey);
        var userRes = await supa.auth.getUser(token);
        if (userRes && userRes.data && userRes.data.user && !userRes.error) email = userRes.data.user.email;
      } catch (e) { /* anonymous tip is fine */ }
    }

    var stripe = new Stripe(stripeKey);
    var session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: "Hitch Pass Tip" }
        }
      }],
      customer_email: email || undefined,
      submit_type: "donate",
      success_url: APP_URL + "/?tip=thanks",
      cancel_url: APP_URL + "/"
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("tip error:", (err && err.message) || err, (err && err.type) || "");
    res.status(500).json({ error: (err && err.message) || "Couldn’t start the tip checkout." });
  }
};
