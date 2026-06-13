/* Vercel serverless function: reconcile Stripe -> Supabase on demand, synchronously.

   Called by the client when it returns from Stripe Checkout (?checkout=success). Instead of
   waiting for the asynchronous webhook to write the subscriptions row (which races Stripe's event
   delivery + a serverless cold start and can exceed the client's confirm window), this looks the
   user's subscription up in Stripe right now and upserts the row before responding. The client then
   reads the row and flips to Pro immediately. The webhook stays the source of truth for later
   lifecycle events (renewals/cancellations); this just removes the first-write race.

   Identity comes from the verified Supabase JWT (never a client-sent id). The row is written with
   the SERVICE-ROLE key (bypasses RLS); that key is server-only, never in the repo/client. */
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var stripeKey = process.env.STRIPE_SECRET_KEY;
    var supaUrl = process.env.SUPABASE_URL;
    var anonKey = process.env.SUPABASE_ANON_KEY;
    var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!stripeKey || !supaUrl || !anonKey || !serviceKey) { res.status(500).json({ error: "Server not configured" }); return; }

    // --- verify the caller from their Supabase access token ---
    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sign in required" }); return; }
    var supa = createClient(supaUrl, anonKey);
    var userRes = await supa.auth.getUser(token);
    var user = userRes && userRes.data && userRes.data.user;
    if (!user || userRes.error) { res.status(401).json({ error: "Invalid session — sign in again" }); return; }

    var stripe = new Stripe(stripeKey);

    // Find this user's Stripe customer by email (create-checkout reuses/sets the same email).
    var custList = await stripe.customers.list({ email: user.email, limit: 1 });
    var customer = (custList && custList.data && custList.data[0]) || null;
    if (!customer) { res.status(200).json({ active: false, reason: "no_customer" }); return; }

    // Latest subscription for that customer; prefer an active/trialing one.
    var subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    var list = (subs && subs.data) || [];
    var sub = null;
    for (var i = 0; i < list.length; i++) { if (list[i].status === "active" || list[i].status === "trialing") { sub = list[i]; break; } }
    if (!sub) sub = list[0] || null;
    if (!sub) { res.status(200).json({ active: false, reason: "no_subscription" }); return; }

    // Stripe's 2025-03 "Basil" API moved current_period_end onto the subscription item; fall back to it.
    function periodEnd(s) {
      var cpe = s && s.current_period_end;
      if (!cpe && s && s.items && s.items.data && s.items.data[0]) cpe = s.items.data[0].current_period_end;
      return cpe ? new Date(cpe * 1000).toISOString() : null;
    }

    var admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await admin.from("subscriptions").upsert({
      user_id: user.id,
      status: sub.status,
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd(sub),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    var active = (sub.status === "active" || sub.status === "trialing");
    res.status(200).json({ active: active, status: sub.status });
  } catch (err) {
    console.error("confirm-checkout error:", (err && err.message) || err, (err && err.type) || "");
    res.status(500).json({ error: (err && err.message) || "Confirm failed" });
  }
};
