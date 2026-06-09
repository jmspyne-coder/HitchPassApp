/* Hitch Pass service worker — offline-first for a single static app.
   App data lives in localStorage, so only the static shell is cached. */
var CACHE = "hitchpass-v1";

/* Same-origin shell — must all cache or install fails (these always exist). */
var LOCAL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

/* Cross-origin (Google Fonts CSS) — best-effort, never fail install offline. */
var EXTERNAL = [
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(LOCAL).then(function(){
        return Promise.all(EXTERNAL.map(function(u){ return c.add(u).catch(function(){}); }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached;
      return fetch(req).then(function(res){
        /* runtime-cache successful or opaque responses (e.g. font woff2) */
        if (res && (res.ok || res.type === "opaque")){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        /* offline + uncached: fall back to the app shell for navigations */
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
