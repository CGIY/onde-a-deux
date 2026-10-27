const CACHE = "les-cartes-v18";
// Only the normal shell is preloaded. Seasonal and rare art load when displayed.
const SHELL = ["./", "./index.html", "./styles.css?v=18", "./daylight.css?v=18", "./halloween.css?v=18", "./booster-motion.css?v=18", "./experience.css?v=18", "./polish.css?v=18", "./booster-gesture.js?v=18", "./app.js?v=18", "./card-transport.js?v=18", "./season-banner.js?v=18", "./depressive-deck.js?v=18", "./depressive-deck.css?v=18", "./economy.js?v=18", "./economy.css?v=18", "./assets/card-atlas.webp", "./manifest.webmanifest", "./icon.svg"];
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
  event.waitUntil(self.registration.showNotification(data.title || "Les Cartes \u00e0 deux", {
    body: data.body || "Une nouvelle attend votre retour.",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "les-cartes",
    data: { path: data.path || "./" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    for (const client of clients) { if ("focus" in client) { client.focus(); return; } }
    return self.clients.openWindow((event.notification.data && event.notification.data.path) || "./");
  }));
});
