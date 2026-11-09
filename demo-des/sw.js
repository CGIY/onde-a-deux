/* D6 à deux — public app shell only. Private game responses never enter this cache. */
'use strict';
const APP_URL = new URL('./', self.registration.scope).href;
const APP_PATH = new URL(APP_URL).pathname;
const CACHE_PREFIX = 'desir-shell:' + APP_PATH + ':';
const RELEASE_VERSION = '0.4.4';
const CACHE_NAME = CACHE_PREFIX + 'connected-' + RELEASE_VERSION;
const INDEX_URL = new URL('./index.html', APP_URL).href;
const RELEASE_KEY = 'd6-release';
const SHELL_ACTIVE = {type: 'desir-shell-active', version: RELEASE_VERSION};
const PUBLIC_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/desir-180.png', './icons/desir-192.png', './icons/desir-512.png', './icons/desir-badge.png'
].map(path => new URL(path, APP_URL).href);
const PUBLIC_PATHS = new Set(PUBLIC_FILES.map(value => new URL(value).pathname));
const mayCache = response => response.ok && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('cache-control') || '');

const htmlVersion = async response => {
  const header = (await response.clone().text()).slice(0, 2048);
  return header.match(/<meta name="onde-version" content="(\d+\.\d+\.\d+)">/)?.[1];
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Pages can serve the new worker before its matching HTML reaches the CDN.
    // Keep the previous worker and its offline shell until the pair matches.
    const source = new URL(INDEX_URL);
    source.searchParams.set(RELEASE_KEY, RELEASE_VERSION);
    const shell = await fetch(new Request(source, {cache: 'reload'}));
    if (!mayCache(shell) || await htmlVersion(shell) !== RELEASE_VERSION) {
      throw Error('D6 à deux shell version is not ready');
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(INDEX_URL, shell.clone());
    await cache.put(APP_URL, shell);
    await Promise.allSettled(PUBLIC_FILES.filter(url => url !== APP_URL && url !== INDEX_URL).map(async url => {
      const response = await fetch(new Request(url, {cache: 'reload'}));
      if (mayCache(response)) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    for (const client of await appWindows()) client.postMessage(SHELL_ACTIVE);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'desir-shell-version' && isAppWindow(event.source)) event.source.postMessage(SHELL_ACTIVE);
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('Authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !PUBLIC_PATHS.has(url.pathname)) return;
  if (url.search && request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = url.origin + url.pathname;
    const isShell = cacheKey === APP_URL || cacheKey === INDEX_URL;
    try {
      const cacheMode = isShell && url.searchParams.has(RELEASE_KEY) ? 'reload' : 'no-cache';
      const response = await fetch(new Request(request, {cache: cacheMode}));
      if (isShell && mayCache(response)) {
        const version = await htmlVersion(response);
        if (version === RELEASE_VERSION) await cache.put(cacheKey, response.clone());
        else if (!version || version.localeCompare(RELEASE_VERSION, 'en', {numeric: true}) < 0) {
          return await cache.match(INDEX_URL) || response;
        }
      } else if (mayCache(response)) {
        await cache.put(cacheKey, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(cacheKey) || (isShell ? await cache.match(INDEX_URL) : null);
      if (cached) return cached;
      throw error;
    }
  })());
});

const MESSAGES = Object.freeze({
  invitation: 'Un nouveau challenge t’attend.',
  confirmation: 'Vos challenges ont été actualisés.',
  'task-ready': 'Une mission vous attend.',
  'shared-moment': 'Un moment partagé a été validé.',
  'draw-available': 'Ton dé est prêt.',
  'task-reminder': 'Une mission vous attend.'
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
    title: 'D6 à deux',
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
function isAppWindow(client) {
  try {const url = new URL(client?.url); return url.origin === self.location.origin && url.pathname.startsWith(APP_PATH);} catch (_) {return false;}
}
async function appWindows() {
  return (await self.clients.matchAll({type: 'window', includeUncontrolled: true})).filter(isAppWindow);
}
async function refreshClients() {
  const own = await appWindows();
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
