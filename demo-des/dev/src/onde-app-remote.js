/* D6 à deux — device-bound connection to the authoritative game service. */
(function(scope){
 'use strict';
 const TYPES=new Set(['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT','REROLL_CARD','REROLL_CATEGORY','JOKER_DRAW','SEND','NEW_ROUND','TOGGLE_TASK_CHECK','REFUSE_TASK','EXTEND_TASK']);
 const GAME_VERSION=8;
 const SUPPORTED_GAME_VERSIONS=[6,7,GAME_VERSION];
 const TOKEN=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const ROUND_ID=/^onde-[1-9]\d*$/;
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
  let connection=null,snapshot=null,refreshing=null,recovering=null,restoring=null,queue=Promise.resolve(),sessionOperation=false,started=false,pollTimer=null,registration=null,preparing=null,preparingIdentity=null,notificationReconcile=false,vapidKey=null,authFailed=false;
  let status={phase:enabled?'disconnected':'unconfigured',message:'',lastUpdated:null,errorCode:null};
  let notificationStatus={supported:false,permission:'unsupported',subscribed:false,reason:null,message:''};
  const listeners=new Set();
  function emit(){const event={snapshot:clone(snapshot),status:{...status},notificationStatus:{...notificationStatus}};for(const listener of listeners){try{listener(event);}catch(_){}}}
  function setStatus(phase,message='',errorCode=null){status={...status,phase,message,errorCode};emit();}
  function setNotification(patch){notificationStatus={...notificationStatus,...patch};emit();}
  function read(key){try{return storage?.getItem(key)??null;}catch(_){return null;}}
  function write(key,value){try{if(!storage)throw Error();storage.setItem(key,JSON.stringify(value));}catch(_){throw failure('storage','Cet appareil ne peut pas conserver votre accès. Autorise le stockage de ce site avant de continuer.');}}
  function remove(key){try{storage?.removeItem(key);}catch(_){}}
  function parsed(key){const raw=read(key);if(!raw)return null;try{return JSON.parse(raw);}catch(_){throw failure('invalid_access','L’accès enregistré sur cet appareil est illisible.');}}
  function readJournal(key,decode){
   const raw=read(key);if(raw===null)return null;
   try{const value=decode(JSON.parse(raw));if(value)return value;}catch(_){}
   remove(key);return null;
  }
  function bytesToBase64(bytes){let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return (environment.btoa||scope.btoa)(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function randomToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return bytesToBase64(bytes);}
  function requestId(){if(crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
  function serial(task){const next=queue.then(task,task);queue=next.catch(()=>{});return next;}
  function requireEnabled(){if(!enabled)throw failure('unconfigured','La connexion à votre duo n’est pas encore disponible.');}
  function requireConnection(){requireEnabled();if(!connection||authFailed)throw failure('not_connected','Connecte-toi pour continuer.');}
  function normalizedConnection(raw,expectedToken){
   if(!raw||!TOKEN.test(raw.token||'')||!UUID.test(raw.roomId||'')||!['a','b'].includes(raw.actor)||(expectedToken&&raw.token!==expectedToken))throw failure('invalid_response','La connexion reçue est invalide. Réessaie.');
   return {version:1,endpoint,token:raw.token,roomId:raw.roomId,actor:raw.actor,pairingCode:typeof raw.pairingCode==='string'?raw.pairingCode:null};
  }
  function checkStored(raw){if(!raw||raw.version!==1||raw.endpoint!==endpoint)throw failure('invalid_access','Cet accès appartient à une autre version du duo.');return normalizedConnection(raw);}
  function validateSnapshot(raw,identity=connection){
   if(!identity||!raw||raw.roomId!==identity.roomId||!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.actor!==identity.actor||typeof raw.paired!=='boolean')throw failure('invalid_response','La partie reçue est incomplète. Réessaie.');
   const state=G.normalizeState(raw.state);
   if(!state||state.activePlayer!==identity.actor)throw failure('invalid_response','La partie reçue ne correspond pas à ce joueur.');
   if(!SUPPORTED_GAME_VERSIONS.includes(raw.gameVersion))throw failure('invalid_response','La version reçue est invalide.');
   if(!Array.isArray(raw.incoming)||raw.incoming.length>80||state.round.from!==identity.actor)throw failure('invalid_response','Les tirages reçus sont invalides.');
   const incoming=raw.incoming.map(value=>G.normalizeState(value));
   if(incoming.some(value=>!value||value.activePlayer!==identity.actor||value.round.from===identity.actor||value.phase!=='pending'||!G.canSeeRound(value,identity.actor))||new Set(incoming.map(value=>value.round.id)).size!==incoming.length)throw failure('invalid_response','L’invitation reçue est invalide.');
   const pendingOutgoing=raw.pendingOutgoing===undefined?0:raw.pendingOutgoing;
   if(!Number.isInteger(pendingOutgoing)||pendingOutgoing<0||pendingOutgoing>80)throw failure('invalid_response','Les invitations envoyées sont invalides.');
   const pairingCode=raw.paired?null:(typeof raw.pairingCode==='string'?raw.pairingCode:identity.pairingCode||null);
   let quota=null;if(raw.quota!==undefined&&raw.quota!==null){const q=raw.quota;if(!q||typeof q!=='object'||!Number.isInteger(q.remaining)||q.remaining<0||q.remaining>3||typeof q.label!=='string'||q.label.length>160||!(q.nextAt===null||typeof q.nextAt==='string'&&Number.isFinite(Date.parse(q.nextAt)))||!(typeof q.window==='string'||q.window&&typeof q.window==='object')||JSON.stringify(q).length>2000)throw failure('invalid_response','La plage de jeu reçue est invalide.');quota=clone(q);}
   let roll;
   if(raw.roll!==undefined){
    const kind=raw.roll?.kind,value=raw.roll?.value;
    const validD8=kind===8&&raw.gameVersion>=7&&G.cardSides(state)===8&&state.round.cardRoll===value;
    if(!([4,6,20].includes(kind)||validD8)||!Number.isInteger(value)||value<1||value>kind)throw failure('invalid_response','Le résultat du dé n’a pas pu être confirmé.');
    roll={kind,value};
   }
   if(raw.drawAvailable!==undefined&&typeof raw.drawAvailable!=='boolean')throw failure('invalid_response','La disponibilité du tirage est invalide.');
   let badges;
   if(raw.badges!==undefined){if(typeof G.validateBadgeView!=='function'||!G.validateBadgeView(raw.badges,identity.actor))throw failure('invalid_response','La collection de badges reçue est invalide.');badges=clone(raw.badges);}
   let activity;
   if(raw.activity!==undefined){
    if(!G.validateActivityCalendar(raw.activity))throw failure('invalid_response','La série reçue est invalide.');
    activity={streak:raw.activity.streak,lastDay:raw.activity.lastDay};
   }
   const serverTime=typeof raw.serverTime==='string'&&Number.isFinite(Date.parse(raw.serverTime))?raw.serverTime:null;
   const penaltyTaskIds=raw.penaltyTaskIds;
   if(penaltyTaskIds!==undefined){
    const taskIds=new Set(state.tasks.map(task=>task.id));
    if(!Array.isArray(penaltyTaskIds)||new Set(penaltyTaskIds).size!==penaltyTaskIds.length||penaltyTaskIds.some(id=>!taskIds.has(id)))throw failure('invalid_response','Les missions reçues sont invalides.');
   }
   return {base:{roomId:identity.roomId,state,revision:raw.revision,actor:raw.actor,paired:raw.paired,pairingCode,quota,serverTime,...(raw.drawAvailable===undefined?{}:{drawAvailable:raw.drawAvailable}),gameVersion:raw.gameVersion,incoming,pendingOutgoing,...(raw.canExtendTasks===true?{canExtendTasks:true}:{}),...(penaltyTaskIds===undefined?{}:{penaltyTaskIds:[...penaltyTaskIds]}),...(badges===undefined?{}:{badges}),...(activity===undefined?{}:{activity})},roll};
  }
  function acceptSnapshot(raw,identity=connection){
   const checked=validateSnapshot(raw,identity);
   // Optional metadata never erases the same account's last validated collection.
   if(checked.base.badges===undefined&&snapshot?.badges&&snapshot.roomId===identity.roomId&&snapshot.actor===identity.actor)checked.base.badges=clone(snapshot.badges);
   if(checked.base.activity===undefined&&snapshot?.activity&&snapshot.roomId===identity.roomId&&snapshot.actor===identity.actor&&checked.base.revision===snapshot.revision)checked.base.activity=clone(snapshot.activity);
   if(!snapshot||checked.base.revision>=snapshot.revision){
    const changed=!snapshot||JSON.stringify(checked.base)!==JSON.stringify(snapshot),statusChanged=status.phase!=='connected'||!!status.message;
    snapshot=clone(checked.base);
    if(connection&&connection.pairingCode!==snapshot.pairingCode){connection.pairingCode=snapshot.pairingCode;try{write(storageKey,connection);}catch(_){}}
    authFailed=false;status={phase:'connected',message:'',lastUpdated:new Date().toISOString(),errorCode:null};
    if(changed||statusChanged)emit();
   }
   return {...clone(snapshot),...(checked.roll?{roll:checked.roll}:{})};
  }
  function remoteError(response,body,identity){
   const code=body?.error?.code||body?.code;
   const messages={upgrade_required:'Une nouvelle version est disponible. Ferme puis rouvre D6 à deux.',conflict:'La partie a changé sur l’autre téléphone. Elle vient d’être actualisée.',stale_round:'Cette proposition a changé. La partie vient d’être actualisée.',pairing_invalid:'Ce code n’est plus disponible. Vérifie-le avec l’autre personne.',invalid_code:'Ce code n’est plus disponible. Vérifie-le avec l’autre personne.',invalid_token:'Cet accès n’est plus reconnu. Reconnecte cet appareil.',unauthorized:'Cet accès n’est plus reconnu. Reconnecte cet appareil.',rate_limited:'Trop de tentatives rapprochées. Réessaie dans quelques instants.',not_allowed:'Cette action n’est pas disponible pour ce joueur.',invalid_credentials:'L’identifiant ou le mot de passe n’est pas reconnu.',no_stars:'Il te faut une étoile pour lancer les dés.',quota_exhausted:'Ton prochain tirage sera disponible à la prochaine plage.'};
   const fallback=response.status===401?'Cet accès n’est plus reconnu. Reconnecte cet appareil.':response.status===429?'Trop de tentatives rapprochées. Réessaie dans quelques instants.':response.status>=500?'La connexion au duo est momentanément indisponible.':'Cette action n’a pas pu être confirmée.';
   let updated=null;if(body?.state&&identity&&connection===identity&&!authFailed){try{updated=acceptSnapshot(body,identity);}catch(_){}}
   return failure(code||(response.status===409?'conflict':response.status===401?'unauthorized':'request_failed'),messages[code]||fallback,response.status,updated);
  }
  async function request(payload,token,attempts=2,publishSnapshot=true){
   requireEnabled();
   const identity=connection?.token===token?connection:null;
   const headers={'Content-Type':'application/json'};
   if(config.publishableKey)headers.apikey=config.publishableKey;
   if(token)headers.Authorization='Bearer '+token;
   let last;
   for(let attempt=0;attempt<attempts;attempt++){
    const abort=controller?new controller():null,timer=abort&&later?later(()=>abort.abort(),Number(config.requestTimeoutMs)||6000):null;
    try{
     const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify({gameVersion:GAME_VERSION,...payload}),mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',...(abort?{signal:abort.signal}:{})});
     const text=await response.text();if(text.length>2000000)throw failure('invalid_response','La réponse reçue est trop volumineuse.');
     let body;try{body=JSON.parse(text);}catch(_){throw failure('invalid_response','Le duo a renvoyé une réponse illisible.');}
     if(!response.ok){const error=remoteError(response,body,publishSnapshot?identity:null);if(response.status>=500&&attempt+1<attempts){last=error;continue;}throw error;}
     return body;
    }catch(error){
     if(error?.isDesirRemoteError)throw error;
     last=failure('offline','Connexion interrompue. Réessaie quand le réseau est revenu.');
     if(attempt+1>=attempts)throw last;
    }finally{if(timer)cancel(timer);}
   }
   throw last||failure('offline','La connexion au duo est indisponible.');
  }
  function connectionChanged(){return failure('connection_changed','La connexion a changé. Réessaie.');}
  function markFailure(error){if(error.code==='connection_changed')return;if(error.status===401)authFailed=true;const expected=connection&&['conflict','stale_round','quota_exhausted','not_allowed','invalid_action','invalid_phase','pending_action'].includes(error.code);setStatus(expected?'connected':error.code==='offline'?'offline':'error',error.message,error.code);}
  function storedLogin(){
   return readJournal(registrationKey,value=>{
    if(value?.version!==1||value.endpoint!==endpoint||value.op!=='login'||typeof value.token!=='string'||!TOKEN.test(value.token)||typeof value.requestId!=='string'||!REQUEST_ID.test(value.requestId))return null;
    return value;
   });
  }
  function pendingLogin(){
   const previous=storedLogin();if(previous)return previous;
   const pending={version:1,endpoint,op:'login',token:randomToken(),requestId:requestId()};write(registrationKey,pending);return pending;
  }
  async function finishLogin(raw,pending){
   const received=raw.connection||{token:pending.token,roomId:raw.roomId,actor:raw.actor};
   const identity=normalizedConnection({...received,token:received.token||pending.token},pending.token);identity.pairingCode=typeof raw.pairingCode==='string'?raw.pairingCode:null;
   validateSnapshot(raw,identity);write(storageKey,identity);if(snapshot&&(snapshot.roomId!==identity.roomId||snapshot.actor!==identity.actor))snapshot=null;connection=identity;remove(registrationKey);storedAction();
   const value=acceptSnapshot(raw);prepareNotifications().catch(()=>{});return value;
  }
  function login(username,password){
   const user=String(username||'').trim();
   if(!user||user.length>80||typeof password!=='string'||!password||password.length>256)return Promise.reject(failure('invalid_credentials','Renseigne ton identifiant et ton mot de passe.'));
   return serial(async()=>{requireEnabled();try{if(connection&&!authFailed)return await fetchState();setStatus('connecting');const pending=pendingLogin();const raw=await request({op:'login',requestId:pending.requestId,username:user,password},pending.token);return await finishLogin(raw,pending);}catch(error){markFailure(error);throw error;}});
  }
  function cleanAction(action){
   if(!action||!TYPES.has(action.type))throw failure('not_allowed','Cette action n’est pas disponible.');
   if(typeof action.roundId!=='string'||!ROUND_ID.test(action.roundId))throw failure('invalid_action','Le tour n’a pas pu être identifié. Actualise la partie.');
   const value={type:action.type,roundId:action.roundId};
   if(action.type==='SEND' && action.starPenalty===true)value.starPenalty=true;
   if(action.type==='JOKER_DRAW'){
    if(!Number.isInteger(action.category)||action.category<1||action.category>4)throw failure('invalid_action','La catégorie n’a pas pu être identifiée.');
    value.category=action.category;
   }
   if(action.type==='TOGGLE_TASK_CHECK'){
    if(typeof action.taskId!=='string'||!ROUND_ID.test(action.taskId)||typeof action.checked!=='boolean')throw failure('invalid_action','La case n’a pas pu être confirmée.');
    value.taskId=action.taskId;value.checked=action.checked;
   }else if(action.type==='REFUSE_TASK'||action.type==='EXTEND_TASK'){
    if(typeof action.taskId!=='string'||!ROUND_ID.test(action.taskId))throw failure('invalid_action','La carte n’a pas pu être identifiée. Actualise la partie.');
    value.taskId=action.taskId;
   }
   return value;
  }
  function storedAction(){
   // Preserve the original version when retrying a compatible stored command.
   return readJournal(actionKey,value=>{
    if(value?.version!==1||value.endpoint!==endpoint||value.roomId!==connection?.roomId||value.actor!==connection?.actor||!SUPPORTED_GAME_VERSIONS.includes(value.gameVersion)||typeof value.requestId!=='string'||!REQUEST_ID.test(value.requestId))return null;
    return {...value,action:cleanAction(value.action)};
   });
  }
  async function sendAction(pending,publishSnapshot=true){
   requireConnection();
   const identity=connection;
   try{
    const raw=await request({op:'action',gameVersion:pending.gameVersion,requestId:pending.requestId,action:pending.action},identity.token,2,publishSnapshot);
    if(connection!==identity||authFailed)throw connectionChanged();
    const value=publishSnapshot?acceptSnapshot(raw,identity):validateSnapshot(raw,identity);remove(actionKey);return value;
   }catch(error){if(connection!==identity||authFailed)throw connectionChanged();if(error.status>=400&&error.status<500&&error.status!==429)remove(actionKey);throw error;}
  }
  async function fetchState(identity=connection){requireConnection();try{const raw=await request({op:'state'},identity.token);if(connection!==identity||authFailed)throw connectionChanged();return acceptSnapshot(raw,identity);}catch(error){if(connection!==identity||authFailed)throw connectionChanged();throw error;}}
  function action(value){
   if(sessionOperation)return Promise.reject(failure('pending_action','La gestion des appareils est en cours.'));
   // A queued recovery must not turn a second tap into a fresh command after it clears the journal.
   if(recovering&&storedAction())return Promise.reject(failure('pending_action','Une action attend encore la confirmation du serveur.'));
   return serial(async()=>{requireConnection();try{
    const cleaned=cleanAction(value),pending=storedAction();
    if(pending&&JSON.stringify(pending.action)!==JSON.stringify(cleaned))throw failure('pending_action','Une action attend encore la connexion. Réessaie dans un instant.');
    const next=pending||{version:1,gameVersion:GAME_VERSION,endpoint,roomId:connection.roomId,actor:connection.actor,requestId:requestId(),action:cleaned};
    write(actionKey,next);return await sendAction(next);
   }catch(error){markFailure(error);throw error;}});
  }
  async function recoverPendingAction(pending,identity){
   return await serial(()=>{
    if(connection!==identity)throw connectionChanged();
    // An action ahead of this recovery in the queue may already have succeeded.
    const current=storedAction();if(!current||current.requestId!==pending.requestId)return null;
    // A receipt can contain an older protocol and quota window. The state read follows.
    return sendAction(current,false);
   });
  }
  function recoveryFor(pending,identity){
   if(recovering)return recovering;
   const recovery={followup:false,promise:null};
   recovery.promise=recoverPendingAction(pending,identity).then(()=>({error:null}),error=>({error})).finally(()=>{if(recovering===recovery)recovering=null;});
   recovering=recovery;return recovery;
  }
  function recoveryError(error,identity){
   if(!error||connection!==identity||error.code==='connection_changed')return;
   if(error.status===401){markFailure(error);return;}
   if(!authFailed&&storedAction())setStatus('connected','Une action attend encore la confirmation du serveur.','pending_action');
  }
  function refresh(){
   if(!connection)return Promise.resolve(null);
   if(authFailed)return Promise.reject(failure('not_connected','Connecte-toi pour continuer.'));
   if(refreshing)return refreshing;
   const identity=connection;
   refreshing=Promise.resolve().then(async()=>{try{
    const pending=storedAction();let pendingError=null;
    if(pending){
     const recovery=recoveryFor(pending,identity);let timer;
     // Let quick retries finish first; after a short wait, read independently.
     const result=await Promise.race([recovery.promise,new Promise(resolve=>{timer=later(()=>resolve(null),350);})]);
     if(timer)cancel(timer);
     if(result){
      if(result.error){const error=result.error;if(error.code==='offline'||error.status===429||error.status>=500)pendingError=error;else if(error.status<400||error.status===401)throw error;}
     }else if(!recovery.followup){
      recovery.followup=true;
      recovery.promise.then(async result=>{
       if(connection!==identity||authFailed)return;
       if(result.error){recoveryError(result.error,identity);if(result.error.status===401)return;}
       try{await fetchState(identity);if(storedAction())setStatus('connected','Une action attend encore la confirmation du serveur.','pending_action');}
       catch(error){if(connection===identity)markFailure(error);}
      }).catch(()=>{});
     }
    }
    if(connection!==identity||authFailed)throw connectionChanged();
    const value=await fetchState(identity);
    if(pendingError||storedAction())setStatus('connected','Une action attend encore la confirmation du serveur. Ta partie a été actualisée.','pending_action');
    return value;
   }catch(error){markFailure(error);throw error;}finally{refreshing=null;}});
   return refreshing;
  }
  function restore(){
   if(restoring)return restoring;
   restoring=Promise.resolve().then(async()=>{requireEnabled();setStatus('connecting');try{
    const pending=storedLogin();
    if(pending){
     try{const raw=await request({op:'state'},pending.token,1);return await finishLogin(raw,pending);}catch(error){if(error.status!==401)throw error;}
    }
    const saved=parsed(storageKey);
    if(saved){connection=checkStored(saved);const value=await refresh();prepareNotifications().catch(()=>{});return value;}
    setStatus('disconnected');return null;
   }catch(error){markFailure(error);throw error;}finally{restoring=null;}});return restoring;
  }
  function changeSessions(target){
   if(sessionOperation)return Promise.reject(failure('pending_action','La gestion des appareils est déjà en cours.'));
   sessionOperation=true;
   return serial(async()=>{try{
    requireConnection();const identity=connection;
    if(storedAction())throw failure('pending_action','Une action attend encore sa confirmation. Réessaie après sa synchronisation.');
    let confirmed=false;
    try{
     const result=await request({op:'revoke_sessions',scope:target},identity.token);
     if(connection!==identity)throw connectionChanged();
     if(result?.revoked!==true)throw failure('invalid_response','La révocation n’a pas pu être confirmée.');
     confirmed=true;
    }catch(error){
     if(connection!==identity)throw connectionChanged();
     // If the first response was lost, a second request can prove this token is already unusable.
     if(target==='current'&&error.status===401)confirmed=true;else throw error;
    }
    if(confirmed&&target==='current'){
     connection=null;snapshot=null;authFailed=false;remove(storageKey);remove(registrationKey);remove(actionKey);
     setNotification({subscribed:false});setStatus('disconnected');
    }
    return {revoked:true};
   }catch(error){markFailure(error);throw error;}}).finally(()=>{sessionOperation=false;});
  }
  const logout=()=>changeSessions('current');
  const revokeOtherDevices=()=>changeSessions('others');
  async function loadPortraits(){
   requireConnection();
   const identity=connection;
   const raw=await request({op:'portraits'},identity.token,1,false);
   if(connection!==identity||authFailed)throw connectionChanged();
   const portraits={};
   for(const actor of ['a','b']){
    const jpeg=raw?.portraits?.[actor];
    if(typeof jpeg==='string'&&jpeg.length>=8&&jpeg.length<=65536&&jpeg.length%4===0&&/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(jpeg))portraits[actor]='data:image/jpeg;base64,'+jpeg;
   }
   return portraits;
  }
  function iosInstallRequired(){const ua=nav.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&nav.maxTouchPoints>1);let standalone=nav.standalone===true;try{standalone=standalone||!!scope.matchMedia?.('(display-mode: standalone)').matches;}catch(_){}return ios&&!standalone;}
  function inspectNotifications(){
   const install=iosInstallRequired(),supported=!!(Notification&&nav.serviceWorker&&(environment.PushManager||scope.PushManager));
   const permission=Notification?.permission||'unsupported';
   setNotification({supported:supported&&!install,permission,...(permission!=='granted'||!supported||install?{subscribed:false}:{}),reason:install?'install_required':!supported?'unsupported':permission==='denied'?'denied':null,message:install?'Ajoute D6 à deux à l’écran d’accueil pour activer les notifications.':!supported?'Ce navigateur ne prend pas en charge les notifications.':permission==='denied'?'Les notifications sont désactivées dans les réglages du navigateur.':''});
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
   if(preparing){
    if(preparingIdentity===connection)return preparing;
    return preparing.catch(()=>{}).then(()=>connection&&!authFailed?prepareNotifications():null);
   }
   const support=inspectNotifications();if(!connection||!support.supported)return Promise.resolve(null);
   const identity=connection;preparingIdentity=identity;
   preparing=(async()=>{try{
    const reg=await serviceWorker();
    const existing=await reg.pushManager.getSubscription();
    if(connection!==identity||authFailed)throw connectionChanged();
    if(!existing&&Notification.permission==='granted')setNotification({subscribed:false,permission:'granted',reason:'subscription_missing',message:'Les notifications doivent être réactivées sur cet appareil.'});
    else if(Notification.permission!=='granted')setNotification({subscribed:false});
    if(existing&&Notification.permission==='granted')setNotification({subscribed:false,reason:'subscription_sync',message:'Synchronisation des notifications en cours…'});
    let configResponse;
    try{configResponse=await request({op:'push_config'},identity.token);}
    catch(error){if(connection===identity&&!authFailed&&existing&&Notification.permission==='granted')setNotification({subscribed:false,reason:'subscription_sync',message:'Notifications en attente de synchronisation. Réessaie quand la connexion est revenue.'});throw error;}
    if(connection!==identity||authFailed)throw connectionChanged();
    vapidKey=decodePublicKey(configResponse.vapidPublicKey||configResponse.publicKey);
    if(existing&&Notification.permission==='granted'){
     try{await request({op:'subscribe',subscription:existing.toJSON()},identity.token);}
     catch(error){if(connection===identity&&!authFailed)setNotification({subscribed:false,reason:'subscription_sync',message:'Notifications en attente de synchronisation. Réessaie quand la connexion est revenue.'});throw error;}
     if(connection!==identity||authFailed)throw connectionChanged();
     if(!notificationReconcile)setNotification({subscribed:true,permission:'granted',reason:null,message:''});
    }
    return reg;
   }finally{preparing=null;preparingIdentity=null;}})();return preparing;
  }
  async function enableNotifications(){
   requireConnection();const identity=connection,support=inspectNotifications();if(!support.supported)throw failure(support.reason||'notifications_unsupported',support.message);
   if(Notification.permission==='denied')throw failure('notifications_denied',support.message);
   // Request synchronously on the original click, before any network or SW await.
   try{
    const permissionRequest=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
    const permission=await permissionRequest;if(connection!==identity||authFailed)throw connectionChanged();setNotification({permission});if(permission!=='granted')throw failure('notifications_denied','Les notifications restent désactivées.');
    const reg=await prepareNotifications();if(connection!==identity||authFailed)throw connectionChanged();if(!reg||!vapidKey)throw failure('notifications_unavailable','Les notifications ne sont pas encore disponibles. Réessaie.');
    let sub=await reg.pushManager.getSubscription();if(connection!==identity||authFailed)throw connectionChanged();
    if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKey});if(connection!==identity||authFailed)throw connectionChanged();}
    await request({op:'subscribe',subscription:sub.toJSON()},identity.token);if(connection!==identity||authFailed)throw connectionChanged();
    const latest=await reg.pushManager.getSubscription();if(connection!==identity||authFailed)throw connectionChanged();
    if(!latest||latest.toJSON()?.endpoint!==sub.toJSON()?.endpoint)throw failure('notifications_unavailable','Les notifications ont changé. Réessaie de les activer.');
    setNotification({permission:'granted',subscribed:true,reason:null,message:''});return {...notificationStatus};
   }catch(error){const known=error?.isDesirRemoteError?error:failure('notifications_unavailable','Les notifications n’ont pas pu être activées sur cet appareil.');if(connection===identity&&!authFailed)setNotification({subscribed:false,message:known.message,reason:known.code});throw known;}
  }
  function refreshQuietly(){if(connection&&!authFailed&&(!doc||!doc.hidden))refresh().catch(()=>{});}
  function reconcileNotifications(){
   if(!connection||authFailed)return;
   if(preparing){
    if(!notificationReconcile){setNotification({subscribed:false,reason:'subscription_sync',message:'Vérification des notifications en cours…'});notificationReconcile=true;preparing.finally(()=>{notificationReconcile=false;if(connection&&!authFailed)prepareNotifications().catch(()=>{});}).catch(()=>{});}
   }else prepareNotifications().catch(()=>{});
  }
  function visible(){if(!doc?.hidden){refreshQuietly();reconcileNotifications();}}
  function online(){refreshQuietly();reconcileNotifications();}
  function pushMessage(event){if(event.data?.type==='desir-state-refresh')refreshQuietly();else if(event.data?.type==='desir-subscription-changed')reconcileNotifications();}
  function start(){if(started||!enabled)return;started=true;pollTimer=every(refreshQuietly,Number(config.pollIntervalMs)||5000);doc?.addEventListener?.('visibilitychange',visible);scope.addEventListener?.('online',online);scope.addEventListener?.('pageshow',visible);nav.serviceWorker?.addEventListener?.('message',pushMessage);if(nav.serviceWorker)serviceWorker().catch(()=>{});}
  function stop(){if(!started)return;started=false;if(pollTimer)cancelEvery(pollTimer);pollTimer=null;doc?.removeEventListener?.('visibilitychange',visible);scope.removeEventListener?.('online',online);scope.removeEventListener?.('pageshow',visible);nav.serviceWorker?.removeEventListener?.('message',pushMessage);}
  inspectNotifications();
  return Object.freeze({enabled,get authenticated(){return !!connection&&!authFailed;},get connection(){return connection?{roomId:connection.roomId,actor:connection.actor}:null;},get snapshot(){return clone(snapshot);},get status(){return {...status};},get notificationStatus(){return {...notificationStatus};},get pendingRegistration(){const value=storedLogin();return value?{op:value.op}:null;},restore,login,refresh,action,logout,revokeOtherDevices,loadPortraits,enableNotifications,prepareNotifications,start,stop,subscribeToChanges(listener){if(typeof listener!=='function')throw new TypeError('A listener is required.');listeners.add(listener);return ()=>listeners.delete(listener);}});
 }
 const api=Object.freeze({create});scope.OndeRemote=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
