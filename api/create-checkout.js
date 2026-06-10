/* Vercel serverless function: create a Stripe Checkout Session for a signed-in user.
   Secrets come from Vercel env only — never the repo/client.
   The user is identified by verifying their Supabase JWT server-side (we never trust a client-sent id). */
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const APP_URL = "https://hitch-pass-app.vercel.app";

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var stripeKey = process.env.STRIPE_SECRET_KEY;
    var supaUrl = process.env.SUPABASE_URL;
    var anonKey = process.env.SUPABASE_ANON_KEY;
    if (!stripeKey || !supaUrl || !anonKey) { res.status(500).json({ error: "Server not configured" }); return; }

    // --- verify the caller's identity from their Supabase access token ---
    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sign in required" }); return; }
    var supa = createClient(supaUrl, anonKey);
    var userRes = await supa.auth.getUser(token);
    var user = userRes && userRes.data && userRes.data.user;
    if (!user || (userRes.error)) { res.status(401).json({ error: "Invalid session — sign in again" }); return; }

    // --- map plan -> configured price (price ids live in Vercel env, not here) ---
    var body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var plan = body.plan;
    var price = plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL
              : plan === "monthly" ? process.env.STRIPE_PRICE_MONTHLY
              : null;
    if (!price) { res.status(400).json({ error: "Pick a plan (annual or monthly)" }); return; }

    var stripe = new Stripe(stripeKey);

    // Reuse an existing Stripe customer for this email if there is one.
    var customerId = null;
    var existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing && existing.data && existing.data.length) customerId = existing.data[0].id;

    var session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price, quantity: 1 }],
      client_reference_id: user.id,
      customer: customerId || undefined,
      customer_email: customerId ? undefined : user.email,
      allow_promotion_codes: true,
      success_url: APP_URL + "/?checkout=success",
      cancel_url: APP_URL + "/?checkout=cancel"
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || "Checkout failed" });
  }
};
