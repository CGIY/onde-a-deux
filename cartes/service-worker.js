const CACHE = "les-cartes-v24";
// Only the normal shell is preloaded. Seasonal and rare art load when displayed.
const SHELL = ["./", "./index.html", "./styles.css?v=24", "./daylight.css?v=24", "./halloween.css?v=24", "./booster-motion.css?v=24", "./experience.css?v=24", "./polish.css?v=24", "./booster-gesture.js?v=24", "./app.js?v=24", "./card-transport.js?v=24", "./season-banner.js?v=24", "./depressive-deck.js?v=24", "./depressive-deck.css?v=24", "./economy.js?v=24", "./economy.css?v=24", "./push-client.js?v=2", "./assets/card-atlas.webp", "./manifest.webmanifest", "./icon.svg"];
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
