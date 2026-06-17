/* Store a user's Web Push subscription + their booking-window reminder schedule.
   Verifies the Supabase JWT, then upserts via service role. Body: { subscription, reminders:[{trip_id,park_name,fire_on}] } */
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var supaUrl = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY, svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supaUrl || !anonKey || !svcKey) { res.status(500).json({ error: "Server not configured" }); return; }

    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sign in required" }); return; }

    var body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var sub = body.subscription, reminders = Array.isArray(body.reminders) ? body.reminders : [];

    var supaAuth = createClient(supaUrl, anonKey);
    var ures = await supaAuth.auth.getUser(token);
    var user = ures && ures.data && ures.data.user;
    if (!user || ures.error) { res.status(401).json({ error: "Invalid session" }); return; }

    var svc = createClient(supaUrl, svcKey);

    if (sub && sub.endpoint && sub.keys) {
      var up = await svc.from("push_subscriptions").upsert(
        { endpoint: sub.endpoint, user_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        { onConflict: "endpoint" });
      if (up.error) console.error("sub upsert:", up.error);
    }

    // Replace this user's reminder set with the current one from the device.
    await svc.from("push_reminders").delete().eq("user_id", user.id);
    var rows = reminders.filter(function (r) { return r && r.trip_id && r.fire_on; })
      .map(function (r) { return { user_id: user.id, trip_id: String(r.trip_id), park_name: (r.park_name || "").slice(0, 120), fire_on: r.fire_on, sent: false }; });
    if (rows.length) { var ins = await svc.from("push_reminders").insert(rows); if (ins.error) console.error("rem insert:", ins.error); }

    res.status(200).json({ ok: true, reminders: rows.length });
  } catch (err) { console.error("push-register:", err); res.status(500).json({ error: (err && err.message) || "Failed" }); }
};
