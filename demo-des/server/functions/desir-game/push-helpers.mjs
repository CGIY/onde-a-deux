/* Shared validation is runtime-neutral so its security boundaries are tested directly. */
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PUSH_KINDS = Object.freeze(['invitation', 'confirmation', 'task-ready', 'shared-moment', 'draw-available', 'task-reminder']);
export function allowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  let url;
  try {url = new URL(value);} catch (_) {return false;}
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash) return false;
  const host = url.hostname.toLowerCase();
  // WNS uses the root path plus an opaque token query; the other vendors use
  // nonempty paths. Host validation always precedes accepting that exception.
  const windows = /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  if (url.pathname === '/' && !(windows && url.searchParams.get('token'))) return false;
  return host === 'fcm.googleapis.com' || host === 'web.push.apple.com' ||
    /^[a-z0-9-]+\.push\.apple\.com$/.test(host) ||
    /^(?:[a-z0-9-]+\.)?push\.services\.mozilla\.com$/.test(host) ||
    windows;
}
function decodedBytes(value, expected) {
  if (typeof value !== 'string' || !BASE64URL.test(value) || value.length > expected * 2) return null;
  try {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return raw.length === expected ? Uint8Array.from(raw, char => char.charCodeAt(0)) : null;
  } catch (_) {return null;}
}
export function cleanSubscription(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !allowedPushEndpoint(raw.endpoint)) throw new Error('Abonnement de notification invalide.');
  const keys = raw.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Clés de notification invalides.');
  const publicKey = decodedBytes(keys.p256dh, 65), auth = decodedBytes(keys.auth, 16);
  if (!publicKey || publicKey[0] !== 4 || !auth) throw new Error('Clés de notification invalides.');
  const expiry = raw.expirationTime;
  if (expiry !== undefined && expiry !== null && (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > 8640000000000000)) throw new Error('Échéance de notification invalide.');
  return {endpoint: raw.endpoint, expirationTime: expiry ?? null, keys: {p256dh: keys.p256dh, auth: keys.auth}};
}
export async function validateSubscription(raw) {
  const cleaned = cleanSubscription(raw);
  const publicKey = decodedBytes(cleaned.keys.p256dh, 65);
  try {await crypto.subtle.importKey('raw', publicKey, {name: 'ECDH', namedCurve: 'P-256'}, false, []);} catch (_) {throw new Error('Clé de notification invalide.');}
  return cleaned;
}
export function pushPayload(event) {
  if (!event || typeof event !== 'object' || !UUID.test(event.id) || !PUSH_KINDS.includes(event.kind) || !Number.isSafeInteger(Number(event.revision)) || Number(event.revision) < 0) throw new Error('Événement de notification invalide.');
  // Deliberately exclude room IDs, codes, cards, titles, identities and tokens.
  const payload = {type: 'desir-state-refresh', eventId: event.id, kind: event.kind, revision: Number(event.revision)};
  // A deadline is the only optional content: the device formats the remaining time
  // when a delayed notification actually arrives, without receiving the card title.
  if (event.kind === 'task-reminder') {
    const deadline = Date.parse(event.expires_at);
    if (!Number.isFinite(deadline)) throw new Error('Échéance de notification invalide.');
    payload.expiresAt = new Date(deadline).toISOString();
  }
  return JSON.stringify(payload);
}
export function pushTTL(event, at = Date.now()) {
  if (event.expires_at == null) return 86400;
  const deadline = Date.parse(event.expires_at);
  return Number.isFinite(deadline) ? Math.max(0, Math.min(86400, Math.floor((deadline - at) / 1000))) : 0;
}
export function pushRetrySeconds(attempt) {return Math.min(3600, 60 * 2 ** Math.max(0, Math.min(6, Number(attempt) - 1)));}
export function pushErrorStatus(error) {return error && typeof error === 'object' && Number.isInteger(error.statusCode) ? error.statusCode : 0;}
