const CACHE = "les-cartes-v37";
// Only the normal shell is preloaded. Seasonal and rare art load when displayed.
const SHELL = ["./", "./index.html", "./styles.css?v=28", "./daylight.css?v=28", "./halloween.css?v=29", "./booster-motion.css?v=28", "./experience.css?v=28", "./polish.css?v=32", "./glass.css?v=5", "./booster-gesture.js?v=28", "./season-dates.js?v=30", "./halloween-atmosphere.js?v=30", "./app.js?v=31", "./card-transport.js?v=28", "./season-banner.js?v=30", "./depressive-deck.js?v=28", "./depressive-deck.css?v=28", "./economy.js?v=28", "./economy.css?v=28", "./push-client.js?v=2", "./assets/card-atlas.webp", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("message", event => {if(event.data?.type === "ACTIVATE") self.skipWaiting();});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("les-cartes-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const image = /\.(webp|png|jpg|svg)$/.test(url.pathname);
  event.respondWith((async () => {
    if (image) { const cache = await caches.match(event.request); if (cache) return cache; }
    try {
      const response = await fetch(event.request);
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    } catch {
      const cache = await caches.match(event.request);
      if (cache) return cache;
      if (event.request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }
  })());
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "Les Cartes à deux", {
    body: data.body || "Une nouvelle attend votre retour.",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "les-cartes",
    data: { path: data.path || "./" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async()=>{
    const scope=new URL(self.registration.scope);
    let target;try{target=new URL(event.notification.data?.path||'./',scope);}catch{target=scope;}
    if(target.origin!==scope.origin||!target.pathname.startsWith(scope.pathname))target=scope;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){if(client.url.startsWith(scope.href)&&'focus' in client){await client.navigate(target.href);return client.focus();}}
    return self.clients.openWindow(target.href);
  })());
});
