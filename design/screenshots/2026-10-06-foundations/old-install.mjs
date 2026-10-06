// Rows 13/14 helper. MODE=seed (before merge, old build) | MODE=verify (after deploy).
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/jim/best-frand/web/node_modules/playwright");
const S = path.dirname(new URL(import.meta.url).pathname);
const PROFILE = path.join(S, "old-install-profile");
const OLD = "https://hitchpass.vercel.app";
const MODE = process.env.MODE;
const OUT = process.env.OUT || S;
fs.mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = ctx.pages()[0] || (await ctx.newPage());
const cacheKeys = () => page.evaluate(async () => (await caches.keys()).sort());
const swText = () => page.evaluate(async () => (await (await fetch("/sw.js", { cache: "no-store" })).text()).match(/var CACHE = "([^"]+)"/)?.[1]);

if (MODE === "seed") {
  await page.goto(OLD, { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || true);
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(2500);
  const seeded = {
    wallet: ["tt", "enc"], favorites: [3], trips: [{ id: 111, parkId: 3, dateIn: "2027-07-01", dateOut: "2027-07-05", network: "tt", confirmation: "OLD-INSTALL-1", note: "seeded before deploy", booked: true, overStay: false }],
    profile: { members: {}, rigLength: null }, tier: "adventure", stays: [], watch: {},
  };
  await page.evaluate((s) => localStorage.setItem("hitchpass.v1", JSON.stringify(s)), seeded);
  const info = { origin: await page.evaluate(() => location.origin), servedSwCache: await swText(), caches: await cacheKeys(), swController: await page.evaluate(() => !!navigator.serviceWorker.controller), seeded };
  console.log("SEEDED", JSON.stringify(info));
  fs.writeFileSync(path.join(OUT, "old-install-seed.json"), JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT, "row13-before-deploy-old-build.png") });
}
if (MODE === "verify") {
  const before = await (async () => { await page.goto("about:blank"); return null; })();
  await page.goto(OLD, { waitUntil: "load" });
  const first = { url: page.url(), caches: await cacheKeys(), controllerAtLoad: await page.evaluate(() => !!navigator.serviceWorker.controller) };
  await page.waitForTimeout(5000);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("[data-act=nav]").length >= 7, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const after = { url: page.url(), caches: await cacheKeys(), servedSwCache: await swText() };
  const v1 = JSON.parse(await page.evaluate(() => localStorage.getItem("hitchpass.v1")));
  const home = await page.evaluate(() => ({ nav: document.querySelectorAll("[data-act=nav]").length, login: /Log in|Create your account/i.test(document.body.innerText) }));
  await page.screenshot({ path: path.join(OUT, "row13-after-deploy-old-address.png") });
  const promptOnOldInstall = await page.evaluate(() => document.querySelector("[data-act=tip-bg]") ? "tip" : document.querySelector("[data-act=share-prompt-bg]") ? "share" : "none");
  if (promptOnOldInstall === "tip") await page.click("[data-act=tip-dismiss]");
  const firstSeenStamp = await page.evaluate(() => localStorage.getItem("hitchpass.firstSeen"));
  await page.click("[data-act=nav][data-arg=trips]"); await page.waitForTimeout(400);
  const tripsText = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(OUT, "row13-after-deploy-trips-still-there.png") });
  const out = { first, after, localStorageAfter: { favorites: v1.favorites, trips: v1.trips.map((t) => t.confirmation) }, home, tripShowsSeeded: /OLD-INSTALL-1|Jul 1/.test(tripsText), addressBarStillOld: page.url().startsWith(OLD), promptOnOldInstall, firstSeenStamp };
  console.log("VERIFY", JSON.stringify(out));
  fs.writeFileSync(path.join(OUT, "old-install-verify.json"), JSON.stringify(out, null, 2));
}
await ctx.close();
