/* Hitch Pass service worker — offline-first for a single static app.
   App data lives in localStorage, so only the static shell is cached. */
var CACHE = "hitchpass-v11";

/* Same-origin shell — must all cache or install fails (these always exist).
   Icons carry ?v=2 to match the head/manifest hrefs (defeats HTTP cache on logo refresh). */
var LOCAL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.svg?v=2",
  "./favicon-32.png?v=2",
  "./apple-touch-icon-180.png?v=2",
  "./icon.svg?v=2",
  "./icon-192.png?v=2",
  "./icon-512.png?v=2",
  "./icon-maskable-512.png?v=2"
];

/* Cross-origin (Google Fonts CSS, Supabase JS) — best-effort, never fail install offline. */
var EXTERNAL = [
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js"
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

  /* Navigations: network-first so shell updates ship immediately; cache offline. */
  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(r){ return r || caches.match("./"); });
      })
    );
    return;
  }

  /* Everything else (icons, fonts, Leaflet + markercluster JS/CSS, map tiles): cache-first,
     runtime-cache. Leaflet/markercluster are CDN assets cached on first fetch (not pre-cached),
     so offline works after the first online map load. */
  e.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached;
      return fetch(req).then(function(res){
        if (res && (res.ok || res.type === "opaque")){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){ return Response.error(); });
    })
  );
});

/* ---- Web Push: booking-window alerts ---- */
self.addEventListener("push", function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(_){}
  var title = data.title || "Hitch Pass";
  var opts = {
    body: data.body || "",
    icon: "./icon-192.png?v=2",
    badge: "./icon-192.png?v=2",
    data: { url: data.url || "./" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({ type:"window" }).then(function(cl){
      for (var i=0;i<cl.length;i++){ if (cl[i].url.indexOf(url)>=0 && "focus" in cl[i]) return cl[i].focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
