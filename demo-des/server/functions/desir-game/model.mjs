export class HttpError extends Error {
  constructor(status,code,message,snapshot){super(message);this.status=status;this.code=code;this.snapshot=snapshot;}
}
const copy=value=>JSON.parse(JSON.stringify(value));
const allowedTypes=new Set(['ROLL_CATEGORY','ROLL_CARD','REROLL_CARD','CHALLENGE_DRAFT','ROLL_DRAFT_DEFENSE','SEND','CHALLENGE','ROLL_DEFENSE','ACCEPT','NEW_ROUND','TOGGLE_TASK_CHECK']);
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validRequestId=id=>typeof id==='string'&&uuidPattern.test(id);
export function validDeviceToken(token){
  if(typeof token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(token))return false;
  try{const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/')+'=');return binary.length===32&&btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')===token;}catch{return false;}
}
export async function sha256(value){const bytes=new TextEncoder().encode(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function privateBucket(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function normalizeUsername(value){return typeof value==='string'?value.normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase():'';}
export function parseAction(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!allowedTypes.has(input.type))throw new HttpError(400,'invalid_action','Cette action n’est pas disponible.');
  const keys=input.type==='TOGGLE_TASK_CHECK'?['type','roundId','taskId','checked']:['type','roundId'];
  if(Object.keys(input).some(key=>!keys.includes(key))||typeof input.roundId!=='string'||!/^onde-[1-9]\d*$/.test(input.roundId))throw new HttpError(400,'invalid_action','Action invalide.');
  const action={type:input.type,roundId:input.roundId};
  if(input.type==='TOGGLE_TASK_CHECK'){
    if(typeof input.taskId!=='string'||!/^onde-[1-9]\d*$/.test(input.taskId)||typeof input.checked!=='boolean')throw new HttpError(400,'invalid_action','Case invalide.');
    action.taskId=input.taskId;action.checked=input.checked;
  }
  return action;
}
export function projectState(G,full,actor){
  if(!G.validateState(full)||!['a','b'].includes(actor))throw new Error('Invalid authoritative state');
  const projected=copy(full);projected.activePlayer=actor;projected.seen={};projected.favorites=[];
  projected.history=projected.history.filter(round=>G.canSeeRound({round,phase:'resolved',activePlayer:actor},actor)).map(round=>{
    if(round.from!==actor){delete round.hand;delete round.draftRollTokens;delete round.rollTokens;}
    return round;
  });
  if(!G.canSeeRound(full,actor)){
    projected.phase='category';projected.round=copy(G.createState().round);
    Object.assign(projected.round,{id:full.round.id,from:full.round.from,to:full.round.to});
  }else if(full.round.from!==actor&&projected.round.cardId){
    // Keep the selected index valid without sending the three unrevealed IDs.
    const selected=projected.round.cardId,decoys=G.cards.filter(c=>c.categoryId===projected.round.categoryId&&c.id!==selected).slice(0,3).map(c=>c.id);
    let n=0;projected.round.hand=Array.from({length:4},(_,i)=>i===projected.round.cardRoll-1?selected:decoys[n++]);
  }
  if(!G.validateState(projected))throw new Error('Invalid projected state');
  return projected;
}
export function snapshot(G,context,extra={}){
  return {roomId:context.room.id,state:projectState(G,context.room.state,context.member.actor),revision:Number(context.room.revision),actor:context.member.actor,paired:context.paired===true,quota:copy(context.quota),...extra};
}
export function applyAction(G,full,actor,input,requestId,at,randomInt=G.randomInt){
  const action=parseAction(input);
  if(!validRequestId(requestId))throw new HttpError(400,'invalid_request_id','Identifiant de requête invalide.');
  if(action.type!=='TOGGLE_TASK_CHECK'&&action.roundId!==full.round.id)throw new HttpError(409,'stale_round','Le tour a changé.');
  if(action.type==='NEW_ROUND'&&!['accepted','resolved'].includes(full.phase))throw new HttpError(409,'invalid_phase','Le tour est déjà en cours.');
  const state=copy(full);state.activePlayer=actor;
  if(!G.validateState(state))throw new Error('Invalid authoritative state');
  let roll;
  if(action.type==='ROLL_CATEGORY'){const value=randomInt(6);action.value=value;action.hand=G.drawHand(state,value);roll={kind:6,value};}
  else if(action.type==='ROLL_CARD'){const value=randomInt(4);action.value=value;roll={kind:4,value};}
  else if(action.type==='REROLL_CARD'){
    if(!G.canRerollCard(state))throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const alternatives=[1,2,3,4].filter(value=>value!==state.round.cardRoll),index=randomInt(3);
    if(!Number.isInteger(index)||index<1||index>3)throw new Error('Invalid authoritative random outcome');
    const value=alternatives[index-1];action.value=value;roll={kind:4,value};
  }
  else if(action.type==='ROLL_DRAFT_DEFENSE'||action.type==='ROLL_DEFENSE'){const value=randomInt(20);action.value=value;action.token='request:'+requestId;roll={kind:20,value};}
  const next=G.reduce(state,{...action,actor,at});
  if(next===state)throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
  if(!G.validateState(next))throw new Error('Core returned an invalid state');
  let notification=null;
  if(next.phase==='pending'&&next.round.awaiting!==actor&&full.phase!=='pending')notification={actor:next.round.awaiting,kind:'invitation'};
  else if(next.phase==='sender_confirmation'&&next.round.awaiting!==actor&&full.phase!=='sender_confirmation')notification={actor:next.round.awaiting,kind:'confirmation'};
  return {state:next,roll,notification,consumeTicket:action.type==='ROLL_CATEGORY'};
}
