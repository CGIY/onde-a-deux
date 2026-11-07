// npm and Node APIs are supported by Supabase's Deno Edge runtime.
// Pin this import: VAPID signing + RFC 8291 payload encryption are delegated to web-push.
import * as webpush from 'npm:web-push@3.6.7';
import {pushPayload, pushTTL, pushRetrySeconds, pushErrorStatus, validateSubscription, pushEventRelevant} from './push-helpers.mjs';
import {HttpError} from './model.mjs';

type Store = {
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
  request(path: string, options?: {method?: string; body?: unknown}): Promise<any>;
};
type Member = {token_hash: string; room_id: string; actor: 'a' | 'b'};
type Config = {public_key: string; private_key: string; subject: string};
type Event = {id: string; room_id: string; target_actor: 'a' | 'b'; kind: string; revision: number; attempts: number; round_id?: string; window_key?: string; task_id?: string; expires_at?: string};
const SUBJECT = 'https://cgiy.github.io/desir/demo-des/';

async function privatePushConfig(store: Store): Promise<Config> {
  const existing = await store.request('desir_push_config?select=public_key,private_key,subject&id=eq.1&limit=1');
  if (Array.isArray(existing) && existing.length) return existing[0];
  const keys = webpush.generateVAPIDKeys();
  const inserted = await store.rpc('desir_ensure_push_config', {p_public_key: keys.publicKey, p_private_key: keys.privateKey, p_subject: SUBJECT});
  const config = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!config?.public_key || !config?.private_key) throw new Error('Configuration des notifications indisponible.');
  return config;
}
export async function ensurePushConfig(store: Store): Promise<{publicKey: string}> {
  const config = await privatePushConfig(store);
  // The private key never leaves this server module.
  return {publicKey: config.public_key};
}
export async function saveSubscription(store: Store, member: Member, raw: unknown): Promise<{subscribed: true}> {
  let subscription;
  try {subscription = await validateSubscription(raw);}
  catch (_) {throw new HttpError(400, 'invalid_subscription', 'Abonnement de notification invalide.');}
  await store.rpc('desir_save_push_subscription', {p_token_hash: member.token_hash, p_subscription: subscription});
  return {subscribed: true};
}
export async function isPushCronAuthorized(store: Store, rawToken: unknown): Promise<boolean> {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(rawToken)) return false;
  const rows = await store.request('desir_push_scheduler_config?select=cron_token&id=eq.1&limit=1');
  const expected = Array.isArray(rows) && rows[0]?.cron_token;
  if (typeof expected !== 'string' || !expected) return false;
  const encode = (value: string) => new TextEncoder().encode(value);
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encode(rawToken)), crypto.subtle.digest('SHA-256', encode(expected))]);
  const one = new Uint8Array(a), two = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < one.length; index++) difference |= one[index] ^ two[index];
  return difference === 0;
}
export async function enqueueScheduled(store: Store): Promise<unknown> {
  // Database time, the same Paris quota function and the authoritative room state
  // decide eligibility; a caller cannot choose its own scheduling timestamp.
  return await store.rpc('desir_enqueue_scheduled_push', {});
}
async function stillRelevant(store: Store, event: Event): Promise<boolean> {
  if (pushTTL(event) === 0) return false;
  if (event.kind === 'draw-available') return await store.rpc('desir_push_draw_ready', {p_room_id: event.room_id, p_actor: event.target_actor, p_window_key: event.window_key || null}) === true;
  const rows = await store.request('desir_rooms?select=state&id=eq.' + encodeURIComponent(event.room_id) + '&limit=1');
  const state = Array.isArray(rows) && rows[0]?.state;
  return pushEventRelevant(state, event);
}
async function finish(store: Store, event: Event, delivered: boolean): Promise<void> {
  await store.rpc('desir_finish_push_event', {p_event_id: event.id, p_delivered: delivered, p_retry_seconds: pushRetrySeconds(event.attempts)});
}
export async function flushPushOutbox(store: Store, roomId?: string): Promise<{claimed: number; sent: number; removed: number; failed: number}> {
  const events: Event[] = await store.rpc('desir_claim_push_outbox', {p_room_id: roomId || null, p_limit: 10});
  const summary = {claimed: events.length, sent: 0, removed: 0, failed: 0};
  let config: Config | undefined;
  for (const event of events) {
    try {
      if (!await stillRelevant(store, event)) {await finish(store, event, true); continue;}
      const subscriptions = await store.request('desir_push_subscriptions?select=endpoint_hash,subscription,desir_devices!inner(revoked_at,expires_at)&room_id=eq.' + encodeURIComponent(event.room_id) + '&actor=eq.' + event.target_actor + '&desir_devices.revoked_at=is.null&desir_devices.expires_at=gt.' + encodeURIComponent(new Date().toISOString()));
      if (!subscriptions.length) {await finish(store, event, true); continue;}
      const previous = await store.request('desir_push_deliveries?select=endpoint_hash&event_id=eq.' + encodeURIComponent(event.id));
      const delivered = new Set(previous.map((item: {endpoint_hash: string}) => item.endpoint_hash));
      config ||= await privatePushConfig(store);
      const payload = pushPayload(event);
      const results = await Promise.all(subscriptions.map(async (record: {endpoint_hash: string; subscription: unknown}) => {
        if (delivered.has(record.endpoint_hash)) return true;
        try {
          if (pushTTL(event) === 0) return true;
          const subscription = await validateSubscription(record.subscription);
          const request = webpush.generateRequestDetails(subscription, payload, {
            vapidDetails: {subject: config!.subject, publicKey: config!.public_key, privateKey: config!.private_key},
            contentEncoding: 'aes128gcm', TTL: pushTTL(event), urgency: 'normal',
            topic: 'desir-' + event.id.replace(/-/g, '').slice(0, 26)
          });
          const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => name.toLowerCase() !== 'content-length').map(([name, value]) => [name, String(value)]));
          const response = await fetch(request.endpoint, {method: request.method, headers, body: new Uint8Array(request.body), redirect: 'error', signal: AbortSignal.timeout(10000)});
          await response.body?.cancel();
          if (!response.ok) throw {statusCode: response.status};
          await store.rpc('desir_record_push_delivery', {p_event_id: event.id, p_endpoint_hash: record.endpoint_hash});
          summary.sent++;
          return true;
        } catch (error) {
          const status = pushErrorStatus(error);
          if (status === 404 || status === 410) {
            await store.request('desir_push_subscriptions?endpoint_hash=eq.' + encodeURIComponent(record.endpoint_hash), {method: 'DELETE'});
            summary.removed++;
            return true;
          }
          summary.failed++;
          return false;
        }
      }));
      await finish(store, event, results.every(Boolean));
    } catch (_) {
      // Keep retry state, while omitting subscription endpoints, secrets and payloads from logs.
      summary.failed++;
      try {await finish(store, event, false);} catch (_) {}
    }
  }
  return summary;
}
