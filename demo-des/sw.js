/* D6 à deux — public app shell only. Private game responses never enter this cache. */
'use strict';
const APP_URL = new URL('./', self.registration.scope).href;
const APP_PATH = new URL(APP_URL).pathname;
const CACHE_PREFIX = 'desir-shell:' + APP_PATH + ':';
const RELEASE_VERSION = '0.5.2';
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
      // A temporary server failure should not prevent the installed shell from opening.
      // Keep permanent client errors visible and leave non-shell resources unchanged.
      if (isShell && response.status >= 500 && response.status <= 599) {
        return await cache.match(cacheKey) || await cache.match(INDEX_URL) || response;
      }
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

const NOTIFICATION_TITLES = Object.freeze([
  "À TON TOUR DE BRILLER !",
  "LE HASARD FRAPPE À LA PORTE !",
  "IL SE PASSE UN TRUC PAR ICI !",
  "PETIT SIGNAL, GRANDE CURIOSITÉ !",
  "TON DUO FAIT DES ÉTINCELLES !",
  "LA SUITE SE JOUE À DEUX !",
  "UN CLIN D’ŒIL DANS TA POCHE !",
  "LES DÉS ONT DE LA SUITE DANS LES IDÉES !",
  "ÇA BOUGE SOUS LES ÉTOILES !",
  "TOC TOC, C’EST VOTRE JEU !",
  "UNE PETITE PARENTHÈSE VOUS ATTEND !",
  "LE CIEL A UN MESSAGE POUR TOI !",
  "PETITE ALERTE COMPLICITÉ !",
  "LA BALLE REBONDIT ENTRE VOUS !",
  "UN NOUVEAU CHAPITRE S’ALLUME !",
  "VOTRE DUO EST DANS LA PLACE !",
  "IL Y A DU MOUVEMENT EN ORBITE !",
  "LA CURIOSITÉ A SONNÉ !",
  "DU NOUVEAU DANS VOTRE GALAXIE !",
  "UN PETIT TOUR DU CÔTÉ DE VOUS ?",
  "LES ASTRES ONT QUELQUE CHOSE À DIRE !",
  "VOTRE HISTOIRE FAIT UN PETIT BOND !",
  "BONJOUR LES POSSIBLES !",
  "LA COMPLICITÉ ENVOIE UN SIGNAL !",
  "UN RENDEZ-VOUS AVEC LE HASARD !",
  "LA PETITE ÉTINCELLE DU JOUR !",
  "ÇA MÉRITE UN PETIT COUP D’ŒIL !",
  "VOTRE JEU REPREND LA PAROLE !",
  "EN APPROCHE DE VOTRE DUO !",
  "UN MESSAGE DE VOTRE PETITE PLANÈTE !",
  "LA SURPRISE A TROUVÉ LE CHEMIN !",
  "VOTRE BULLE FAIT COUCOU !",
  "QUELQUE CHOSE SE DESSINE À DEUX !",
  "LE HASARD A MIS SA PLUS BELLE TENUE !",
  "UN NOUVEAU SIGNAL SUR LE RADAR !",
  "PETIT DÉTOUR PAR VOTRE UNIVERS !",
  "ON A QUELQUE CHOSE POUR VOUS !",
  "LE FIL DE VOTRE JEU CONTINUE !",
  "VOTRE CONSTELLATION S’AGITE !",
  "LA CHANCE VOUS FAIT UN SIGNE !",
  "DEUX JOUEURS, UN PETIT SUSPENSE !",
  "VOTRE PROCHAINE PARENTHÈSE S’ANNONCE !",
  "UNE ONDE COMPLICE PASSE PAR ICI !",
  "LES POSSIBLES FONT LEUR ENTRÉE !",
  "PETITE NOUVELLE DE VOTRE DUO !",
  "ÇA S’ANIME DANS VOTRE COIN DU CIEL !",
  "LE JEU VOUS ADRESSE UN SOURIRE !",
  "QUELQUES ÉTOILES DANS LE QUOTIDIEN !",
  "UNE PETITE SURPRISE SE GLISSE ICI !",
  "LA SUITE VOUS FAIT DE L’ŒIL !"
]);
const MESSAGES = Object.freeze({
  "invitation": [
    "UNE CARTE T’ATTEND. VIENS DÉCOUVRIR LES POSSIBLES !",
    "TON COMPAGNON A UNE IDÉE. À TOI D’ENTRER EN JEU !",
    "UNE PROPOSITION VIENT D’ARRIVER. CURIEUX ?",
    "UNE CARTE POUR VOUS DEUX. VIENS Y JETER UN ŒIL !",
    "À TON TOUR DE DÉCOUVRIR CE QUI SE PRÉPARE !"
  ],
  "confirmation": [
    "VOTRE PROPOSITION A ÉVOLUÉ. VIENS VOIR LA SUITE !",
    "LA BALLE CHANGE DE CAMP. UN PETIT TOUR DANS LE JEU ?",
    "DU NOUVEAU SUR VOTRE CARTE. LES POSSIBLES CONTINUENT !",
    "VOTRE MANCHE A BOUGÉ. LA SUITE EST DANS LE JEU !",
    "UN CHANGEMENT VOUS ATTEND. ON CONTINUE ?"
  ],
  "task-ready": [
    "UNE VARIANTE EST CHOISIE. VOTRE MOMENT VOUS ATTEND !",
    "VOTRE MISSION EST PRÊTE. À VOUS D’EN FAIRE UN MOMENT !",
    "LE CHOIX EST FAIT. UNE NOUVELLE PARENTHÈSE S’OUVRE !",
    "C’EST CHOISI. RETROUVEZ VOTRE IDÉE DANS LES MISSIONS !",
    "VOTRE CARTE A TROUVÉ SA FAÇON DE JOUER !"
  ],
  "shared-moment": [
    "DEUX COCHES, UN POINT. BIEN JOUÉ LE DUO !",
    "UN MOMENT PARTAGÉ REJOINT VOTRE HISTOIRE !",
    "VOUS L’AVEZ FAIT À DEUX. UNE ÉTOILE DANS LE QUOTIDIEN !",
    "VOTRE SCORE COMMUN VIENT DE GRANDIR !",
    "UNE MISSION VALIDÉE. VOTRE COMPLICITÉ PREND FORME !"
  ],
  "draw-available": [
    "TON DÉ EST PRÊT. QUELLE IDÉE VA-T-IL TROUVER ?",
    "LE HASARD EST DE RETOUR. ENVIE DE JOUER ?",
    "UN NOUVEAU TIRAGE T’ATTEND. À TOI DE LANCER !",
    "LES DÉS SONT PRÊTS POUR VOTRE PROCHAINE IDÉE !",
    "UNE NOUVELLE CHANCE DE VOUS SURPRENDRE EST DISPONIBLE !"
  ],
  "task-reminder": [
    "UNE MISSION EST ENCORE OUVERTE. ENVIE D’Y REVENIR ?",
    "VOTRE PETITE PARENTHÈSE EST TOUJOURS AU PROGRAMME !",
    "UN MOMENT À DEUX ATTEND SA SUITE !",
    "VOTRE CARTE EST ENCORE LÀ. UN COUP D’ŒIL ?",
    "UN PETIT RAPPEL DE VOTRE JEU À DEUX !"
  ]
});
function notificationSeed(value){let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;}
function safeNotification(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const kind = Object.prototype.hasOwnProperty.call(MESSAGES, data.kind) ? data.kind : 'invitation';
  const seed=notificationSeed(String(data.eventId||kind));
  let body = MESSAGES[kind][Math.floor(seed / NOTIFICATION_TITLES.length) % MESSAGES[kind].length];
  if (kind === 'task-reminder') {
    const remaining = Date.parse(data.expiresAt) - Date.now();
    if (remaining > 0) {
      const minutes = Math.max(1, Math.ceil(remaining / 60000));
      const hours = Math.floor(minutes / 60), rest = minutes % 60;
      const time = hours ? hours + ' h' + (rest ? ' ' + rest : '') : minutes + ' min';
      body += ' ENCORE ' + time.toLocaleUpperCase('fr-FR') + ' POUR VOTRE MOMENT.';
      if(data.starPenalty===true)body+=' ENCORE '+time.toLocaleUpperCase('fr-FR')+' POUR COCHER TA CASE. UNE ÉTOILE EST EN JEU À L’ÉCHÉANCE.';
    } else {
      // WebKit requires every received push to show a notification. A delayed
      // message must not revoke the subscription or advertise an expired task.
      body = 'VOTRE JEU A ÉTÉ ACTUALISÉ. VIENS DÉCOUVRIR LA SUITE !';
    }
  }
  const eventId = typeof data.eventId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(data.eventId) ? data.eventId : kind;
  return {
    title: NOTIFICATION_TITLES[seed % NOTIFICATION_TITLES.length],
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
async function refreshClients(type = 'desir-state-refresh') {
  const own = await appWindows();
  for (const client of own) client.postMessage({type});
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

self.addEventListener('pushsubscriptionchange', event => {
  // Only a logged-in client can safely register a renewed subscription with the server.
  event.waitUntil(refreshClients('desir-subscription-changed'));
});
