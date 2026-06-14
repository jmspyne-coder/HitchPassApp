/* Vercel serverless function: open the Stripe Customer Portal for the signed-in user.
   This is the compliant self-serve "cancel / manage subscription" path.

   Identity comes from the verified Supabase JWT (never a client-sent id/email), matching the other
   endpoints. We resolve the user's Stripe customer by their verified email and create a billing-portal
   session; the client redirects to it. The portal lets them cancel, change card, and view invoices. */
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var stripeKey = process.env.STRIPE_SECRET_KEY;
    var supaUrl = process.env.SUPABASE_URL;
    var anonKey = process.env.SUPABASE_ANON_KEY;
    var appUrl = process.env.APP_URL || "https://hitch-pass-app.vercel.app";
    if (!stripeKey || !supaUrl || !anonKey) { res.status(500).json({ error: "Server not configured" }); return; }

    // --- verify the caller from their Supabase access token ---
    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sign in required" }); return; }
    var supa = createClient(supaUrl, anonKey);
    var userRes = await supa.auth.getUser(token);
    var user = userRes && userRes.data && userRes.data.user;
    if (!user || userRes.error) { res.status(401).json({ error: "Invalid session — sign in again" }); return; }

    var stripe = new Stripe(stripeKey);
    var list = await stripe.customers.list({ email: user.email, limit: 1 });
    var customer = (list && list.data && list.data[0]) || null;
    if (!customer) { res.status(404).json({ error: "No subscription found for this account" }); return; }

    var session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: appUrl + "/?portal=return"
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-portal-session error:", (err && err.message) || err);
    // Surface a clear message if the portal hasn't been enabled in the Stripe dashboard yet.
    var msg = (err && err.message) || "Could not open billing portal";
    res.status(500).json({ error: msg });
  }
};
