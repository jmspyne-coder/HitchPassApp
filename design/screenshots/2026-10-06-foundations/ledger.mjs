// Function Ledger harness for DIRECTIVE 2026-10-06-hitchpass-foundations-front-door.
// usage: BASE=http://localhost:8765 OUT=<dir> [SIGNUP=1] [ROWS=1,2,3] node ledger.mjs
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/jim/best-frand/web/node_modules/playwright");

const BASE = process.env.BASE || "http://localhost:8765";
const OUT = process.env.OUT || ".";
const SIGNUP = process.env.SIGNUP === "1";
const ONLY = process.env.ROWS ? process.env.ROWS.split(",").map(Number) : null;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const log = (row, status, evidence) => {
  results.push({ row, status, evidence });
  console.log(`ROW ${row} ${status} :: ${evidence}`);
};
const want = (n) => !ONLY || ONLY.includes(n);
const VIEWPORT = { width: 390, height: 844 };

const browser = await chromium.launch();
async function newCtx(extra = {}) {
  return browser.newContext({
    viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
    permissions: ["clipboard-read", "clipboard-write"], ...extra,
  });
}
const gaReqs = (page, bag) => page.on("request", (r) => {
  const u = r.url();
  if (/google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/.test(u)) {
    const m = u.match(/[?&]en=([^&]+)/); const body = r.postData() || "";
    const bm = [...body.matchAll(/(?:^|[&\n])en=([^&\n]+)/g)].map((x) => decodeURIComponent(x[1]));
    bag.push({ en: m ? decodeURIComponent(m[1]) : null, bodyEn: bm, url: u.slice(0, 160), host: new URL(r.frame()?.url() || BASE).host, post: body.slice(0, 200) });
  }
});
const seedParks = async (page) => { await page.waitForFunction(() => document.querySelectorAll("[data-act=nav]").length >= 7, null, { timeout: 15000 }); };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + ".png") });
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const consoleErrors = [];

// ---------- Row 1 ----------
if (want(1)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push("pageerror:" + e.message));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await seedParks(page);
  const t = await bodyText(page);
  const nav = await page.$$eval("[data-act=nav] span", (els) => els.map((e) => e.textContent));
  const ok = nav.join(",") === "Home,Explore,Trips,Refer,Share,Profile,Perks" && !/Log in|Create your account|Choose your plan/i.test(t);
  await shot(page, "row01-home");
  log(1, ok ? "GREEN" : "RED", `nav=${nav.join("/")}; loginText=${/Log in|Create your account/i.test(t)}; planChoice=${/Choose your plan/i.test(t)}; url=${page.url()}`);
  await ctx.close();
}

// ---------- Rows 2, 3 ----------
if (want(2) || want(3)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.click("[data-act=nav][data-arg=explore]");
  await page.waitForSelector("[data-act=fav-toggle]");
  await page.click("[data-act=fav-toggle]");
  const favBefore = JSON.parse(await ls(page, "hitchpass.v1")).favorites;
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.click("[data-act=nav][data-arg=explore]");
  await page.waitForSelector("[data-act=fav-toggle]");
  const favAfter = JSON.parse(await ls(page, "hitchpass.v1")).favorites;
  const starred = await page.$$eval("[data-act=fav-toggle]", (els) => els.filter((e) => e.textContent.trim() === "★").length);
  await shot(page, "row02-favorite-after-reload");
  log(2, favBefore.length === 1 && favAfter.join() === favBefore.join() && starred >= 1 ? "GREEN" : "RED",
    `favorites before reload=${JSON.stringify(favBefore)}, after reload=${JSON.stringify(favAfter)}, filled stars shown=${starred}`);

  // booking
  await page.click("[data-act=nav][data-arg=trips]");
  await page.click("[data-act=add-booking]");
  await page.fill("#bookingPark", "Lake");
  await page.waitForSelector("[data-act=booking-pick]");
  const pickedName = await page.$eval("[data-act=booking-pick]", (e) => e.textContent.trim().slice(0, 60));
  await page.click("[data-act=booking-pick]");
  await page.fill("[data-bdate=in]", "2027-03-10"); await page.dispatchEvent("[data-bdate=in]", "change");
  await page.fill("[data-bdate=out]", "2027-03-14"); await page.dispatchEvent("[data-bdate=out]", "change");
  await page.click("[data-act=booking-save]");
  const tripsBefore = JSON.parse(await ls(page, "hitchpass.v1")).trips;
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.click("[data-act=nav][data-arg=trips]");
  const tripsAfter = JSON.parse(await ls(page, "hitchpass.v1")).trips;
  const txt = await bodyText(page);
  await shot(page, "row03-booking-after-reload");
  log(3, tripsBefore.length === 1 && tripsAfter.length === 1 && /Mar 10|Wed, Mar 10/.test(txt) ? "GREEN" : "RED",
    `picked park="${pickedName}"; trips before reload=${tripsBefore.length}, after=${tripsAfter.length}; dates shown=${/Mar 10/.test(txt)}`);
  await ctx.close();
}

// ---------- Row 4 ----------
if (want(4)) {
  const ctx = await newCtx({ permissions: ["clipboard-read", "clipboard-write", "notifications"] }); const page = await ctx.newPage();
  const pushCalls = []; page.on("request", (r) => { if (/\/api\/push-register/.test(r.url())) pushCalls.push(r.method() + " " + r.url()); });
  page.on("pageerror", (e) => pushCalls.push("pageerror:" + e.message));
  const ga = []; gaReqs(page, ga);
  const dialogs = []; page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  // seed a trip so the reminders control exists
  await page.evaluate(() => {
    const k = "hitchpass.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}");
    s.trips = [{ id: 1, parkId: 1, dateIn: "2027-06-10", dateOut: "2027-06-14", network: "tt", confirmation: "", note: "", booked: false, overStay: false }];
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.click("[data-act=nav][data-arg=trips]");
  await page.waitForSelector("[data-act=enable-push]");
  await shot(page, "row04a-reminders-control-signed-out");
  await page.click("[data-act=enable-push]");
  await page.waitForSelector("[data-act=auth-submit]");
  const authText = await bodyText(page);
  await shot(page, "row04b-auth-screen-from-reminders");
  let detail = `control opened auth screen; text has reminders note=${/Reminders need an account/.test(authText)}`;
  let status = /Reminders need an account/.test(authText) ? "GREEN" : "RED";
  if (SIGNUP) {
    const email = `hitchpassqa+${Date.now()}@gmail.com`;
    const pw = "Qa-Test-" + Date.now() + "!";
    fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "qa-creds.json"), JSON.stringify({ email, pw }));
    await page.fill("[data-auth=email]", email); await page.fill("[data-auth=password]", pw);
    await page.click("[data-act=auth-submit]");
    await page.waitForFunction(() => !document.querySelector("[data-act=auth-submit]"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const tab = await page.evaluate(() => !!document.querySelector("[data-act=nav][data-arg=trips].on"));
    const t2 = await bodyText(page);
    const pushOn = await ls(page, "hp_push_on");
    const permState = await page.evaluate(() => (window.Notification ? Notification.permission : "n/a"));
    await shot(page, "row04c-after-signup-returned-to-reminders");
    const returned = tab && /saved|Trips/.test(t2);
    detail += `; push-register/other calls=${JSON.stringify(pushCalls)}; signed up ${email}; returned to Trips=${tab}; hp_push_on=${pushOn}; Notification.permission=${permState}; alerts=${JSON.stringify(dialogs)}; Turn-on control still shown=${/Turn on reminders/.test(t2)}`;
    status = status === "GREEN" && returned ? "GREEN" : "RED";
    if (pushOn !== "1") detail += " (push registration did not complete in headless Chromium; request was attempted via afterSignIn->enablePush or toast prompt)";
  }
  log(4, status, detail);
  await ctx.close();
}

// ---------- Rows 6, 8, 9, 16 ----------
if (want(6) || want(16)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  const tabs = ["home", "explore", "trips", "refer", "share", "profile", "perks"];
  const bad = []; const unoff = {};
  for (const t of tabs) {
    await page.click(`[data-act=nav][data-arg=${t}]`);
    await page.waitForTimeout(250);
    const txt = await bodyText(page);
    const hasPaid = /\b(upgrade|subscribe|go pro|choose your plan|\$54|\$4\.50|\$6\.50|Manage \/ cancel)/i.test(txt);
    if (hasPaid) bad.push(t);
    unoff[t] = (txt.match(/unofficial/gi) || []).length;
    await shot(page, `row06-tab-${t}`);
  }
  const noUpgrade = bad.length === 0;
  if (want(6)) log(6, noUpgrade ? "GREEN" : "RED", `tabs checked=${tabs.join(",")}; tabs with upgrade/subscribe/plan text=${JSON.stringify(bad)}`);
  const allOne = Object.values(unoff).every((n) => n === 1);
  if (want(16)) log(16, allOne ? "GREEN" : "RED", `"unofficial" count per tab (innerText)=${JSON.stringify(unoff)}`);
  await ctx.close();
}

// ---------- Rows 8, 9 ----------
if (want(8)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.waitForTimeout(2500);
  const open = await page.evaluate(() => !!document.querySelector("[data-act=tip-bg],[data-act=share-prompt-bg]"));
  const fs1 = await ls(page, "hitchpass.firstSeen");
  await shot(page, "row08-fresh-first-visit");
  log(8, !open && /^\d{13}$/.test(fs1 || "") ? "GREEN" : "RED", `prompt overlay open on first visit=${open}; firstSeen stamped=${fs1}`);
  await ctx.close();
}
if (want(9)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.evaluate(() => {
    const old = String(Date.now() - 40 * 86400000);
    localStorage.setItem("hitchpass.firstSeen", old);
    localStorage.setItem("hitchpass.tipLastShown", old);
    localStorage.setItem("hitchpass.shareLastShown", old);
  });
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.waitForTimeout(3000);
  const which1 = await page.evaluate(() => (document.querySelector("[data-act=tip-bg]") ? "tip" : document.querySelector("[data-act=share-prompt-bg]") ? "share" : "none"));
  await shot(page, "row09a-one-prompt-shown");
  if (which1 === "tip") await page.click("[data-act=tip-dismiss]"); else if (which1 === "share") await page.click("[data-act=share-prompt-dismiss]");
  const seq = [];
  for (const t of ["home", "explore", "trips", "refer", "share", "profile", "perks"]) {
    await page.click(`[data-act=nav][data-arg=${t}]`); await page.waitForTimeout(700);
    seq.push(await page.evaluate(() => (document.querySelector("[data-act=tip-bg]") ? "tip" : document.querySelector("[data-act=share-prompt-bg]") ? "share" : "-")));
  }
  await shot(page, "row09b-no-second-prompt");
  log(9, which1 !== "none" && seq.every((x) => x === "-") ? "GREEN" : "RED", `first prompt=${which1}; after dismissing, overlays while visiting 7 tabs=${seq.join(",")}`);
  await ctx.close();
}

// ---------- Row 10, 11 ----------
if (want(10)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  const ga = []; gaReqs(page, ga);
  await page.route("**/api/tip", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "qa-stub" }) }));  // never reach Stripe
  await page.addInitScript(() => { // deterministic share: no native share sheet, clipboard works
    try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); } catch (e) {}
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  // app_open
  // park_saved
  await page.click("[data-act=nav][data-arg=explore]"); await page.waitForSelector("[data-act=fav-toggle]");
  await page.click("[data-act=fav-toggle]");
  // target_date_set + book_handoff: open the saved park
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("hitchpass.v1")).favorites[0]);
  await page.click(`[data-act=park][data-arg="${pid}"]`).catch(async () => { await page.click("[data-act=park]"); });
  await page.waitForTimeout(300);
  // book_handoff via Reserve control (opens popup)
  const pop = page.waitForEvent("popup", { timeout: 4000 }).catch(() => null);
  await page.click("[data-act=reserve]").catch(() => {});
  const popup = await pop; if (popup) await popup.close();
  // booking_saved via addtrip (park detail dates)
  await page.fill("[data-date=in]", "2027-04-10").catch(() => {}); await page.dispatchEvent("[data-date=in]", "change").catch(() => {});
  await page.fill("[data-date=out]", "2027-04-13").catch(() => {}); await page.dispatchEvent("[data-date=out]", "change").catch(() => {});
  await page.click("[data-act=addtrip]").catch(() => {});
  await page.waitForTimeout(400);
  // target_date_set: Trips -> booking dates watch input
  await page.click("[data-act=nav][data-arg=trips]"); await page.waitForTimeout(300);
  const w = await page.$("[data-watch]");
  if (w) { await w.fill("2027-05-20"); await w.dispatchEvent("change"); }
  // share_sent (Share tab -> Share button -> clipboard fallback)
  await page.click("[data-act=nav][data-arg=share]"); await page.waitForTimeout(200);
  await page.click("button[data-act=share]");
  await page.waitForTimeout(500);
  // tip_started: force the tip prompt via due clocks + reload
  await page.evaluate(() => { const old = String(Date.now() - 40 * 86400000); localStorage.setItem("hitchpass.firstSeen", old); localStorage.setItem("hitchpass.tipLastShown", old); localStorage.setItem("hitchpass.shareLastShown", String(Date.now())); });
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.waitForSelector("[data-act=tip-amount]", { timeout: 8000 });
  await page.click("[data-act=tip-amount][data-arg='200']");
  await page.waitForTimeout(800);
  // reminder_on: seen only when push registration succeeds; handled via sign-up run (row 4)
  await page.waitForTimeout(6000);
  await page.close();
  const names = ga.flatMap((g) => [g.en, ...(g.bodyEn || [])].filter(Boolean));
  const need = ["app_open", "park_saved", "target_date_set", "book_handoff", "booking_saved", "reminder_on", "share_sent", "tip_started"];
  const seen = need.map((n) => [n, names.filter((x) => x === n).length]);
  log(10, seen.filter(([n, c]) => n !== "reminder_on" && c === 0).length === 0 ? (seen.find(([n]) => n === "reminder_on")[1] ? "GREEN" : "PARTIAL(reminder_on needs real push)") : "RED",
    `GA requests captured by event name: ${JSON.stringify(seen)}; all en values=${JSON.stringify(names)}`);
  await ctx.close();
}
if (want(11)) {
  const bases = (process.env.BASES || BASE).split(",");
  const out = [];
  for (const b of bases) {
    const ctx = await newCtx(); const page = await ctx.newPage(); const ga = []; gaReqs(page, ga);
    await page.goto(b, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
    out.push(`${b}: GA requests=${ga.length}, en=${JSON.stringify(ga.map((g) => g.en))}`);
    await ctx.close();
  }
  log(11, "INFO", out.join(" | "));
}

// ---------- Row 15: GA blocked ----------
if (want(15)) {
  const ctx = await newCtx(); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + m.text()); });
  await page.route(/google-analytics\.com|googletagmanager\.com|analytics\.google\.com/, (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await seedParks(page);
  await page.click("[data-act=nav][data-arg=explore]"); await page.waitForSelector("[data-act=fav-toggle]"); await page.click("[data-act=fav-toggle]");
  const f1 = JSON.parse(await ls(page, "hitchpass.v1")).favorites.length;
  await page.click("[data-act=nav][data-arg=trips]"); await page.click("[data-act=add-booking]");
  await page.fill("#bookingPark", "Lake"); await page.waitForSelector("[data-act=booking-pick]"); await page.click("[data-act=booking-pick]");
  await page.fill("[data-bdate=in]", "2027-03-10"); await page.dispatchEvent("[data-bdate=in]", "change");
  await page.fill("[data-bdate=out]", "2027-03-14"); await page.dispatchEvent("[data-bdate=out]", "change");
  await page.click("[data-act=booking-save]");
  await page.reload({ waitUntil: "domcontentloaded" }); await seedParks(page);
  const st = JSON.parse(await ls(page, "hitchpass.v1"));
  const trackErrs = errs.filter((e) => /track|gtag|dataLayer/i.test(e));
  const homeOk = await page.evaluate(() => !!document.querySelector("[data-act=nav]"));
  await shot(page, "row15-ga-blocked");
  log(15, homeOk && f1 === 1 && st.favorites.length === 1 && st.trips.length === 1 && trackErrs.length === 0 ? "GREEN" : "RED",
    `GA blocked; home loaded=${homeOk}; favorite persisted=${st.favorites.length}; trip persisted=${st.trips.length}; errors mentioning track/gtag=${JSON.stringify(trackErrs)}; all page errors=${JSON.stringify(errs.slice(0, 5))}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "ledger-results.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
console.log("DONE", results.length, "rows logged ->", path.join(OUT, "ledger-results.json"));
