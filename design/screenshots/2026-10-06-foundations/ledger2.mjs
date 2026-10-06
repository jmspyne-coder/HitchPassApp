// Rows 5, 7, 12, 14(addresses), 10b(reminder_on with stubbed push). Needs qa-creds.json from ledger.mjs row 4 SIGNUP run.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/jim/best-frand/web/node_modules/playwright");
const S = path.dirname(new URL(import.meta.url).pathname);
const BASE = process.env.BASE; const OUT = process.env.OUT || S;
const BASES = (process.env.BASES || BASE).split(",");
fs.mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(fs.readFileSync(path.join(S, "qa-creds.json"), "utf8"));
const browser = await chromium.launch();
const mk = (extra = {}) => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write", "notifications"], ...extra });
const ready = (p) => p.waitForFunction(() => document.querySelectorAll("[data-act=nav]").length >= 7, null, { timeout: 20000 });
const log = (row, status, ev) => console.log(`ROW ${row} ${status} :: ${ev}`);
const signIn = async (page) => {
  await page.click("[data-act=nav][data-arg=profile]");
  await page.click("[data-act=auth-open][data-arg=login]");
  await page.fill("[data-auth=email]", creds.email); await page.fill("[data-auth=password]", creds.pw);
  await page.click("[data-act=auth-submit]");
  await page.waitForFunction(() => !document.querySelector("[data-act=auth-submit]"), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
};

// Row 5
{
  const ctx = await mk(); const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await ready(page);
  const seeded = { wallet: ["tt"], favorites: [2, 5], trips: [{ id: 5, parkId: 2, dateIn: "2027-08-01", dateOut: "2027-08-04", network: "tt", confirmation: "ROW5", note: "", booked: true, overStay: false }], profile: { members: {}, rigLength: null }, tier: "adventure", stays: [], watch: {} };
  await page.evaluate((s) => localStorage.setItem("hitchpass.v1", JSON.stringify(s)), seeded);
  await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
  const before = await page.evaluate(() => localStorage.getItem("hitchpass.v1"));
  await signIn(page);
  const after = await page.evaluate(() => localStorage.getItem("hitchpass.v1"));
  const txt = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, "row05-profile-after-signin.png") });
  log(5, JSON.parse(before).favorites.join() === JSON.parse(after).favorites.join() && JSON.parse(before).trips.length === JSON.parse(after).trips.length && txt.includes(creds.email) ? "GREEN" : "RED",
    `signed in from Profile as ${creds.email}; localStorage hitchpass.v1 identical before/after=${before === after}; favorites ${JSON.parse(after).favorites}; trips ${JSON.parse(after).trips.length}; Profile shows "Signed in as"=${/Signed in as/.test(txt)}`);
  await ctx.close();
}
// Row 7: forced entitlement in the browser (request interception only; no database row touched)
{
  const ctx = await mk({ serviceWorkers: "block" }); const page = await ctx.newPage();
  const hits = [];
  await page.route(/\/rest\/v1\/subscriptions/, (r) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,OPTIONS" };
    hits.push(r.request().method());
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    return r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify([{ status: "active" }]) });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await ready(page);
  await signIn(page);
  await page.waitForTimeout(1500);
  const txt = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, "row07-active-subscription-forced.png"), fullPage: false });
  log(7, /ACTIVE/i.test(txt) && /Manage \/ cancel subscription/.test(txt) ? "GREEN" : "RED", `requests intercepted in-browser (${hits.join(",")}) -> [{"status":"active"}] with CORS headers; no DB row touched; Profile shows ACTIVE badge=${/ACTIVE/i.test(txt)}; Manage / cancel subscription button=${/Manage \/ cancel subscription/.test(txt)}`);
  await ctx.close();
}
// Row 12 + row 14 (per-address sw version)
{
  const ctx = await mk(); const page = await ctx.newPage();
  const r = await ctx.request.get(BASE.replace(/\/$/, "") + "/welcome");
  const html = await r.text();
  const pick = (re) => (html.match(re) || [])[1];
  const ev = { status: r.status(), canonical: pick(/rel="canonical" href="([^"]+)"/), ogUrl: pick(/property="og:url" content="([^"]+)"/), ogImage: pick(/property="og:image" content="([^"]+)"/), twitterImage: pick(/name="twitter:image" content="([^"]+)"/), jsonLdUrl: pick(/"url": "([^"]+)"/), boondockers: /boondockers/i.test(html), vercelAppStrings: (html.match(/vercel\.app/g) || []).length };
  const ok = ev.status === 200 && [ev.canonical, ev.ogUrl, ev.ogImage, ev.twitterImage, ev.jsonLdUrl].every((u) => u && u.startsWith("https://hitchpass.app/")) && !ev.boondockers;
  log(12, ok ? "GREEN" : "RED", JSON.stringify(ev));
  const sw = [];
  for (const b of BASES) { const rr = await ctx.request.get(b.replace(/\/$/, "") + "/sw.js"); const t = await rr.text(); sw.push(`${b}: ${rr.status()} ${(t.match(/var CACHE = "([^"]+)"/) || [])[1]}`); }
  log("14a", sw.every((x) => /hitchpass-v25/.test(x)) ? "GREEN" : "RED", sw.join(" | "));
  const og = await ctx.request.get(BASE.replace(/\/$/, "") + "/og-image.png"); log("1-og", og.status() === 200 ? "GREEN" : "RED", `og-image.png ${og.status()} ${og.headers()["content-type"]}`);
  await ctx.close();
}
// Row 10b: reminder_on, with push subscribe + /api/push-register stubbed so no server row is written
{
  const ctx = await mk(); const page = await ctx.newPage(); const names = [];
  page.on("request", (q) => { if (/google-analytics\.com\/g\/collect/.test(q.url())) { const body = q.postData() || ""; const u = q.url(); [...(u.match(/[?&]en=([^&]+)/g) || []), ...(body.match(/(?:^|[&\n])en=[^&\n]+/g) || [])].forEach((m) => names.push(m.replace(/^[?&\n]?en=/, ""))); } });
  await page.route("**/api/push-register", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{\"ok\":true}" }));
  await page.addInitScript(() => {
    const fake = { toJSON: () => ({ endpoint: "https://example.invalid/qa-stub", keys: { p256dh: "x", auth: "y" } }) };
    if (window.PushManager) PushManager.prototype.subscribe = async () => fake;
    if (window.PushManager) PushManager.prototype.getSubscription = async () => fake;
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await ready(page);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("hitchpass.v1") || "{}"); s.trips = [{ id: 1, parkId: 1, dateIn: "2027-06-10", dateOut: "2027-06-14", network: "tt", confirmation: "", note: "", booked: false, overStay: false }]; localStorage.setItem("hitchpass.v1", JSON.stringify(s)); });
  await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
  await signIn(page);
  await page.click("[data-act=nav][data-arg=trips]"); await page.waitForSelector("[data-act=enable-push]");
  await page.click("[data-act=enable-push]"); await page.waitForTimeout(6000); await page.close();
  log("10b", names.includes("reminder_on") ? "GREEN" : "RED", `signed-in turn on with subscribe()+/api/push-register stubbed in the browser (no server write); GA events seen=${JSON.stringify(names)}`);
  await ctx.close();
}
await browser.close();
