/* Vercel serverless function: claim an invite code for a free comped year.
   Verifies the caller's Supabase JWT, then calls the claim_invite() DB function
   (service role) which atomically enforces the redemption cap and comps the user.
   Returns { result: 'granted' | 'already' | 'exhausted' | 'invalid' }. */
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    var supaUrl = process.env.SUPABASE_URL;
    var anonKey = process.env.SUPABASE_ANON_KEY;
    var svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supaUrl || !anonKey || !svcKey) { res.status(500).json({ error: "Server not configured" }); return; }

    var authz = req.headers.authorization || "";
    var token = authz.indexOf("Bearer ") === 0 ? authz.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Sign in required" }); return; }

    var body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var code = (body.code || "").toString().toLowerCase().trim();
    if (!code) { res.status(400).json({ error: "Missing invite code" }); return; }

    // verify the caller's identity
    var supaAuth = createClient(supaUrl, anonKey);
    var userRes = await supaAuth.auth.getUser(token);
    var user = userRes && userRes.data && userRes.data.user;
    if (!user || userRes.error) { res.status(401).json({ error: "Invalid session" }); return; }

    // claim atomically with the service role
    var svc = createClient(supaUrl, svcKey);
    var rpc = await svc.rpc("claim_invite", { p_code: code, p_user: user.id });
    if (rpc.error) { console.error("claim_invite error:", rpc.error); res.status(500).json({ error: "Could not claim invite" }); return; }

    res.status(200).json({ result: rpc.data });   // 'granted' | 'already' | 'exhausted' | 'invalid'
  } catch (err) {
    console.error("claim-invite error:", err);
    res.status(500).json({ error: (err && err.message) || "Claim failed" });
  }
};
