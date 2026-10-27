const CACHE = "les-cartes-v19";
// Only the normal shell is preloaded. Seasonal and rare art load when displayed.
const SHELL = ["./", "./index.html", "./styles.css?v=19", "./daylight.css?v=19", "./halloween.css?v=19", "./booster-motion.css?v=19", "./experience.css?v=19", "./polish.css?v=19", "./booster-gesture.js?v=19", "./app.js?v=19", "./card-transport.js?v=19", "./season-banner.js?v=19", "./depressive-deck.js?v=19", "./depressive-deck.css?v=19", "./economy.js?v=19", "./economy.css?v=19", "./assets/card-atlas.webp", "./manifest.webmanifest", "./icon.svg"];
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
    if (image) { const cached = await caches.match(event.request); if (cached) return cached; }
    try {
      const response = await fetch(event.request);
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }
  })());
});
