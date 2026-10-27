/* Push notifications for Les Cartes à deux. Uses the existing Supabase REST transport. */
(() => {
  'use strict';
  const VAPID_PUBLIC_KEY = 'BEZ7QcV-x80SjMsXIhq0kk-C0mxDTY3xOy0Uql4usS14IwP5FjQODRF9EbmrxF9HVmRpHK4n4suCjw9_7ynDctc';
  const SUPABASE_URL = 'https://tgkhgafkqvritsgdapcz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA';
  const urlBase64ToUint8Array = base64 => {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  };
  async function rpc(name, body, role, token) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_role: role, p_token: token, ...body })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
    return data;
  }
  async function enablePush(role, token) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = subscription.toJSON();
    await rpc('tcg_push_save_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth }, role, token);
    return true;
  }
  async function disablePush(role, token) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await rpc('tcg_push_remove_subscription', { p_endpoint: subscription.endpoint }, role, token).catch(() => {});
      await subscription.unsubscribe();
    }
  }
  window.CardPush = Object.freeze({ enablePush, disablePush });
})();
