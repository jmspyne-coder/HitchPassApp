/*
 * geocode_parks.js — one-time build step (NOT runtime).
 *
 * Reads the PARKS array from ../index.html, geocodes every Thousand Trails
 * park (network "tt", which has city+st) via the free OSM Nominatim API,
 * caches results to ./geocode_cache.json, and writes lat/lng back into the
 * tt rows of index.html. Encore/RPI/C2C/HH get no coordinates.
 *
 * Nominatim usage policy: real User-Agent, max 1 request/second, cache so a
 * lookup never repeats. Run:  node tools/geocode_parks.js
 */
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
const CACHE = path.join(__dirname, "geocode_cache.json");
const UA = "HitchPass/1.0 (jmspyne@gmail.com)";   // real contact per Nominatim policy
const SLEEP_MS = 1100;                            // throttle: < 1 req/sec

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCache(){ try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return {}; } }
function saveCache(c){ fs.writeFileSync(CACHE, JSON.stringify(c, null, 2)); }

async function geocode(city, st, cache){
  const key = (city + "|" + st).toLowerCase();
  if (cache[key]) return cache[key];                 // cached (hit or recorded miss)
  const q = encodeURIComponent(`${city}, ${st}, USA`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  let result = { fail: true };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (res.ok){
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0] && arr[0].lat && arr[0].lon){
        result = { lat: +(+arr[0].lat).toFixed(5), lng: +(+arr[0].lon).toFixed(5) };
      }
    } else {
      console.log(`  HTTP ${res.status} for ${city}, ${st}`);
    }
  } catch (e){
    console.log(`  error for ${city}, ${st}: ${e.message}`);
  }
  cache[key] = result;
  saveCache(cache);
  await sleep(SLEEP_MS);                              // throttle only on a real network call
  return result;
}

function parseParks(html){
  const m = html.match(/var PARKS = \[([\s\S]*?)\n  \];/);
  if (!m) throw new Error("PARKS array not found in index.html");
  const lines = m[1].split("\n");
  const parks = [];
  lines.forEach((line, i) => {
    const id = line.match(/id:(\d+)/);
    const net = line.match(/network:"(\w+)"/);
    const city = line.match(/city:"([^"]*)"/);
    const st = line.match(/st:"(\w+)"/);
    const hasCoord = /lat:/.test(line);
    if (id && net) parks.push({ idx: i, id: +id[1], network: net[1], city: city ? city[1] : "", st: st ? st[1] : "", hasCoord, line });
  });
  return { block: m[0], inner: m[1], lines, parks };
}

(async () => {
  const html = fs.readFileSync(HTML, "utf8");
  const { lines, parks } = parseParks(html);
  const tt = parks.filter((p) => p.network === "tt" && p.city && p.st);
  console.log(`Found ${parks.length} parks; ${tt.length} TT parks to geocode.`);

  const cache = loadCache();
  let ok = 0, fail = 0;
  for (const p of tt){
    if (p.hasCoord){ ok++; continue; }               // already has coords from a prior run
    const g = await geocode(p.city, p.st, cache);
    if (g && !g.fail){
      // insert ", lat:X, lng:Y" before the closing brace, preserving a trailing comma
      lines[p.idx] = p.line.replace(/\s*\}(,?)\s*$/, `, lat:${g.lat}, lng:${g.lng} }$1`);
      ok++;
      process.stdout.write(`  ✓ ${p.city}, ${p.st} -> ${g.lat},${g.lng}\n`);
    } else {
      fail++;
      process.stdout.write(`  ✗ ${p.city}, ${p.st} (no result — stays list-only)\n`);
    }
  }

  // splice modified lines back into the PARKS block
  const newInner = lines.join("\n");
  const newHtml = html.replace(/var PARKS = \[[\s\S]*?\n  \];/, "var PARKS = [" + newInner + "\n  ];");
  fs.writeFileSync(HTML, newHtml);

  console.log(`\nGeocoded ${ok}/${tt.length} TT parks (${fail} failed). Wrote lat/lng into index.html.`);
})();
