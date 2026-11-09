/* Dés·ir — public app shell only. Private game responses never enter this cache. */
'use strict';
const APP_URL = new URL('./', self.registration.scope).href;
const APP_PATH = new URL(APP_URL).pathname;
const CACHE_PREFIX = 'desir-shell:' + APP_PATH + ':';
const CACHE_NAME = CACHE_PREFIX + 'connected-v34';
const PUBLIC_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/desir-180.png', './icons/desir-192.png', './icons/desir-512.png', './icons/desir-badge.png'
].map(path => new URL(path, APP_URL).href);
const PUBLIC_PATHS = new Set(PUBLIC_FILES.map(value => new URL(value).pathname));
const mayCache = response => response.ok && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('cache-control') || '');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(PUBLIC_FILES.map(async url => {
      const request = new Request(url, {cache: 'reload'});
      const response = await fetch(request);
      if (mayCache(response)) await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('Authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !PUBLIC_PATHS.has(url.pathname)) return;
  if (url.search && request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new Request(url.origin + url.pathname);
    try {
      const response = await fetch(new Request(request, {cache: 'no-cache'}));
      if (mayCache(response)) await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(APP_URL) || await cache.match(new URL('./index.html', APP_URL).href);
        if (shell) return shell;
      }
      throw error;
    }
  })());
});

const MESSAGES = Object.freeze({
  invitation: 'Un nouveau challenge t’attend.',
  confirmation: 'Vos challenges ont été actualisés.',
  'task-ready': 'Une action vous attend dans À faire.',
  'shared-moment': 'Un moment partagé a été validé.',
  'draw-available': 'Ton dé est prêt.',
  'task-reminder': 'Une action vous attend dans À faire.'
});
function safeNotification(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const kind = Object.prototype.hasOwnProperty.call(MESSAGES, data.kind) ? data.kind : 'invitation';
  let body = MESSAGES[kind];
  if (kind === 'task-reminder') {
    const remaining = Date.parse(data.expiresAt) - Date.now();
    if (remaining > 0) {
      const minutes = Math.max(1, Math.ceil(remaining / 60000));
      const hours = Math.floor(minutes / 60), rest = minutes % 60;
      const time = hours ? hours + ' h' + (rest ? ' ' + rest : '') : minutes + ' min';
      body = 'Il reste ' + time + ' pour votre action.';
    } else {
      // WebKit requires every received push to show a notification. A delayed
      // message must not revoke the subscription or advertise an expired task.
      body = 'Vos actions ont été actualisées.';
    }
  }
  const eventId = typeof data.eventId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(data.eventId) ? data.eventId : kind;
  return {
    title: 'Dés·ir',
    options: {
      body,
      icon: new URL('./icons/desir-192.png', APP_URL).href,
      badge: new URL('./icons/desir-badge.png', APP_URL).href,
      tag: 'desir-' + eventId,
      renotify: false,
      data: {kind, eventId}
    }
  };
}
async function refreshClients() {
  const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  const own = windows.filter(client => {
    try {const url = new URL(client.url); return url.origin === self.location.origin && url.pathname.startsWith(APP_PATH);} catch (_) {return false;}
  });
  for (const client of own) client.postMessage({type: 'desir-state-refresh'});
  return own;
}
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = null;
    try {data = event.data && event.data.json();} catch (_) {}
    const notification = safeNotification(data);
    await self.registration.showNotification(notification.title, notification.options);
    await refreshClients();
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await refreshClients();
    if (windows.length) {
      const visible = windows.find(client => client.visibilityState === 'visible') || windows[0];
      await visible.focus();
      return;
    }
    // The notification payload cannot select another origin or arbitrary URL.
    await self.clients.openWindow(new URL('./?notification=1', APP_URL).href);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {event.waitUntil(refreshClients());});
