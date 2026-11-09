export class HttpError extends Error {
  constructor(status,code,message,snapshot){super(message);this.status=status;this.code=code;this.snapshot=snapshot;}
}
const copy=value=>JSON.parse(JSON.stringify(value));
const allowedTypes=new Set(['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT','REROLL_CARD','REROLL_CATEGORY','JOKER_DRAW','SEND','REFUSE_TASK','NEW_ROUND','TOGGLE_TASK_CHECK']);
const legacyTypes=new Set([...allowedTypes,'SEND_DAILY','ACCEPT','PASS']);
// Pin the catalogue to the client capability so older clients keep drawing
// cards they can display after a server upgrade.
const catalogueForGame=new Map([[6,3],[7,4],[8,5]]);
export const supportsParallelGame=version=>catalogueForGame.has(version);
const requiresNewCatalogue=(entry,version)=>catalogueForGame.has(version)&&entry?.catalogueVersion>catalogueForGame.get(version);
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validRequestId=id=>typeof id==='string'&&uuidPattern.test(id);
export function validDeviceToken(token){
  if(typeof token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(token))return false;
  try{const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/')+'=');return binary.length===32&&btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')===token;}catch{return false;}
}
export async function sha256(value){const bytes=new TextEncoder().encode(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function privateBucket(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function normalizeUsername(value){return typeof value==='string'?value.normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase():'';}
export function parseAction(input){return parseKnownAction(input,allowedTypes);}
function parseKnownAction(input,types){
  if(!input||typeof input!=='object'||Array.isArray(input)||!types.has(input.type))throw new HttpError(400,'invalid_action','Cette action n’est pas disponible.');
  const keys=input.type==='TOGGLE_TASK_CHECK'?['type','roundId','taskId','checked']:input.type==='REFUSE_TASK'?['type','roundId','taskId']:input.type==='JOKER_DRAW'?['type','roundId','category']:['type','roundId'];
  if(Object.keys(input).some(key=>!keys.includes(key))||typeof input.roundId!=='string'||!/^onde-[1-9]\d*$/.test(input.roundId))throw new HttpError(400,'invalid_action','Action invalide.');
  const action={type:input.type,roundId:input.roundId};
  if(input.type==='TOGGLE_TASK_CHECK'){
    if(typeof input.taskId!=='string'||!/^onde-[1-9]\d*$/.test(input.taskId)||typeof input.checked!=='boolean')throw new HttpError(400,'invalid_action','Case invalide.');
    action.taskId=input.taskId;action.checked=input.checked;
  }
  if(input.type==='REFUSE_TASK'){
    if(typeof input.taskId!=='string'||!/^onde-[1-9]\d*$/.test(input.taskId))throw new HttpError(400,'invalid_action','Défi invalide.');
    action.taskId=input.taskId;
  }
  if(input.type==='JOKER_DRAW'){
    if(!Number.isInteger(input.category)||input.category<1||input.category>4)throw new HttpError(400,'invalid_action','Catégorie invalide.');
    action.category=input.category;
  }
  return action;
}
export function assertClientCompatibility(G,full,actor,gameVersion){
  const requiresUpgrade=entry=>requiresNewCatalogue(entry,gameVersion);
  if(full?.version===2){
    if(!supportsParallelGame(gameVersion))throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour utiliser la nouvelle version.');
    if(requiresUpgrade(full.lanes[actor]?.round)||full.tasks.some(requiresUpgrade)||full.pendingRounds.some(lane=>requiresUpgrade(lane.round))){
      throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour jouer avec le nouveau catalogue.');
    }
    return;
  }
  if((requiresUpgrade(full.round)&&G.canSeeRound(full,actor))||full.tasks.some(requiresUpgrade)){
    throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour jouer avec le nouveau catalogue.');
  }
  if(gameVersion!==1)return;
  const visibleRound=full.round.catalogueVersion>=2&&G.canSeeRound(full,actor);
  if(visibleRound||full.tasks.some(task=>task.variantRoll!=null||task.catalogueVersion>=3)){
    throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour utiliser le nouveau parcours.');
  }
}
export function projectState(G,full,actor,gameVersion=2,roundId){
  assertClientCompatibility(G,full,actor,gameVersion);
  if(full?.version===2)full=G.roomView(full,actor,roundId);
  if(!G.validateState(full)||!['a','b'].includes(actor))throw new Error('Invalid authoritative state');
  const projected=copy(full);projected.activePlayer=actor;projected.seen={};projected.favorites=[];
  delete projected.progression;
  if(gameVersion!==8)delete projected.cardRerollWallets;
  projected.history=projected.history.filter(round=>
    (gameVersion>=2||!(round.catalogueVersion>=2)) &&
    !requiresNewCatalogue(round,gameVersion) &&
    G.canSeeRound({round,phase:'resolved',activePlayer:actor},actor)).map(round=>{
    if(round.from!==actor){delete round.hand;delete round.draftRollTokens;delete round.rollTokens;}
    return round;
  });
  if(!G.canSeeRound(full,actor)){
    projected.phase='category';projected.round=copy(G.createState().round);
    Object.assign(projected.round,{id:full.round.id,from:full.round.from,to:full.round.to});
  }else if(full.round.from!==actor&&projected.round.cardId){
    const deck=G.cardsForRound(projected.round);
    const sides=G.cardSides(projected),selected=projected.round.cardId,decoys=deck.filter(c=>c.categoryId===projected.round.categoryId&&c.id!==selected).slice(0,sides-1).map(c=>c.id);
    let n=0;projected.round.hand=Array.from({length:sides},(_,i)=>i===projected.round.cardRoll-1?selected:decoys[n++]);
  }
  if(!G.validateState(projected))throw new Error('Invalid projected state');
  return projected;
}
export function snapshot(G,context,extra={},gameVersion=2){
  const full=context.room.state,actor=context.member.actor;
  assertClientCompatibility(G,full,actor,gameVersion);
  const badges=G.badgeView(full,actor,{legacy:gameVersion<8});
  if(full?.version===2){
    if(!G.validateRoom(full))throw new Error('Invalid authoritative room');
    const own=G.roomView(full,actor);
    const invitations=full.pendingRounds.map(item=>G.roomView(full,actor,item.round.id)).filter(value=>value?.phase==='pending'&&G.canSeeRound(value,actor));
    const incoming=invitations.filter(value=>value.round.from!==actor).map(value=>projectState(G,value,actor,gameVersion));
    const pendingOutgoing=invitations.filter(value=>value.round.from===actor).length;
    return {roomId:context.room.id,state:projectState(G,own,actor,gameVersion),badges,activity:G.activityCalendar(full,actor),incoming,pendingOutgoing,gameVersion,revision:Number(context.room.revision),actor,paired:context.paired===true,drawAvailable:own.phase==='category',quota:copy(context.quota),...extra};
  }
  return {roomId:context.room.id,state:projectState(G,full,actor,gameVersion),badges,revision:Number(context.room.revision),actor,paired:context.paired===true,drawAvailable:full.phase==='category',quota:copy(context.quota),...extra};
}
export function applyAction(G,full,actor,input,requestId,at,randomInt=G.randomInt,gameVersion=1){
  if(gameVersion===3||gameVersion===4||gameVersion===5)throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour utiliser la nouvelle version.');
  if(!supportsParallelGame(gameVersion))return applyLegacyAction(G,full,actor,input,requestId,at,randomInt,gameVersion);
  const action=parseAction(input);
  if(!validRequestId(requestId))throw new HttpError(400,'invalid_request_id','Identifiant de requête invalide.');
  const room=G.normalizeRoom(full,{at});
  if(!room)throw new Error('Invalid authoritative room');
  assertClientCompatibility(G,room,actor,gameVersion);
  const target=['TOGGLE_TASK_CHECK','REFUSE_TASK'].includes(action.type)?G.roomView(room,actor):G.roomView(room,actor,action.roundId);
  if(!target)throw new HttpError(409,'stale_round','Le tour a changé.');
  const owns=target.round.from===actor;
  const catalogueVersion=catalogueForGame.get(gameVersion);
  let roll;
  if(action.type==='SEND')action.directQueue=true;
  if(action.type==='REFUSE_TASK'){
    if(action.roundId!==target.round.id)throw new HttpError(409,'stale_round','Le tour a changé.');
    const task=room.tasks.find(item=>item.id===action.taskId);
    if(!task||task.to!==actor||Date.parse(task.expiresAt)<=Date.parse(at))throw new HttpError(409,'invalid_phase','Ce défi n’est plus disponible.');
    const value=randomInt(20);
    if(!Number.isInteger(value)||value<1||value>20)throw new Error('Invalid authoritative random outcome');
    action.value=value;action.token='request:'+requestId;roll={kind:20,value};
  }else if(action.type==='ROLL_CATEGORY'){
    if(!owns||target.phase!=='category')throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.categorySides(catalogueVersion),value=G.rollCategory(catalogueVersion,randomInt,at);
    Object.assign(action,{value},G.drawCategory(target,value,catalogueVersion,randomInt));roll={kind:sides,value};
  }else if(action.type==='ROLL_CARD'){
    if(!owns||target.phase!=='card')throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.cardSides(target),value=randomInt(sides);action.value=value;roll={kind:sides,value};
  }else if(action.type==='ROLL_VARIANT'){
    if(!owns||target.phase!=='variant'||!G.needsVariant(target.round))throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.rules.variantSides,value=randomInt(sides);action.value=value;roll={kind:sides,value};
  }else if(action.type==='REROLL_CARD'){
    if(!G.canRerollCard(target,at))throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.cardSides(target),alternatives=Array.from({length:sides},(_,i)=>i+1).filter(value=>value!==target.round.cardRoll),rank=randomInt(alternatives.length);
    if(!Number.isInteger(rank)||rank<1||rank>alternatives.length)throw new Error('Invalid authoritative random outcome');
    action.value=alternatives[rank-1];roll={kind:sides,value:action.value};
  }
  else if(action.type==='REROLL_CATEGORY'){
    if(!owns||target.phase!=='card')throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.categorySides(catalogueVersion),value=G.rollCategory(catalogueVersion,randomInt,at);
    Object.assign(action,{value},G.drawCategory(target,value,catalogueVersion,randomInt));
    roll={kind:sides,value};
  }
  else if(action.type==='JOKER_DRAW'){
    if(!owns||target.phase!=='category')throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const value=action.category;
    Object.assign(action,{value},G.drawCategory(target,value,catalogueVersion,randomInt));
    roll={kind:G.categorySides(catalogueVersion),value};
  }
  const next=G.reduceRoom(room,{...action,actor,at});
  if(next===room)throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
  if(!G.validateRoom(next))throw new Error('Core returned an invalid room');
  const queued=action.type==='SEND'?next.tasks.find(task=>task.id===target.round.id):null;
  const notification=queued?{actor:queued.to,kind:'invitation',roundId:queued.id}:null;
  return {state:next,roll,notification,consumeTicket:['ROLL_CATEGORY','JOKER_DRAW'].includes(action.type)};
}
function applyLegacyAction(G,full,actor,input,requestId,at,randomInt=G.randomInt,gameVersion=1){
  const action=parseKnownAction(input,legacyTypes);
  if(!validRequestId(requestId))throw new HttpError(400,'invalid_request_id','Identifiant de requête invalide.');
  if(action.type!=='TOGGLE_TASK_CHECK'&&action.roundId!==full.round.id)throw new HttpError(409,'stale_round','Le tour a changé.');
  if(action.type==='NEW_ROUND'&&!['accepted','resolved'].includes(full.phase))throw new HttpError(409,'invalid_phase','Le tour est déjà en cours.');
  const state=copy(full);state.activePlayer=actor;
  if(!G.validateState(state))throw new Error('Invalid authoritative state');
  assertClientCompatibility(G,state,actor,gameVersion);
  let roll;
  if(action.type==='ROLL_CATEGORY'){
    const sides=G.categorySides(gameVersion),value=G.rollCategory(gameVersion,randomInt);
    action.value=value;action.hand=G.drawHand(state,value,gameVersion);
    if(gameVersion===2)action.catalogueVersion=2;
    roll={kind:sides,value};
  }
  else if(action.type==='ROLL_CARD'){const sides=G.cardSides(state),value=randomInt(sides);action.value=value;roll={kind:sides,value};}
  else if(action.type==='ROLL_VARIANT'){
    if(gameVersion!==2)throw new HttpError(409,'upgrade_required','Rouvre D6 à deux pour utiliser le nouveau parcours.');
    if(state.phase!=='variant'||state.round.from!==actor)throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.rules.variantSides,value=randomInt(sides);action.value=value;roll={kind:sides,value};
  }
  else if(action.type==='REROLL_CARD'){
    if(!G.canRerollCard(state))throw new HttpError(409,'invalid_phase','Cette action n’est plus disponible.');
    const sides=G.cardSides(state),alternatives=Array.from({length:sides},(_,i)=>i+1).filter(value=>value!==state.round.cardRoll),index=randomInt(alternatives.length);
    if(!Number.isInteger(index)||index<1||index>alternatives.length)throw new Error('Invalid authoritative random outcome');
    const value=alternatives[index-1];action.value=value;roll={kind:sides,value};
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
