/* Daily Vercel Cron: send "your booking window is open" Web Push for reminders due today.
   Protected by CRON_SECRET (Vercel attaches it as Authorization: Bearer <secret> on cron requests). */
const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");

module.exports = async (req, res) => {
  try {
    var secret = process.env.CRON_SECRET;
    if (secret) {
      var authz = req.headers.authorization || "";
      if (authz !== "Bearer " + secret) { res.status(401).json({ error: "Unauthorized" }); return; }
    }
    var supaUrl = process.env.SUPABASE_URL, svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subj = process.env.VAPID_SUBJECT || "mailto:jmspyne@gmail.com";
    if (!supaUrl || !svcKey || !pub || !priv) { res.status(500).json({ error: "Server not configured" }); return; }
    webpush.setVapidDetails(subj, pub, priv);

    var svc = createClient(supaUrl, svcKey);
    var today = new Date().toISOString().slice(0, 10);
    var due = await svc.from("push_reminders").select("*").lte("fire_on", today).eq("sent", false);
    if (due.error) { console.error(due.error); res.status(500).json({ error: "query failed" }); return; }
    var reminders = due.data || [], sent = 0;

    for (var i = 0; i < reminders.length; i++) {
      var rem = reminders[i];
      var subs = await svc.from("push_subscriptions").select("*").eq("user_id", rem.user_id);
      var list = subs.data || [];
      var payload = JSON.stringify({
        title: "Booking window open 🏕️",
        body: (rem.park_name ? rem.park_name + ": " : "") + "your booking window is open — reserve now.",
        url: "https://hitchpass.vercel.app/"
      });
      for (var j = 0; j < list.length; j++) {
        var s = list[j];
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          sent++;
        } catch (e) {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) { await svc.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
        }
      }
      await svc.from("push_reminders").update({ sent: true }).eq("user_id", rem.user_id).eq("trip_id", rem.trip_id);
    }
    res.status(200).json({ ok: true, due: reminders.length, sent: sent });
  } catch (err) { console.error("cron-push:", err); res.status(500).json({ error: (err && err.message) || "Failed" }); }
};
