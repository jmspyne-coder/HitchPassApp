/* Vercel serverless function: Stripe webhook -> upsert paid status into Supabase.
   Verifies the Stripe signature against the RAW request body (bodyParser disabled below).
   Writes with the SERVICE-ROLE key (bypasses RLS) — this key is server-only, never in the repo/client. */
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// Stripe signature verification needs the raw bytes, so turn off Vercel's body parsing.
module.exports.config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    var chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end("Method not allowed"); return; }

  var stripeKey = process.env.STRIPE_SECRET_KEY;
  var whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  var supaUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !whSecret || !supaUrl || !serviceKey) { res.status(500).end("Server not configured"); return; }

  var stripe = new Stripe(stripeKey);
  var admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // --- verify signature against the raw body ---
  var event;
  try {
    var buf = await rawBody(req);
    var sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err) {
    res.status(400).end("Webhook signature verification failed: " + ((err && err.message) || "")); return;
  }

  async function upsert(row) {
    row.updated_at = new Date().toISOString();
    await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
  }
  function periodEnd(sub) {
    // Stripe's 2025-03 "Basil" API moved current_period_end off the subscription object
    // onto each subscription item, so fall back to the first item when the top-level is absent.
    var cpe = sub && sub.current_period_end;
    if (!cpe && sub && sub.items && sub.items.data && sub.items.data[0]) cpe = sub.items.data[0].current_period_end;
    return cpe ? new Date(cpe * 1000).toISOString() : null;
  }
  async function userIdForCustomer(customerId) {
    var r = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    return (r && r.data) ? r.data.user_id : null;
  }

  try {
    if (event.type === "checkout.session.completed") {
      var session = event.data.object;
      var userId = session.client_reference_id;
      var customerId = session.customer;
      var subId = session.subscription;
      if (userId && subId) {
        var sub = await stripe.subscriptions.retrieve(subId);
        await upsert({
          user_id: userId,
          status: sub.status,
          stripe_customer_id: customerId || sub.customer,
          stripe_subscription_id: subId,
          current_period_end: periodEnd(sub)
        });
      }
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      var s = event.data.object;
      var uid = await userIdForCustomer(s.customer);
      if (uid) {
        await upsert({
          user_id: uid,
          status: event.type === "customer.subscription.deleted" ? "canceled" : s.status,
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.id,
          current_period_end: periodEnd(s)
        });
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    // Acknowledge receipt so Stripe doesn't hammer retries on a transient DB error; log for debugging.
    console.error("webhook handler error:", (err && err.message) || err);
    res.status(200).json({ received: true, note: "handler error logged" });
  }
};
