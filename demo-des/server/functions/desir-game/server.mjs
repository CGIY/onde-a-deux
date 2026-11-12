import {HttpError,validDeviceToken,validRequestId,sha256,privateBucket,normalizeUsername,parseAction,assertClientCompatibility,snapshot,applyAction,supportsParallelGame} from './model.mjs';


const defaultOrigin='https://cgiy.github.io';
function getBearer(req){const match=/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.get('Authorization')||'');if(!match||!validDeviceToken(match[1]))throw new HttpError(401,'unauthorized','Connecte-toi pour continuer.');return match[1];}
function clientIp(req){return req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'unknown').split(',').pop().trim();}
async function boundedBody(req){
  const reader=req.body?.getReader();if(!reader)return '';
  const chunks=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>16384){await reader.cancel();throw new HttpError(413,'request_too_large','Requête trop volumineuse.');}chunks.push(part.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new HttpError(400,'invalid_json','Requête invalide.');}
}
function bodyObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function validPortrait(value){return typeof value==='string'&&value.length>=8&&value.length<=65536&&value.length%4===0&&/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value);}
export function createHandler({G,store,push,rateSecret,clock=()=>new Date(),allowedOrigins=[defaultOrigin],waitUntil}){
  if(!G||!store||!rateSecret)throw new Error('Missing server dependencies');
  const iso=()=>clock().toISOString();
  async function rate(bucket,limit,seconds){if(!await store.rpc('desir_rate_limit',{p_bucket:bucket,p_limit:limit,p_seconds:seconds}))throw new HttpError(429,'rate_limited','Réessaie dans quelques minutes.');}
  function flush(roomId){if(!push)return;const job=push.flushPushOutbox(store,roomId).catch(()=>{});if(waitUntil)waitUntil(job);else void job;}
  async function context(tokenHash,gameVersion){
    for(let attempt=0;attempt<5;attempt++){
      const current=await store.rpc('desir_get_session',{p_token_hash:tokenHash});
      if(!current)throw new HttpError(401,'unauthorized','Connecte-toi pour continuer.');
      if(!current.member||!['a','b'].includes(current.member.actor)||!current.room||!Number.isSafeInteger(Number(current.room.revision)))throw new Error('Invalid session data');
      const parallel=supportsParallelGame(gameVersion)||current.room.state?.version===2,at=iso();
      const normalized=parallel?G.normalizeRoom(current.room.state,{at}):G.normalizeState(current.room.state,{at});
      if(!normalized)throw new Error('Invalid stored game');
      const actorState=parallel?normalized:{...normalized,activePlayer:current.member.actor};
      const next=parallel?G.reduceRoom(normalized,{type:'EXPIRE_TASKS',at}):G.reduce(actorState,{type:'EXPIRE_TASKS',at});
      if(normalized===current.room.state&&next===actorState)return {...current,actionAt:at};
      if(parallel&&normalized.categoryBoost)next.categoryBoost=normalized.categoryBoost;
      await store.rpc('desir_expire_room',{p_room_id:current.room.id,p_expected_revision:current.room.revision,p_next_state:next});
    }
    throw new HttpError(503,'temporarily_unavailable','La partie se met à jour. Réessaie.');
  }
  /** @returns {Promise<never>} */
  async function conflict(tokenHash,gameVersion,code='conflict',message='La partie a changé. Réessaie.'){
    const fresh=await context(tokenHash,gameVersion);throw new HttpError(409,code,message,snapshot(G,fresh,{},gameVersion));
  }
  return async function handle(req){
    const origin=req.headers.get('Origin'),allowed=!origin||allowedOrigins.includes(origin);
    const cors={...(origin&&allowed?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
    const respond=(value,status=200)=>new Response(JSON.stringify(value?.state?{...value,serverTime:iso()}:value),{status,headers:cors});
    try{
      if(!allowed)throw new HttpError(403,'forbidden_origin','Origine non autorisée.');
      if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Max-Age':'600'}});
      if(req.method!=='POST')throw new HttpError(405,'method_not_allowed','Méthode indisponible.');
      if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))throw new HttpError(415,'invalid_content_type','Une requête JSON est attendue.');
      if(Number(req.headers.get('Content-Length')||0)>16384)throw new HttpError(413,'request_too_large','Requête trop volumineuse.');
      const text=await boundedBody(req);
      let body;try{body=JSON.parse(text);}catch{throw new HttpError(400,'invalid_json','Requête invalide.');}
      if(!bodyObject(body)||typeof body.op!=='string')throw new HttpError(400,'invalid_request','Requête invalide.');
      if(['create','join'].includes(body.op))throw new HttpError(404,'not_found','Cette inscription n’est pas disponible.');
      if(body.op==='drain_push'){
        await rate('cron-ip:'+await privateBucket(rateSecret,clientIp(req)),60,60);
        if(!push?.isPushCronAuthorized||!await push.isPushCronAuthorized(store,req.headers.get('x-desir-cron')))throw new HttpError(401,'unauthorized','Accès non autorisé.');
        if(Object.keys(body).some(key=>key!=='op'))throw new HttpError(400,'invalid_request','Requête invalide.');
        await store.rpc('desir_cleanup',{});
        await push.enqueueScheduled(store);
        const job=push.flushPushOutbox(store).catch(()=>{});if(waitUntil)waitUntil(job);else await job;
        return respond({queued:true},202);
      }
      if(!['login','state','action','portraits','rhythm','rhythm_add','push_config','subscribe','hardcore','revoke_sessions'].includes(body.op))throw new HttpError(404,'not_found','Opération indisponible.');
      const gameVersion=Object.hasOwn(body,'gameVersion')?body.gameVersion:1;
      if(![1,2,3,4,5].includes(gameVersion)&&!supportsParallelGame(gameVersion))throw new HttpError(400,'invalid_request','Version de jeu invalide.');
      const token=getBearer(req),tokenHash=await sha256('device:'+token);
      if(!supportsParallelGame(gameVersion))throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour utiliser la nouvelle version.');
      // The former live combat is retired. Keep this response before all RPCs,
      // so an old tab cannot recreate a session after loading the unified game.
      if(body.op==='hardcore')throw new HttpError(410,'mode_removed','Les cartes Hardcore se trouvent maintenant dans Intimité.');
      const ipBucket=await privateBucket(rateSecret,clientIp(req));
      if(body.op==='login'){
        if(Object.keys(body).some(key=>!['op','username','password','requestId','gameVersion'].includes(key)))throw new HttpError(400,'invalid_request','Requête invalide.');
        await rate('login-ip:'+ipBucket,20,900);
        const username=normalizeUsername(body.username);
        const password=body.password;
        if(!username||username.length>80||typeof password!=='string'||!password.length||password.includes('\0')||new TextEncoder().encode(password).length>72)throw new HttpError(401,'invalid_credentials','Identifiants incorrects.');
        const accountBucket=await privateBucket(rateSecret,username);
        await rate('login-account:'+accountBucket,8,900);
        const result=await store.rpc('desir_login',{p_login:username,p_password:password,p_token_hash:tokenHash});
        if(!result)throw new HttpError(401,'invalid_credentials','Identifiants incorrects.');
        if(result.error)throw new HttpError(409,'session_conflict','Cette session appartient à un autre compte.');
        const current=await context(tokenHash,gameVersion);flush(current.room.id);
        return respond(snapshot(G,current,{connection:{token,roomId:current.room.id,actor:current.member.actor}},gameVersion));
      }
      if(Object.keys(body).some(key=>!['op','requestId','action','subscription','gameVersion'].includes(key)&&!(body.op==='revoke_sessions'&&key==='scope')&&!(body.op==='rhythm_add'&&key==='kind')))throw new HttpError(400,'invalid_request','Requête invalide.');
      // Both independent limits must pass before any session or game access.
      await Promise.all([
        rate('authenticated-ip:'+ipBucket,600,60),
        rate('device:'+tokenHash,240,60)
      ]);
      if(body.op==='revoke_sessions'){
        if(Object.keys(body).some(key=>!['op','gameVersion','scope'].includes(key))||!['current','others'].includes(body.scope))throw new HttpError(400,'invalid_request','Requête invalide.');
        const revoked=await store.rpc('desir_revoke_sessions',{p_token_hash:tokenHash,p_scope:body.scope});
        if(!revoked)throw new HttpError(401,'unauthorized','Connecte-toi pour continuer.');
        return respond({revoked:true});
      }
      if(body.op==='rhythm_add'){
        if(Object.keys(body).some(key=>!['op','gameVersion','requestId','kind'].includes(key))||
          !validRequestId(body.requestId)||!['penetration','no_penetration','anal','masturbation','nudes'].includes(body.kind))throw new HttpError(400,'invalid_request','Saisie invalide.');
        const result=await store.rpc('desir_record_rhythm',{p_token_hash:tokenHash,p_request_id:body.requestId,p_kind:body.kind});
        if(result?.status==='unauthorized')throw new HttpError(401,'unauthorized','Connecte-toi pour continuer.');
        if(result?.status==='forbidden')throw new HttpError(403,'not_allowed','La saisie est réservée au compte autorisé.');
        if(result?.status!=='ok')throw new Error('Invalid rhythm write response');
        return respond({rhythm:result.rhythm,canRecord:true});
      }
      if(body.op==='portraits'||body.op==='rhythm'){
        if(Object.keys(body).some(key=>!['op','gameVersion'].includes(key)))throw new HttpError(400,'invalid_request','Requête invalide.');
        const current=await store.rpc('desir_get_session',{p_token_hash:tokenHash});
        if(!current)throw new HttpError(401,'unauthorized','Connecte-toi pour continuer.');
        const roomId=current.member?.room_id;
        if(!['a','b'].includes(current.member?.actor)||typeof roomId!=='string'||roomId!==current.room?.id)throw new Error('Invalid room session');
        if(body.op==='rhythm'){
          const rows=await store.request('desir_room_rhythm?select=started_on,ended_on,with_penetration,without_penetration,anal,masturbation,nudes,editor_actor&room_id=eq.'+encodeURIComponent(roomId));
          if(!rows[0])return respond({rhythm:null,canRecord:false});
          const {editor_actor,...rhythm}=rows[0];
          const today=G.parisDateKey(iso());
          if(today>rhythm.ended_on)rhythm.ended_on=today;
          return respond({rhythm,canRecord:editor_actor===current.member.actor});
        }
        const rows=await store.request('desir_room_portraits?select=actor,jpeg_base64&room_id=eq.'+encodeURIComponent(roomId));
        const portraits={};
        for(const row of rows)if(['a','b'].includes(row.actor)&&validPortrait(row.jpeg_base64))portraits[row.actor]=row.jpeg_base64;
        return respond({portraits});
      }
      let current=await context(tokenHash,gameVersion);
      if(body.op==='state')return respond(snapshot(G,current,{},gameVersion));
      if(body.op==='push_config'){
        if(!push)throw new HttpError(503,'push_unavailable','Notifications indisponibles.');
        const config=await push.ensurePushConfig(store);return respond({vapidPublicKey:config.publicKey});
      }
      if(body.op==='subscribe'){
        if(!push)throw new HttpError(503,'push_unavailable','Notifications indisponibles.');
        const result=await push.saveSubscription(store,current.member,body.subscription);return respond(result);
      }
      if(!validRequestId(body.requestId))throw new HttpError(400,'invalid_request_id','Identifiant de requête invalide.');
      const action=parseAction(body.action);
      const receiptPayload=gameVersion>=2?{...action,gameVersion}:action;
      const payloadHash=await sha256(JSON.stringify(receiptPayload));
      const existing=await store.rpc('desir_get_request',{p_room_id:current.room.id,p_actor:current.member.actor,p_request_id:body.requestId,p_payload_hash:payloadHash});
      if(existing.kind==='mismatch')throw new HttpError(409,'request_id_reused','Cette requête a déjà été utilisée.');
      if(existing.kind==='replayed'){flush(current.room.id);return respond(existing.response);}
      assertClientCompatibility(G,current.room.state,current.member.actor,gameVersion);
      for(let attempt=0;attempt<4;attempt++){
        if(action.type==='ROLL_CATEGORY'&&current.quota.remaining===0)await conflict(tokenHash,gameVersion,'quota_exhausted','Ton tirage de cette plage a déjà été utilisé.');
        let result;
        try{result=applyAction(G,current.room.state,current.member.actor,action,body.requestId,current.actionAt,G.randomInt,gameVersion);}
        catch(error){if(error instanceof HttpError&&error.status===409)await conflict(tokenHash,gameVersion,error.code,error.message);throw error;}
        const reply=snapshot(G,{...current,room:{...current.room,state:result.state}},{...(result.roll?{roll:result.roll}:{})},gameVersion);
        const committed=await store.rpc('desir_commit',{p_room_id:current.room.id,p_actor:current.member.actor,p_request_id:body.requestId,p_payload_hash:payloadHash,p_expected_revision:current.room.revision,p_next_state:result.state,p_response:reply,p_consume_ticket:result.consumeTicket,p_notification:result.notification});
        if(committed.kind==='applied'||committed.kind==='replayed'){flush(current.room.id);return respond(committed.response);}
        if(committed.kind==='mismatch')throw new HttpError(409,'request_id_reused','Cette requête a déjà été utilisée.');
        if(committed.kind==='quota_exhausted')await conflict(tokenHash,gameVersion,'quota_exhausted','Ton tirage de cette plage a déjà été utilisé.');
        current=await context(tokenHash,gameVersion);
      }
      return await conflict(tokenHash,gameVersion);
    }catch(error){
      if(error instanceof HttpError)return respond({...(error.snapshot||{}),error:{code:error.code,message:error.message}},error.status);
      // No credentials, card contents, account names or raw database errors in logs.
      return respond({error:{code:'server_error',message:'Le service est temporairement indisponible.'}},503);
    }
  };
}
