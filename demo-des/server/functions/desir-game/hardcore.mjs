// Private live session, isolated from normal rounds, quotas and notification state.
import {HttpError,validRequestId,sha256} from './model.mjs';
const actors=['a','b'],copy=value=>value==null?value:structuredClone(value);
const terminal=new Set(['cancelled','expired','won','lost']);
const time=value=>Date.parse(value),iso=value=>new Date(value).toISOString();
const limits={CREATE:['type'],OPT_IN:['type','sessionId','enabled'],PRESS:['type','sessionId','pressId','sequence','held'],ACK:['type','sessionId','preparationId','pressId'],ATTACK:['type','sessionId','slot'],CANCEL:['type','sessionId']};
export function parseHardcoreAction(input){
 if(input==null)return null;
 if(typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(limits,input.type)||Object.keys(input).some(key=>!limits[input.type].includes(key)))throw new HttpError(400,'invalid_action','Cette action n’est pas disponible.');
 if(input.type!=='CREATE'&&!validRequestId(input.sessionId))throw new HttpError(400,'invalid_action','Session invalide.');
 if(input.type==='OPT_IN'&&typeof input.enabled!=='boolean'||input.type==='ATTACK'&&![1,2].includes(input.slot)||input.type==='PRESS'&&(!validRequestId(input.pressId)||!Number.isSafeInteger(input.sequence)||input.sequence<1||input.sequence>1000000||typeof input.held!=='boolean')||input.type==='ACK'&&(!validRequestId(input.preparationId)||!validRequestId(input.pressId)))throw new HttpError(400,'invalid_action','Action invalide.');
 return copy(input);
}
function emptyBoss(){return {maxHp:48,damageTotal:0,hpRemaining:48,attacksUsed:{a:0,b:0},attackLimit:4,perActorLimit:2,outcome:null};}
export function createHardcore(at,id=crypto.randomUUID()){
 return {id,catalogueVersion:'hardcore-v1',createdAt:iso(at),expiresAt:iso(at+30*60000),status:'waiting',optedIn:{a:false,b:false},presses:{a:null,b:null},preparationId:null,acknowledged:{a:false,b:false},actionRoll:null,boss:emptyBoss(),attackLedger:[],_selected:null,_preparedPresses:null,_closed:{a:[],b:[]}};
}
function clearPreparation(session){session.preparationId=null;session.acknowledged={a:false,b:false};session._preparedPresses=null;session.actionRoll=null;if(!terminal.has(session.status))session.status='waiting';}
function closePress(session,actor,id){if(!session._closed[actor].includes(id))session._closed[actor].push(id);}
function stop(session,status){session.status=status;session.optedIn={a:false,b:false};for(const actor of actors){const p=session.presses[actor];if(p){closePress(session,actor,p.id);p.held=false;}}session.preparationId=null;session.acknowledged={a:false,b:false};session._preparedPresses=null;}
function held(session,actor,at){const p=session.presses[actor];return p?.held===true&&time(p.expiresAt)>at;}
function running(session,at){return !!session.actionRoll&&at>=time(session.actionRoll.startAt);}
export function normalizeHardcore(stored,at){
 if(!stored)return null;
 const session=copy(stored);
 if(!terminal.has(session.status)&&time(session.expiresAt)<=at){stop(session,'expired');return session;}
 if(terminal.has(session.status))return session;
 const start=time(session.actionRoll?.startAt);
 // Expired app presence must not start a preparation; a committed roll already
 // started while both leases were live is allowed to finish after backgrounding.
 for(const actor of actors){const p=session.presses[actor];if(p?.held&&time(p.expiresAt)<=at){p.held=false;closePress(session,actor,p.id);if(!session.actionRoll||time(p.expiresAt)<=start)clearPreparation(session);}}
 if(session.actionRoll&&at>=time(session.actionRoll.revealAt))session.status='combat';
 const landed=session.attackLedger.filter(hit=>time(hit.impactAt)<=at),damage=landed.reduce((sum,hit)=>sum+hit.value,0);
 session.boss={...emptyBoss(),damageTotal:damage,hpRemaining:Math.max(0,48-damage),attacksUsed:{a:session.attackLedger.filter(hit=>hit.actor==='a').length,b:session.attackLedger.filter(hit=>hit.actor==='b').length},outcome:damage>=48?'won':landed.length===4?'lost':null};
 if(landed.length===4)session.status=session.boss.outcome;
 return session;
}
function prepare(session,at,uuid){
 if(session.status==='waiting'&&session.optedIn.a&&session.optedIn.b&&actors.every(actor=>held(session,actor,at))){
  session.status='preparing';session.preparationId=uuid();session._preparedPresses={a:session.presses.a.id,b:session.presses.b.id};session.acknowledged={a:false,b:false};
 }
}
export function reduceHardcore(stored,actor,input,at,{randomInt,uuid=()=>crypto.randomUUID()}={}){
 if(!actors.includes(actor))throw new Error('Invalid authoritative actor');
 const action=parseHardcoreAction(input),session=normalizeHardcore(stored,at);
 if(!action)return session;
 if(action.type==='CREATE')return !session||terminal.has(session.status)?createHardcore(at,uuid()):session;
 if(!session||session.id!==action.sessionId)throw new HttpError(409,'stale_session','La session a changé.');
 if(action.type==='CANCEL'){if(!terminal.has(session.status)||session.optedIn.a||session.optedIn.b)stop(session,'cancelled');return session;}
 if(action.type==='OPT_IN'&&!action.enabled){stop(session,'cancelled');return session;}
 if(terminal.has(session.status))throw new HttpError(409,'invalid_phase','Cette session est terminée.');
 if(action.type==='OPT_IN'){session.optedIn[actor]=true;return session;}
 if(!session.optedIn.a||!session.optedIn.b)throw new HttpError(409,'not_ready','Vous devez tous les deux activer ce mode.');
 if(action.type==='PRESS'){
  const old=session.presses[actor],closed=session._closed[actor];
  if(closed.includes(action.pressId))return session;
  if(old?.id===action.pressId&&action.sequence<=old.sequence)return session;
  if(!action.held){
   if(closed.length>=512&&old?.id!==action.pressId)throw new HttpError(409,'session_press_limit','Rouvre une session pour continuer.');
   closePress(session,actor,action.pressId);
   if(old?.id===action.pressId){old.held=false;old.sequence=action.sequence;if(!running(session,at))clearPreparation(session);}
   return session;
  }
  if(running(session,at))return session;
  if(closed.length>=512)throw new HttpError(409,'session_press_limit','Rouvre une session pour continuer.');
  if(old&&old.id!==action.pressId){closePress(session,actor,old.id);clearPreparation(session);}
  session.presses[actor]={id:action.pressId,sequence:action.sequence,held:true,expiresAt:iso(at+2000)};
  prepare(session,at,uuid);return session;
 }
 if(action.type==='ACK'){
  if(session.status!=='preparing'||session.preparationId!==action.preparationId||session._preparedPresses?.[actor]!==action.pressId||session.presses[actor]?.id!==action.pressId||!actors.every(who=>held(session,who,at)))throw new HttpError(409,'stale_preparation','Maintenez de nouveau les deux boutons.');
  session.acknowledged[actor]=true;
  if(session.acknowledged.a&&session.acknowledged.b){
   if(!session._selected){const value=randomInt(20);if(!Number.isInteger(value)||value<1||value>20)throw new Error('Invalid authoritative random value');session._selected={id:uuid(),kind:20,value,actionId:'hardcore-'+String(value).padStart(2,'0')};}
   session.actionRoll={...session._selected,startAt:iso(at+1100),revealAt:iso(at+3300)};session.status='scheduled';
  }
  return session;
 }
 if(action.type==='ATTACK'){
  if(!session.actionRoll||at<time(session.actionRoll.revealAt)||session.attackLedger.length>=4)throw new HttpError(409,'invalid_phase','Les attaques ne sont pas disponibles.');
  if(session.attackLedger.some(hit=>hit.actor===actor&&hit.slot===action.slot))return session;
  const value=randomInt(20);if(!Number.isInteger(value)||value<1||value>20)throw new Error('Invalid authoritative random value');
  session.attackLedger.push({id:uuid(),actor,slot:action.slot,kind:20,value,startAt:iso(at+1100),impactAt:iso(at+3300)});
  return normalizeHardcore(session,at);
 }
 throw new HttpError(400,'invalid_action','Cette action n’est pas disponible.');
}
export function projectHardcore(stored,at){
 const session=normalizeHardcore(stored,at);if(!session)return null;
 const {id,catalogueVersion,createdAt,expiresAt,status,optedIn,presses,preparationId,acknowledged,boss,attackLedger}=session;
 // Deliver the committed face with its future schedule, so both screens can
 // start on that schedule instead of waiting for a poll after startAt. The UI
 // reveals it at revealAt; cancellation still preserves _selected internally.
 const actionRoll=session.actionRoll;
 return copy({id,catalogueVersion,createdAt,expiresAt,status,optedIn,presses,preparationId,acknowledged,actionRoll,boss,attackLedger});
}
export async function handleHardcore({store,context,action:input,requestId,at,now=()=>at,randomInt,uuid}){
 const action=parseHardcoreAction(input),roomId=context.roomId,actor=context.actor;
 if(action&&!validRequestId(requestId))throw new HttpError(400,'invalid_request_id','Identifiant de requête invalide.');
 const payloadHash=action?await sha256(JSON.stringify(action)):null;
 let record=await store.rpc('desir_hardcore_get',{p_room_id:roomId});
 if(!record?.enabled)throw new HttpError(404,'mode_unavailable','Ce mode n’est pas disponible.');
 const reply=record=>{const sentAt=now();return {session:projectHardcore(record.state,sentAt),revision:Number(record.revision),actor,serverTime:iso(sentAt)};};
 if(action){
  const receipt=await store.rpc('desir_hardcore_receipt',{p_room_id:roomId,p_actor:actor,p_request_id:requestId,p_payload_hash:payloadHash});
  if(receipt.kind==='mismatch')throw new HttpError(409,'request_id_reused','Cette requête a déjà été utilisée.');
  if(receipt.kind==='replayed')return reply(record);
 }
 for(let attempt=0;attempt<8;attempt++){
  const next=reduceHardcore(record.state,actor,action,now(),{randomInt,uuid});
  if(!action)return reply({...record,state:next});
  const committed=await store.rpc('desir_hardcore_commit',{p_room_id:roomId,p_actor:actor,p_request_id:requestId,p_payload_hash:payloadHash,p_expected_revision:Number(record.revision),p_next_state:next});
  if(committed.kind==='mismatch')throw new HttpError(409,'request_id_reused','Cette requête a déjà été utilisée.');
  if(committed.kind==='disabled')throw new HttpError(404,'mode_unavailable','Ce mode n’est pas disponible.');
  if(committed.kind==='applied'||committed.kind==='replayed')return reply(committed);
  record=await store.rpc('desir_hardcore_get',{p_room_id:roomId});
  if(!record?.enabled)throw new HttpError(404,'mode_unavailable','Ce mode n’est pas disponible.');
 }
 throw new HttpError(409,'conflict','La session se met à jour. Réessaie.');
}
