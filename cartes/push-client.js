/* Push notifications for Les Cartes à deux. Uses the existing Supabase REST transport. */
(() => {
  'use strict';
  const VAPID_PUBLIC_KEY = 'BEZ7QcV-x80SjMsXIhq0kk-C0mxDTY3xOy0Uql4usS14IwP5FjQODRF9EbmrxF9HVmRpHK4n4suCjw9_7ynDctc';
  const SUPABASE_URL = 'https://tgkhgafkqvritsgdapcz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA';
  const bindingKey='les-cartes-push-role';
  const boundRole=()=>{try{return localStorage.getItem(bindingKey);}catch{return null;}};
  const urlBase64ToUint8Array = base64 => {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  };
  async function rpc(name, body, role, token) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', signal:controller.signal,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_role: role, p_token: token, ...body })
    }).finally(()=>clearTimeout(timer));
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
    return data;
  }
  async function enablePush(role, token) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.getRegistration('./');
    if(!registration?.active)throw new Error('not_installed');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = subscription.toJSON();
    await rpc('tcg_push_save_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth }, role, token);
    try{localStorage.setItem(bindingKey,role);}catch{}
    return true;
  }
  async function disablePush(role, token) {
    const registration = await navigator.serviceWorker.getRegistration('./');
    if(!registration?.active)throw new Error('not_installed');
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await rpc('tcg_push_remove_subscription', { p_endpoint: subscription.endpoint }, role, token);
      await subscription.unsubscribe();
      try{localStorage.removeItem(bindingKey);}catch{}
    }
  }
  function bindToggle() {
    const toggle = document.getElementById('pushToggle');
    if (!toggle || toggle.dataset.pushBound) return;
    toggle.dataset.pushBound = '1';
    const status=document.createElement('p');status.className='push-status';status.setAttribute('role','status');toggle.after(status);
    const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
    if(!supported){toggle.disabled=true;toggle.textContent='Notifications indisponibles';status.textContent='Sur iPhone, ajoute l’app à l’écran d’accueil pour les activer.';return;}
    async function refresh(){
      const registration=await navigator.serviceWorker.getRegistration('./');
      if(!registration?.active){toggle.disabled=true;toggle.textContent='Notifications sur la version publiée';return;}
      const active=Notification.permission==='granted'&&boundRole()===window.CardTransport?.getState?.()?.role&&Boolean(await registration.pushManager.getSubscription());
      toggle.disabled=false;
      toggle.textContent=active?'Désactiver les notifications':'Activer les notifications';
    }
    new MutationObserver(()=>{if(document.getElementById('infoDialog')?.open)refresh().catch(()=>{});}).observe(document.getElementById('infoDialog'),{attributes:true,attributeFilter:['open']});
    toggle.addEventListener('click', async () => {
      const state = window.CardTransport?.getState?.();
      const role = state?.role, token = state?.token;
      if (!role || !token) return;
      toggle.disabled = true;
      try {
        status.textContent='';
        if(Notification.permission==='default')await Notification.requestPermission();
        if(Notification.permission!=='granted'){status.textContent='Autorise les notifications dans les réglages de cet appareil.';return;}
        const registration = await navigator.serviceWorker.getRegistration('./');
        if(!registration?.active){status.textContent='Ouvre la version publiée et installée sur l’écran d’accueil.';return;}
        const existing = Notification.permission === 'granted' ? await registration.pushManager.getSubscription() : null;
        if (existing && boundRole()===role) {
          await disablePush(role, token);
          toggle.textContent = 'Activer les notifications';
        } else {
          const enabled = await enablePush(role, token);
          toggle.textContent = enabled ? 'Désactiver les notifications' : 'Notifications indisponibles';
        }
      } catch (error) { status.textContent='Connexion interrompue. Réessaie dans un instant.'; }
      finally { toggle.disabled = false; }
    });
    refresh().catch(()=>{});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindToggle);
  else bindToggle();
  window.CardPush = Object.freeze({ enablePush, disablePush, bindToggle });
})();
