/* Vercel serverless function: Stripe webhook -> upsert paid status into Supabase.
   Verifies the Stripe signature against the RAW request body (bodyParser disabled below).
   Writes with the SERVICE-ROLE key (bypasses RLS) — this key is server-only, never in the repo/client.

   HARDENING (July 2026):
   1. On EVERY handled event we persist the full linkage together — stripe_customer_id AND
      stripe_subscription_id — so a row can never carry a customer id without a subscription id.
      (Giveaway rows written by claim-invite.js have neither; the webhook never touches them.)
   2. A status-precedence guard stops out-of-order events from downgrading a live subscription:
      an `incomplete` from `customer.subscription.created` arriving after checkout can no longer
      overwrite `active`. Status rank may only be LOWERED by an explicit end-state event
      (deleted / payment_failed) or by an `updated` event for the SAME subscription id.

   NOTE ON IDENTITY: create-checkout.js sets the session `client_reference_id` (the Supabase
   user id) but does not stamp subscription metadata, so `customer.subscription.*` and
   `invoice.*` events resolve the user by looking up the existing row via stripe_customer_id.
   That row is written first by checkout.session.completed / confirm-checkout.js, so by the time
   lifecycle events arrive it exists. If it somehow does not yet, we skip and log rather than guess. */
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

// Status precedence. Higher rank = "more entitled". A write may only LOWER rank under the
// allowed-lowering rule below. active and trialing are equal (both grant Pro).
//   active = trialing (4) > past_due (3) > incomplete / paused (2) > canceled / unpaid / incomplete_expired (1, terminal)
function statusRank(s) {
  switch (s) {
    case "active":
    case "trialing": return 4;
    case "past_due": return 3;
    case "incomplete":
    case "paused": return 2;
    case "canceled":
    case "unpaid":
    case "incomplete_expired": return 1;
    default: return 2; // unknown/future status: treat as mid-low so it can't silently clobber active
  }
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

  // --- verify signature against the raw body (unchanged; do not remove) ---
  var event;
  try {
    var buf = await rawBody(req);
    var sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err) {
    res.status(400).end("Webhook signature verification failed: " + ((err && err.message) || "")); return;
  }

  function periodEnd(sub) {
    // Stripe's 2025-03 "Basil" API moved current_period_end off the subscription object
    // onto each subscription item, so fall back to the first item when the top-level is absent.
    var cpe = sub && sub.current_period_end;
    if (!cpe && sub && sub.items && sub.items.data && sub.items.data[0]) cpe = sub.items.data[0].current_period_end;
    return cpe ? new Date(cpe * 1000).toISOString() : null;
  }

  // Pull a subscription id out of an invoice across API-version shapes.
  function subIdFromInvoice(inv) {
    if (!inv) return null;
    if (inv.subscription) return typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id;
    if (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) {
      var sd = inv.parent.subscription_details.subscription;
      return typeof sd === "string" ? sd : (sd && sd.id) || null;
    }
    if (inv.lines && inv.lines.data) {
      for (var i = 0; i < inv.lines.data.length; i++) {
        var ln = inv.lines.data[i];
        if (ln.subscription) return typeof ln.subscription === "string" ? ln.subscription : ln.subscription.id;
        if (ln.parent && ln.parent.subscription_item_details && ln.parent.subscription_item_details.subscription) {
          return ln.parent.subscription_item_details.subscription;
        }
      }
    }
    return null;
  }

  // Best-effort user id from an object's metadata (create-checkout doesn't set it today, but
  // honor it if a future change does — cheaper and more direct than a customer lookup).
  function metaUserId(obj) {
    var m = obj && obj.metadata;
    return (m && (m.user_id || m.userId || m.client_reference_id)) || null;
  }

  // Load the existing row by user id first, else by customer id. Returns the row or null.
  async function loadExisting(userId, customerId) {
    if (userId) {
      var r = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
      if (r && r.data) return r.data;
    }
    if (customerId) {
      var r2 = await admin.from("subscriptions").select("*").eq("stripe_customer_id", customerId).maybeSingle();
      if (r2 && r2.data) return r2.data;
    }
    return null;
  }

  /* The single write path. `intent` = { eventType, userId, customerId, subId, status, periodEnd }.
     - Resolves the user id (intent, else the existing row's).
     - Coalesces linkage/period so a null in the event never erases a known stored value.
     - Applies the precedence guard, then upserts on user_id (never inserts a duplicate).
     Returns a short action string for logging. */
  async function persist(intent) {
    var existing = await loadExisting(intent.userId, intent.customerId);
    var userId = intent.userId || (existing && existing.user_id) || null;
    if (!userId) return "skip_no_user";

    var customerId = intent.customerId || (existing && existing.stripe_customer_id) || null;
    var subId = intent.subId || (existing && existing.stripe_subscription_id) || null;
    var pEnd = intent.periodEnd || (existing && existing.current_period_end) || null;

    // Invariant: never persist a customer id without a subscription id (giveaway rows, which have
    // neither, are written elsewhere). If we somehow lack a sub id here, skip rather than half-write.
    if (customerId && !subId) return "skip_incomplete_linkage";

    // Precedence guard.
    var finalStatus = intent.status;
    var action = "write";
    if (existing && existing.status) {
      var incRank = statusRank(intent.status);
      var stoRank = statusRank(existing.status);
      if (incRank < stoRank) {
        var lowerAllowed =
          intent.eventType === "customer.subscription.deleted" ||
          intent.eventType === "invoice.payment_failed" ||
          (intent.eventType === "customer.subscription.updated" &&
           intent.subId && existing.stripe_subscription_id &&
           intent.subId === existing.stripe_subscription_id);
        if (!lowerAllowed) {
          // Keep the higher stored status, but still persist the linkage/period (this is what
          // backfills a missing stripe_subscription_id when a stray `created` arrives late).
          finalStatus = existing.status;
          action = "linkage_only_status_preserved";
        }
      }
    }

    await admin.from("subscriptions").upsert({
      user_id: userId,
      status: finalStatus,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      current_period_end: pEnd,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    return action + "(status=" + finalStatus + ")";
  }

  try {
    var action = "ignored";
    var logCustomer = "";
    var t = event.type;

    if (t === "checkout.session.completed") {
      var session = event.data.object;
      var userId = session.client_reference_id || metaUserId(session);
      var customerId = session.customer || null;
      var subId = session.subscription || null;
      logCustomer = customerId || "";
      if (subId) {
        // Retrieve the subscription so the id + real status + period land at first write.
        var sub = await stripe.subscriptions.retrieve(subId);
        action = await persist({
          eventType: t,
          userId: userId,
          customerId: customerId || sub.customer,
          subId: subId,
          status: sub.status,
          periodEnd: periodEnd(sub)
        });
      } else {
        action = "skip_no_subscription_on_session";
      }

    } else if (t === "customer.subscription.created" ||
               t === "customer.subscription.updated" ||
               t === "customer.subscription.deleted") {
      var s = event.data.object;
      logCustomer = s.customer || "";
      action = await persist({
        eventType: t,
        userId: metaUserId(s),
        customerId: s.customer,
        subId: s.id,
        status: (t === "customer.subscription.deleted") ? "canceled" : s.status,
        periodEnd: periodEnd(s)
      });

    } else if (t === "invoice.payment_failed") {
      var inv = event.data.object;
      var invCustomer = (typeof inv.customer === "string" ? inv.customer : (inv.customer && inv.customer.id)) || null;
      var invSubId = subIdFromInvoice(inv);
      logCustomer = invCustomer || "";
      // Pull the live subscription for an accurate post-failure status; fall back to past_due.
      var failStatus = "past_due";
      var failPeriodEnd = null;
      if (invSubId) {
        try {
          var liveSub = await stripe.subscriptions.retrieve(invSubId);
          failStatus = liveSub.status;
          failPeriodEnd = periodEnd(liveSub);
        } catch (e) { /* keep past_due fallback */ }
      }
      action = await persist({
        eventType: t,
        userId: null,
        customerId: invCustomer,
        subId: invSubId,
        status: failStatus,
        periodEnd: failPeriodEnd
      });
    }

    // Minimal per-event diagnostic so Vercel runtime logs become useful.
    console.log("stripe-webhook: type=" + t + " customer=" + (logCustomer || "-") + " action=" + action);

    res.status(200).json({ received: true });
  } catch (err) {
    // Acknowledge receipt so Stripe doesn't hammer retries on a transient DB error; log for debugging.
    console.error("stripe-webhook handler error:", (err && err.message) || err);
    res.status(200).json({ received: true, note: "handler error logged" });
  }
};
