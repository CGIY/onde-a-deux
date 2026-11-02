/* Dés·ir — device-bound connection to the authoritative game service. */
(function(scope){
 'use strict';
 const TYPES=new Set(['ROLL_CATEGORY','ROLL_CARD','CHALLENGE_DRAFT','ROLL_DRAFT_DEFENSE','SEND','CHALLENGE','ROLL_DEFENSE','ACCEPT','NEW_ROUND','TOGGLE_TASK_CHECK']);
 const TOKEN=/^[A-Za-z0-9_-]{43}$/;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function failure(code,message,status=0,snapshot=null){const error=new Error(message);error.code=code;error.status=status;error.isDesirRemoteError=true;if(snapshot)error.snapshot=clone(snapshot);return error;}
 function create(config={},environment={}){
  const G=environment.game||scope.OndeGame,fetcher=environment.fetch||scope.fetch?.bind(scope);
  let storage=environment.storage;try{if(storage===undefined)storage=scope.localStorage;}catch(_){storage=null;}
  const nav=environment.navigator||scope.navigator||{},doc=environment.document||scope.document,location=environment.location||scope.location;
  const crypto=environment.crypto||scope.crypto,Notification=environment.Notification||scope.Notification;
  const later=environment.setTimeout||scope.setTimeout?.bind(scope),cancel=environment.clearTimeout||scope.clearTimeout?.bind(scope);
  const every=environment.setInterval||scope.setInterval?.bind(scope),cancelEvery=environment.clearInterval||scope.clearInterval?.bind(scope);
  const controller=environment.AbortController||scope.AbortController;
  const storageKey=config.storageKey||'desir-connection-v1',registrationKey=storageKey+'-registration',actionKey=storageKey+'-action';
  let endpoint='';try{const url=new URL(config.endpoint);if(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))endpoint=url.href;}catch(_){}
  const enabled=!!(endpoint&&G&&fetcher&&crypto?.getRandomValues);
  let connection=null,snapshot=null,refreshing=null,restoring=null,queue=Promise.resolve(),started=false,pollTimer=null,registration=null,preparing=null,vapidKey=null,authFailed=false;
  let status={phase:enabled?'disconnected':'unconfigured',message:'',lastUpdated:null,errorCode:null};
  let notificationStatus={supported:false,permission:'unsupported',subscribed:false,reason:null,message:''};
  const listeners=new Set();
  function emit(){const event={snapshot:clone(snapshot),status:{...status},notificationStatus:{...notificationStatus}};for(const listener of listeners){try{listener(event);}catch(_){}}}
  function setStatus(phase,message='',errorCode=null){status={...status,phase,message,errorCode};emit();}
  function setNotification(patch){notificationStatus={...notificationStatus,...patch};emit();}
  function read(key){try{return storage?.getItem(key)||null;}catch(_){return null;}}
  function write(key,value){try{if(!storage)throw Error();storage.setItem(key,JSON.stringify(value));}catch(_){throw failure('storage','Cet appareil ne peut pas conserver votre accès. Autorise le stockage de ce site avant de continuer.');}}
  function remove(key){try{storage?.removeItem(key);}catch(_){}}
  function parsed(key){const raw=read(key);if(!raw)return null;try{return JSON.parse(raw);}catch(_){throw failure('invalid_access','L’accès enregistré sur cet appareil est illisible.');}}
  function bytesToBase64(bytes){let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return (environment.btoa||scope.btoa)(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function randomToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return bytesToBase64(bytes);}
  function requestId(){if(crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
  function serial(task){const next=queue.then(task,task);queue=next.catch(()=>{});return next;}
  function requireEnabled(){if(!enabled)throw failure('unconfigured','La connexion à votre duo n’est pas encore disponible.');}
  function requireConnection(){requireEnabled();if(!connection)throw failure('not_connected','Connecte-toi pour continuer.');}
  function normalizedConnection(raw,expectedToken){
   if(!raw||!TOKEN.test(raw.token||'')||!UUID.test(raw.roomId||'')||!['a','b'].includes(raw.actor)||(expectedToken&&raw.token!==expectedToken))throw failure('invalid_response','La connexion reçue est invalide. Réessaie.');
   return {version:1,endpoint,token:raw.token,roomId:raw.roomId,actor:raw.actor,pairingCode:typeof raw.pairingCode==='string'?raw.pairingCode:null};
  }
  function checkStored(raw){if(!raw||raw.version!==1||raw.endpoint!==endpoint)throw failure('invalid_access','Cet accès appartient à une autre version du duo.');return normalizedConnection(raw);}
  function validateSnapshot(raw,identity=connection){
   if(!identity||!raw||raw.roomId!==identity.roomId||!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.actor!==identity.actor||typeof raw.paired!=='boolean')throw failure('invalid_response','La partie reçue est incomplète. Réessaie.');
   const state=G.normalizeState(raw.state);
   if(!state||state.activePlayer!==identity.actor)throw failure('invalid_response','La partie reçue ne correspond pas à ce joueur.');
   const pairingCode=raw.paired?null:(typeof raw.pairingCode==='string'?raw.pairingCode:identity.pairingCode||null);
   let quota=null;if(raw.quota!==undefined&&raw.quota!==null){const q=raw.quota;if(!q||typeof q!=='object'||!Number.isInteger(q.remaining)||q.remaining<0||q.remaining>1||typeof q.label!=='string'||q.label.length>160||!(q.nextAt===null||typeof q.nextAt==='string'&&Number.isFinite(Date.parse(q.nextAt)))||!(typeof q.window==='string'||q.window&&typeof q.window==='object')||JSON.stringify(q).length>2000)throw failure('invalid_response','La plage de jeu reçue est invalide.');quota=clone(q);}
   let roll;
   if(raw.roll!==undefined){if(!raw.roll||![4,6,20].includes(raw.roll.kind)||!Number.isInteger(raw.roll.value)||raw.roll.value<1||raw.roll.value>raw.roll.kind)throw failure('invalid_response','Le résultat du dé n’a pas pu être confirmé.');roll={kind:raw.roll.kind,value:raw.roll.value};}
   const serverTime=typeof raw.serverTime==='string'&&Number.isFinite(Date.parse(raw.serverTime))?raw.serverTime:null;
   return {base:{roomId:identity.roomId,state,revision:raw.revision,actor:raw.actor,paired:raw.paired,pairingCode,quota,serverTime},roll};
  }
  function acceptSnapshot(raw,identity=connection){
   const checked=validateSnapshot(raw,identity);
   if(!snapshot||checked.base.revision>=snapshot.revision){
    const changed=!snapshot||JSON.stringify(checked.base)!==JSON.stringify(snapshot),statusChanged=status.phase!=='connected'||!!status.message;
    snapshot=clone(checked.base);
    if(connection&&connection.pairingCode!==snapshot.pairingCode){connection.pairingCode=snapshot.pairingCode;try{write(storageKey,connection);}catch(_){}}
    authFailed=false;status={phase:'connected',message:'',lastUpdated:new Date().toISOString(),errorCode:null};
    if(changed||statusChanged)emit();
   }
   return {...clone(snapshot),...(checked.roll?{roll:checked.roll}:{})};
  }
  function remoteError(response,body){
   const code=body?.error?.code||body?.code;
   const messages={conflict:'La partie a changé sur l’autre téléphone. Elle vient d’être actualisée.',pairing_invalid:'Ce code n’est plus disponible. Vérifie-le avec l’autre personne.',invalid_code:'Ce code n’est plus disponible. Vérifie-le avec l’autre personne.',invalid_token:'Cet accès n’est plus reconnu. Reconnecte cet appareil.',unauthorized:'Cet accès n’est plus reconnu. Reconnecte cet appareil.',rate_limited:'Trop de tentatives rapprochées. Réessaie dans quelques instants.',not_allowed:'Cette action n’est pas disponible pour ce joueur.',invalid_credentials:'L’identifiant ou le mot de passe n’est pas reconnu.',quota_exhausted:'Ton prochain tirage sera disponible à la prochaine plage.'};
   const fallback=response.status===401?'Cet accès n’est plus reconnu. Reconnecte cet appareil.':response.status===429?'Trop de tentatives rapprochées. Réessaie dans quelques instants.':response.status>=500?'La connexion au duo est momentanément indisponible.':'Cette action n’a pas pu être confirmée.';
   let updated=null;if(body?.state&&connection){try{updated=acceptSnapshot(body);}catch(_){}}
   return failure(code||(response.status===409?'conflict':response.status===401?'unauthorized':'request_failed'),messages[code]||fallback,response.status,updated);
  }
  async function request(payload,token,attempts=2){
   requireEnabled();
   const headers={'Content-Type':'application/json'};
   if(config.publishableKey)headers.apikey=config.publishableKey;
   if(token)headers.Authorization='Bearer '+token;
   let last;
   for(let attempt=0;attempt<attempts;attempt++){
    const abort=controller?new controller():null,timer=abort&&later?later(()=>abort.abort(),Number(config.requestTimeoutMs)||20000):null;
    try{
     const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(payload),mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',...(abort?{signal:abort.signal}:{})});
     const text=await response.text();if(text.length>2000000)throw failure('invalid_response','La réponse reçue est trop volumineuse.');
     let body;try{body=JSON.parse(text);}catch(_){throw failure('invalid_response','Le duo a renvoyé une réponse illisible.');}
     if(!response.ok){const error=remoteError(response,body);if(response.status>=500&&attempt+1<attempts){last=error;continue;}throw error;}
     return body;
    }catch(error){
     if(error?.isDesirRemoteError)throw error;
     last=failure('offline','Connexion interrompue. Réessaie quand le réseau est revenu.');
     if(attempt+1>=attempts)throw last;
    }finally{if(timer)cancel(timer);}
   }
   throw last||failure('offline','La connexion au duo est indisponible.');
  }
  function markFailure(error){if(error.status===401)authFailed=true;const expected=connection&&['conflict','quota_exhausted','not_allowed','invalid_action','pending_action'].includes(error.code);setStatus(expected?'connected':error.code==='offline'?'offline':'error',error.message,error.code);}
  function pendingLogin(){
   const previous=parsed(registrationKey);
   if(previous&&previous.version===1&&previous.endpoint===endpoint&&previous.op==='login'&&TOKEN.test(previous.token||'')&&UUID.test(previous.requestId||''))return previous;
   const pending={version:1,endpoint,op:'login',token:randomToken(),requestId:requestId()};write(registrationKey,pending);return pending;
  }
  async function finishLogin(raw,pending){
   const received=raw.connection||{token:pending.token,roomId:raw.roomId,actor:raw.actor};
   const identity=normalizedConnection({...received,token:received.token||pending.token},pending.token);identity.pairingCode=typeof raw.pairingCode==='string'?raw.pairingCode:null;
   validateSnapshot(raw,identity);write(storageKey,identity);if(snapshot&&(snapshot.roomId!==identity.roomId||snapshot.actor!==identity.actor))snapshot=null;connection=identity;remove(registrationKey);let pendingAction=null;try{pendingAction=parsed(actionKey);}catch(_){}if(pendingAction&&(pendingAction.roomId!==identity.roomId||pendingAction.actor!==identity.actor))remove(actionKey);
   const value=acceptSnapshot(raw);prepareNotifications().catch(()=>{});return value;
  }
  function login(username,password){
   const user=String(username||'').trim();
   if(!user||user.length>80||typeof password!=='string'||!password||password.length>256)return Promise.reject(failure('invalid_credentials','Renseigne ton identifiant et ton mot de passe.'));
   return serial(async()=>{requireEnabled();if(connection&&!authFailed)return fetchState();setStatus('connecting');try{const pending=pendingLogin();const raw=await request({op:'login',requestId:pending.requestId,username:user,password},pending.token);return await finishLogin(raw,pending);}catch(error){markFailure(error);throw error;}});
  }
  function cleanAction(action){
   if(!action||!TYPES.has(action.type))throw failure('not_allowed','Cette action n’est pas disponible.');
   const value={type:action.type};
   if(typeof action.roundId==='string'&&/^onde-[1-9]\d*$/.test(action.roundId))value.roundId=action.roundId;
   if(action.type==='TOGGLE_TASK_CHECK'){
    if(typeof action.taskId!=='string'||typeof action.checked!=='boolean')throw failure('invalid_action','La case n’a pas pu être confirmée.');
    value.taskId=action.taskId;value.checked=action.checked;
   }else if(!value.roundId)throw failure('invalid_action','Le tour n’a pas pu être identifié. Actualise la partie.');
   return value;
  }
  function storedAction(){const value=parsed(actionKey);if(!value)return null;if(value.version!==1||value.endpoint!==endpoint||value.roomId!==connection?.roomId||value.actor!==connection?.actor||!UUID.test(value.requestId||''))throw failure('invalid_action','Une ancienne action ne peut pas être reprise sur ce duo.');value.action=cleanAction(value.action);return value;}
  async function sendAction(pending){
   try{
    const raw=await request({op:'action',requestId:pending.requestId,action:pending.action},connection.token);
    const value=acceptSnapshot(raw);remove(actionKey);return value;
   }catch(error){if(error.status>=400&&error.status<500&&error.status!==429)remove(actionKey);throw error;}
  }
  async function fetchState(){requireConnection();const raw=await request({op:'state'},connection.token);return acceptSnapshot(raw);}
  function action(value){
   return serial(async()=>{requireConnection();try{
    const cleaned=cleanAction(value),pending=storedAction();
    if(pending&&JSON.stringify(pending.action)!==JSON.stringify(cleaned))throw failure('pending_action','Une action attend encore la connexion. Réessaie dans un instant.');
    const next=pending||{version:1,endpoint,roomId:connection.roomId,actor:connection.actor,requestId:requestId(),action:cleaned};
    write(actionKey,next);return await sendAction(next);
   }catch(error){markFailure(error);throw error;}});
  }
  function refresh(){
   if(!connection)return Promise.resolve(null);
   if(refreshing)return refreshing;
   refreshing=Promise.resolve().then(async()=>{try{const pending=storedAction();if(pending)await serial(()=>sendAction(pending));return await fetchState();}catch(error){markFailure(error);throw error;}finally{refreshing=null;}});
   return refreshing;
  }
  function restore(){
   if(restoring)return restoring;
   restoring=Promise.resolve().then(async()=>{requireEnabled();setStatus('connecting');try{
    const pending=parsed(registrationKey);
    if(pending){
     if(pending.version!==1||pending.endpoint!==endpoint||!TOKEN.test(pending.token||'')||pending.op!=='login')throw failure('invalid_access','La connexion en cours ne peut pas être reprise.');
     try{const raw=await request({op:'state'},pending.token,1);return await finishLogin(raw,pending);}catch(error){if(error.status!==401)throw error;}
    }
    const saved=parsed(storageKey);
    if(saved){connection=checkStored(saved);const value=await refresh();prepareNotifications().catch(()=>{});return value;}
    setStatus('disconnected');return null;
   }catch(error){markFailure(error);throw error;}finally{restoring=null;}});return restoring;
  }
  function iosInstallRequired(){const ua=nav.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&nav.maxTouchPoints>1);let standalone=nav.standalone===true;try{standalone=standalone||!!scope.matchMedia?.('(display-mode: standalone)').matches;}catch(_){}return ios&&!standalone;}
  function inspectNotifications(){
   const install=iosInstallRequired(),supported=!!(Notification&&nav.serviceWorker&&(environment.PushManager||scope.PushManager));
   const permission=Notification?.permission||'unsupported';
   setNotification({supported:supported&&!install,permission,reason:install?'install_required':!supported?'unsupported':permission==='denied'?'denied':null,message:install?'Ajoute Dés·ir à l’écran d’accueil pour activer les notifications.':!supported?'Ce navigateur ne prend pas en charge les notifications.':permission==='denied'?'Les notifications sont désactivées dans les réglages du navigateur.':''});
   return notificationStatus;
  }
  async function serviceWorker(){
   if(registration?.active)return registration;
   const script=location?new URL('./sw.js',location.href).href:'./sw.js';
   registration=await nav.serviceWorker.register(script,{scope:location?new URL('./',location.href).pathname:'./',updateViaCache:'none'});
   if(registration.active)return registration;
   const worker=registration.installing||registration.waiting;
   if(!worker){registration=await nav.serviceWorker.ready;return registration;}
   await new Promise((resolve,reject)=>{const timer=later(()=>{worker.removeEventListener?.('statechange',changed);reject(failure('notifications_unavailable','Le système de notifications n’est pas encore prêt. Réessaie.'));},10000);function changed(){if(worker.state==='activated'){cancel(timer);worker.removeEventListener?.('statechange',changed);resolve();}else if(worker.state==='redundant'){cancel(timer);worker.removeEventListener?.('statechange',changed);reject(failure('notifications_unavailable','Le système de notifications n’a pas pu démarrer.'));}}worker.addEventListener('statechange',changed);changed();});
   return registration;
  }
  function decodePublicKey(value){if(typeof value!=='string'||!/^[-_A-Za-z0-9]+$/.test(value))throw failure('notifications_unavailable','La configuration des notifications est indisponible.');const raw=(environment.atob||scope.atob)(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));const bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));if(bytes.length!==65||bytes[0]!==4)throw failure('notifications_unavailable','La configuration des notifications est invalide.');return bytes;}
  function prepareNotifications(){
   if(preparing)return preparing;
   const support=inspectNotifications();if(!connection||!support.supported)return Promise.resolve(null);
   preparing=(async()=>{try{const [reg,configResponse]=await Promise.all([serviceWorker(),request({op:'push_config'},connection.token)]);vapidKey=decodePublicKey(configResponse.vapidPublicKey||configResponse.publicKey);const existing=await reg.pushManager.getSubscription();if(existing&&Notification.permission==='granted'){await request({op:'subscribe',subscription:existing.toJSON()},connection.token);setNotification({subscribed:true,permission:'granted',message:''});}return reg;}finally{preparing=null;}})();return preparing;
  }
  async function enableNotifications(){
   requireConnection();const support=inspectNotifications();if(!support.supported)throw failure(support.reason||'notifications_unsupported',support.message);
   if(Notification.permission==='denied')throw failure('notifications_denied',support.message);
   // Request synchronously on the original click, before any network or SW await.
   try{
    const permissionRequest=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
    const permission=await permissionRequest;setNotification({permission});if(permission!=='granted')throw failure('notifications_denied','Les notifications restent désactivées.');
    const reg=await prepareNotifications();if(!reg||!vapidKey)throw failure('notifications_unavailable','Les notifications ne sont pas encore disponibles. Réessaie.');
    const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKey});
    await request({op:'subscribe',subscription:sub.toJSON()},connection.token);setNotification({permission:'granted',subscribed:true,reason:null,message:''});return {...notificationStatus};
   }catch(error){const known=error?.isDesirRemoteError?error:failure('notifications_unavailable','Les notifications n’ont pas pu être activées sur cet appareil.');setNotification({subscribed:false,message:known.message,reason:known.code});throw known;}
  }
  function refreshQuietly(){if(connection&&(!doc||!doc.hidden))refresh().catch(()=>{});}
  function visible(){if(!doc?.hidden)refreshQuietly();}
  function pushMessage(event){if(event.data?.type==='desir-state-refresh')refreshQuietly();}
  function start(){if(started||!enabled)return;started=true;pollTimer=every(refreshQuietly,Number(config.pollIntervalMs)||10000);doc?.addEventListener?.('visibilitychange',visible);scope.addEventListener?.('online',refreshQuietly);nav.serviceWorker?.addEventListener?.('message',pushMessage);if(nav.serviceWorker)serviceWorker().catch(()=>{});}
  function stop(){if(!started)return;started=false;if(pollTimer)cancelEvery(pollTimer);pollTimer=null;doc?.removeEventListener?.('visibilitychange',visible);scope.removeEventListener?.('online',refreshQuietly);nav.serviceWorker?.removeEventListener?.('message',pushMessage);}
  inspectNotifications();
  return Object.freeze({enabled,get authenticated(){return !!connection&&!authFailed;},get connection(){return connection?{roomId:connection.roomId,actor:connection.actor}:null;},get snapshot(){return clone(snapshot);},get status(){return {...status};},get notificationStatus(){return {...notificationStatus};},get pendingRegistration(){try{const value=parsed(registrationKey);return value?{op:value.op}:null;}catch(_){return null;}},restore,login,refresh,action,enableNotifications,prepareNotifications,start,stop,subscribeToChanges(listener){if(typeof listener!=='function')throw new TypeError('A listener is required.');listeners.add(listener);return ()=>listeners.delete(listener);}});
 }
 const api=Object.freeze({create});scope.OndeRemote=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
