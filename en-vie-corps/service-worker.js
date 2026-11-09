const SCOPE = new URL("./", self.registration.scope);
const CACHE_PREFIX = "envie-corps-shell:" + SCOPE.pathname + ":";
const CACHE = CACHE_PREFIX + "4";
const ASSETS = ["./", "index.html", "app.js?v=3", "manifest.webmanifest", "icon.svg"];
const ASSET_PATHS = new Set(ASSETS.map(asset => new URL(asset, SCOPE).pathname));
const INDEX_URL = new URL("index.html", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const obsolete = keys.filter(key => key !== CACHE && (key.startsWith(CACHE_PREFIX) || key === "envie-corps-v3"));
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("Authorization") ||
      url.origin !== SCOPE.origin || !ASSET_PATHS.has(url.pathname)) return;

  event.respondWith(fetch(request).then(response => {
    if (response.ok && !/no-store|private/i.test(response.headers.get("Cache-Control") || "")) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return await cache.match(INDEX_URL) || Response.error();
    return Response.error();
  }));
});
