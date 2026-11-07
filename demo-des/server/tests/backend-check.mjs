import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHandler} from '../functions/desir-game/server.mjs';
import {projectState,validDeviceToken,sha256,privateBucket,applyAction,parseAction,snapshot,HttpError,normalizeUsername} from '../functions/desir-game/model.mjs';
const require=createRequire(import.meta.url),G=require('../../dev/src/onde-app-core.js');
const clone=x=>structuredClone(x),at='2026-11-02T15:00:00.000Z',roomId='9ee847bf-5462-4dd8-958c-f77a21356f81';
const tokenA=Buffer.alloc(32,1).toString('base64url'),tokenB=Buffer.alloc(32,2).toString('base64url');
let checks=0;const equal=(a,b,msg)=>{checks++;assert.deepEqual(a,b,msg);};const ok=(v,msg)=>{checks++;assert.ok(v,msg);};
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function act(s,type,props={}){const next=G.reduce(s,{type,at,...props});assert.ok(G.validateState(next));return next;}
function draft(from='a',cardRoll=1,sides=4,categoryId='complicite'){
 let s=G.createState();if(from==='b')s=act(s,'SWITCH_PLAYER',{player:'b'});
 const hand=G.legacyCards.filter(c=>c.categoryId===categoryId).slice(-sides).map(c=>c.id);
 s=act(s,'ROLL_CATEGORY',{value:G.legacyCategories.find(category=>category.id===categoryId).number,hand:hand.slice(0,4)});
 if(sides===6)s.round.hand=hand;
 return act(s,'ROLL_CARD',{value:cardRoll});
}
for(const sides of [4,6])for(const from of ['a','b']){
 const to=G.otherPlayer(from),s=draft(from,sides,sides),p=projectState(G,s,to);
 ok(G.validateState(p),'private projection remains core-valid');
 equal(p.phase,'category');equal(p.round.categoryId,null);equal(p.round.cardId,null);equal(p.round.hp,null);equal(p.round.hand,[]);equal(p.seen,{});equal(p.round.from,from);
 ok(!JSON.stringify(p).includes(s.round.cardId),'private card ID is never delivered');
 const publicState=act(s,'SEND'),published=projectState(G,publicState,to);
 ok(G.validateState(published));equal(published.round.cardId,s.round.cardId);equal(published.round.hand[published.round.cardRoll-1],s.round.cardId);
 ok(published.round.hand.filter(id=>id!==s.round.cardId).every(id=>!s.round.hand.includes(id)),'unselected hand IDs are replaced, never delivered');
 const changedHand=clone(publicState);const alternatives=G.legacyCards.filter(c=>c.categoryId===changedHand.round.categoryId&&c.id!==changedHand.round.cardId).slice(0,sides-1).map(c=>c.id);let k=0;changedHand.round.hand=Array.from({length:sides},(_,i)=>i===changedHand.round.cardRoll-1?changedHand.round.cardId:alternatives[k++]);
 ok(G.validateState(changedHand));equal(projectState(G,changedHand,to),published,'changing unrevealed IDs cannot change the recipient projection');
 const own=projectState(G,s,from);equal(own.phase,'draft');equal(own.round.cardId,s.round.cardId);equal(own.history,[]);
 const hidden=projectState(G,s,to);equal(hidden.phase,'category');equal(hidden.round.cardId,null);equal(hidden.round.hand,[]);equal(hidden.history,[]);
 equal(s,clone(s),'projection is pure');
}
equal(normalizeUsername(' ÉLÈVE '),'eleve','accented account alias');equal(normalizeUsername('A\u0301LPHA'),'alpha','decomposed accent alias');
equal(validDeviceToken(tokenA),true);equal(validDeviceToken('short'),false);equal(validDeviceToken('a'.repeat(43)),false,'noncanonical base64 discarded');
equal((await sha256('device:'+tokenA)).length,64);ok(!(await privateBucket('test-secret','192.0.2.1')).includes('192.0.2.1'));
for(const type of ['ROLL_CATEGORY','REROLL_CARD','ROLL_VARIANT'])for(const forbidden of ['actor','value','hand','at','token','player','gameVersion','catalogueVersion','variantRoll','__proto__']){
 const action=JSON.parse(JSON.stringify({type,roundId:'onde-1'}));Object.defineProperty(action,forbidden,{value:1,enumerable:true});
 checks++;assert.throws(()=>parseAction(action),HttpError,'reject client '+type+' '+forbidden);
}
equal(parseAction({type:'REROLL_CARD',roundId:'onde-1'}),{type:'REROLL_CARD',roundId:'onde-1'});
// An idle round is claimable by either actor; a hidden draw is not a new turn.
for(const version of [1,2]){
 const initial=G.createState(),context=actor=>({room:{id:roomId,state:initial,revision:0},member:{actor},paired:true,quota:{remaining:1}});
 for(const actor of ['a','b']){
  const view=snapshot(G,context(actor),{},version);
  equal(view.drawAvailable,true);equal(view.state.phase,'category');
  ok(G.canSeeRound(view.state,actor),'both players can see a genuinely idle round');
 }
 const claimed=applyAction(G,initial,'b',{type:'ROLL_CATEGORY',roundId:'onde-1'},uuid(401+version),at,()=>1,version);
 equal(claimed.state.round.from,'b');equal(claimed.state.round.to,'a');equal(claimed.state.activePlayer,'b');equal(claimed.state.phase,'card');equal(claimed.consumeTicket,true);
 equal(initial.round.from,'a','claiming a draw never mutates its source');
 for(const actor of ['a','b']){
  const view=snapshot(G,{...context(actor),room:{...context(actor).room,state:claimed.state}}, {},version);
  equal(view.drawAvailable,false,'actual authoritative phase governs draw availability');
  if(actor==='a'){equal(view.state.phase,'category');equal(view.state.round.hand,[]);}
 }
}
// Exercise each integer ticket, including both ends of every face interval.
const categoryDraws=new Map(),categoryCounts={complicite:0,attention:0,projets:0,intimite:0};
for(let ticket=1;ticket<=42;ticket++){
 const randomCalls=[],drawn=applyAction(G,G.createState(),'a',{type:'ROLL_CATEGORY',roundId:'onde-1'},uuid(30+ticket),at,n=>{randomCalls.push(n);return ticket;},2);
 const expectedFace=ticket<=11?1:ticket<=21?2:ticket<=31?3:4;
 const category=G.categories[expectedFace-1];
 equal(randomCalls,[42],'weighted D4 draws one uniform ticket');equal(drawn.roll,{kind:4,value:expectedFace});
 equal(drawn.state.round.categoryId,category.id);categoryCounts[category.id]++;
 categoryDraws.set(category.id,drawn);
}
equal(categoryCounts,{complicite:11,attention:10,projets:10,intimite:11},'Complicité and Intimité each receive 10% more tickets');
for(const category of G.legacyCategories){
 const legacy=applyAction(G,G.createState(),'a',{type:'ROLL_CATEGORY',roundId:'onde-1'},uuid(80+category.number),at,n=>{equal(n,6);return category.number;});
 equal(legacy.roll,{kind:6,value:category.number});equal(legacy.state.round.categoryId,category.id);
}
for(const category of G.categories){
 const drawn=categoryDraws.get(category.id);
 equal(drawn.state.round.catalogueVersion,2);equal(drawn.state.round.hand.length,6);equal(drawn.consumeTicket,true);
 equal([...drawn.state.round.hand].sort(),G.cards.filter(c=>c.categoryId===category.id).map(c=>c.id).sort(),'all six canonical challenges are in the hand');
 for(const cardRoll of [1,2,3,4,5,6]){
  const rolled=applyAction(G,drawn.state,'a',{type:'ROLL_CARD',roundId:'onde-1'},uuid(40+cardRoll),at,sides=>{equal(sides,6);return cardRoll;},2);
  equal(rolled.roll,{kind:6,value:cardRoll});equal(rolled.state.round.cardId,drawn.state.round.hand[cardRoll-1]);equal(rolled.state.phase,'variant');equal(rolled.consumeTicket,false);
  for(const version of [1,2]){const privateView=projectState(G,rolled.state,'b',version);equal(privateView.round.hand,[]);equal(privateView.round.variantRoll,undefined);equal(privateView.phase,'category');}
  for(const variantRoll of [1,2,3,4,5,6]){
   const variant=applyAction(G,rolled.state,'a',{type:'ROLL_VARIANT',roundId:'onde-1'},uuid(60+variantRoll),at,sides=>{equal(sides,6);return variantRoll;},2);
   equal(variant.roll,{kind:6,value:variantRoll});equal(variant.state.round.variantRoll,variantRoll);equal(variant.state.phase,'draft');equal(variant.consumeTicket,false);ok(G.getVariant(variant.state.round));equal(variant.notification,null);
  }
 }
}
for(const sides of [4,6]){
 const saved=draft('a',1,sides);saved.phase='card';Object.assign(saved.round,{cardId:null,cardRoll:null,hp:null,status:'drawing'});
 const rolled=applyAction(G,saved,'a',{type:'ROLL_CARD',roundId:'onde-1'},uuid(45+sides),at,n=>{equal(n,sides,'saved hand determines the actual challenge die');return sides;});
 equal(rolled.roll,{kind:sides,value:sides});equal(rolled.state.round.cardId,saved.round.hand[sides-1]);
}
for(const sides of [4,6])for(const from of ['a','b'])for(const oldFace of Array.from({length:sides},(_,i)=>i+1)){
 const source=draft(from,oldFace,sides),before=clone(source),to=G.otherPlayer(from),faces=[],alternatives=Array.from({length:sides},(_,i)=>i+1).filter(face=>face!==oldFace);
 for(const rank of Array.from({length:sides-1},(_,i)=>i+1)){
  const randomCalls=[],result=applyAction(G,source,from,{type:'REROLL_CARD',roundId:source.round.id},uuid(100+oldFace*3+rank),at,sides=>{randomCalls.push(sides);return rank;});
  equal(randomCalls,[sides-1],'reroll uses one uniform choice among the remaining indices');faces.push(result.roll.value);
  equal(result.roll,{kind:sides,value:alternatives[rank-1]});ok(result.state.round.cardId!==source.round.cardId,'reroll always changes the card');
  equal(result.state.round.cardRerolled,true);equal(result.consumeTicket,false);equal(result.notification,null);equal(result.state.stats,source.stats,'reroll grants no points');equal(source,before,'server action does not mutate its source');
  equal(G.canRerollCard(result.state),false);ok(!Object.hasOwn(result.state.round,'previousCardId'),'old card is not stored as previousCardId');
  const hidden=projectState(G,result.state,to);equal(hidden.round.cardId,null);equal(hidden.round.hand,[]);equal(hidden.round.cardRerolled,false,'recipient learns nothing about private reroll');equal(hidden.seen,{});
  const sent=applyAction(G,result.state,from,{type:'SEND',roundId:source.round.id},uuid(200+rank),at).state;
  const accepted=applyAction(G,sent,to,{type:'ACCEPT',roundId:source.round.id},uuid(220+rank),at);
  equal(accepted.state.phase,'accepted','the recipient accepts directly');equal(accepted.consumeTicket,false);
  equal(accepted.state.tasks.length,1);equal(accepted.state.tasks[0].cardId,result.state.round.cardId);equal(accepted.state.tasks[0].id,source.round.id);
  for(const blocked of [result.state,act(source,'SEND')]){
   let called=false;checks++;assert.throws(()=>applyAction(G,blocked,from,{type:'REROLL_CARD',roundId:blocked.round.id},uuid(230+rank),at,()=>{called=true;return 1;}),error=>error instanceof HttpError&&error.status===409);
   equal(called,false,'invalid reroll is rejected before RNG');
  }
 }
 equal(faces,alternatives,'every other face has one uniform mapping');
 let wrongRoleRng=false;checks++;assert.throws(()=>applyAction(G,source,to,{type:'REROLL_CARD',roundId:source.round.id},uuid(250),at,()=>{wrongRoleRng=true;return 1;}),error=>error instanceof HttpError&&error.status===409);equal(wrongRoleRng,false);
}
class MemoryStore{
 constructor(){this.state=G.createState();this.revision=0;this.members=new Map();this.receipts=new Map();this.used=new Set();this.calls=[];this.outbox=[];this.forceRace=false;this.blockRates=false;this.loginChecks=0;}
 quota(actor){return {remaining:this.used.has(actor)?0:1,window:'2026-11-02T12:00',label:'12 h – 18 h',nextAt:'2026-11-02T17:00:00.000Z'};}
 async rpc(name,args){
  this.calls.push({name,args:clone(args)});
  if(name==='desir_rate_limit')return !this.blockRates;
  if(name==='desir_cleanup')return null;
  if(name==='desir_login'){
   this.loginChecks++;const actor=args.p_login==='alpha'?'a':args.p_login==='bravo'?'b':null;if(!actor||args.p_password!=='test-only-password')return null;
   const exists=this.members.get(args.p_token_hash);if(exists&&exists.actor!==actor)return {error:'session_conflict'};
   this.members.set(args.p_token_hash,{token_hash:args.p_token_hash,room_id:roomId,actor});return {roomId,actor};
  }
  if(name==='desir_get_session'){
   const member=this.members.get(args.p_token_hash);if(!member)return null;
   return {room:{id:roomId,state:clone(this.state),revision:this.revision},member:clone(member),paired:true,quota:this.quota(member.actor)};
  }
  if(name==='desir_get_request'){
   const old=this.receipts.get(args.p_actor+args.p_request_id);return old?(old.hash===args.p_payload_hash?{kind:'replayed',response:clone(old.response)}:{kind:'mismatch'}):{kind:'missing'};
  }
  if(name==='desir_expire_room'){
   if(args.p_expected_revision!==this.revision)return false;this.state=clone(args.p_next_state);this.revision++;return true;
  }
  if(name==='desir_commit'){
   const key=args.p_actor+args.p_request_id,old=this.receipts.get(key);
   if(old)return old.hash===args.p_payload_hash?{kind:'replayed',response:clone(old.response)}:{kind:'mismatch'};
   if(this.forceRace){this.forceRace=false;this.revision++;return {kind:'conflict'};}
   if(args.p_expected_revision!==this.revision)return {kind:'conflict'};
   if(args.p_consume_ticket&&this.used.has(args.p_actor))return {kind:'quota_exhausted'};
   if(args.p_consume_ticket)this.used.add(args.p_actor);
   this.state=clone(args.p_next_state);this.revision++;
   const response={...clone(args.p_response),revision:this.revision,quota:this.quota(args.p_actor)};
   this.receipts.set(key,{hash:args.p_payload_hash,response});if(args.p_notification)this.outbox.push(clone(args.p_notification));
   return {kind:'applied',response};
  }
  throw Error('Unexpected RPC '+name);
 }
}
// All new network traffic uses the independently projected parallel room.
async function authorize(store){
 for(const [actor,token] of [['a',tokenA],['b',tokenB]]){
  const token_hash=await sha256('device:'+token);store.members.set(token_hash,{token_hash,room_id:roomId,actor});
 }
}
function client(handler){
 return async(body,token=tokenA,extra={})=>{
  const response=await handler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://cgiy.github.io',...extra},body:JSON.stringify({gameVersion:3,...body})}));
  return {status:response.status,body:await response.json(),headers:response.headers};
 };
}
const intent=(type,id,roundId='onde-1',extra={})=>({op:'action',requestId:uuid(id),action:{type,roundId,...extra}});
const view=(store,actor,roundId)=>G.roomView(store.state,actor,roundId);

// Outdated clients receive a safe upgrade before migration or any game mutation.
{
 const saved=new MemoryStore();await authorize(saved);
 const handler=createHandler({G,store:saved,rateSecret:'fixture',clock:()=>new Date(at)}),deliver=client(handler);
 for(const gameVersion of [1,2])for(const op of ['login','state','action']){
  const before=clone(saved.state),revision=saved.revision;
  const response=await deliver({op,gameVersion,username:'alpha',password:'test-only-password',requestId:uuid(600),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});
  equal(response.status,409);equal(response.body.error.code,'upgrade_required');equal(response.body.state,undefined);equal(saved.state,before);equal(saved.revision,revision);equal(saved.used.size,0);
 }
 equal((await deliver({op:'state',gameVersion:'3'})).status,400);
}

// A published legacy hand, score, D4 and quota survive migration into its owner lane.
{
 const legacy=new MemoryStore(),saved=draft('a',1,4,'detente'),hand=clone(saved.round.hand);
 saved.phase='card';Object.assign(saved.round,{cardId:null,cardRoll:null,hp:null,status:'drawing'});delete saved.round.cardRerolled;
 saved.stats={totalCompleted:21,byCategory:{complicite:1,detente:2,projets:3,attention:4,bouffe:5,intimite:6}};legacy.state=saved;legacy.used.add('a');await authorize(legacy);
 const rng=[],handler=createHandler({G:{...G,randomInt:n=>{rng.push(n);return n;}},store:legacy,rateSecret:'fixture',clock:()=>new Date(at)}),deliver=client(handler);
 const own=await deliver({op:'state'});equal(own.status,200);equal(legacy.state.version,2);equal(own.body.gameVersion,3);equal(own.body.state.round.hand,hand);equal(own.body.state.stats,saved.stats);equal(own.body.state.round.categoryId,'detente');equal(own.body.state.round.categoryRoll,2);equal(own.body.quota.remaining,0);equal(rng,[]);equal(legacy.revision,1);
 const other=await deliver({op:'state'},tokenB);equal(other.status,200);equal(other.body.state.phase,'category');equal(other.body.state.round.from,'b');equal(other.body.incoming,[]);equal(other.body.drawAvailable,true);equal(other.body.quota.remaining,1);equal(legacy.revision,1);
 const rolled=await deliver(intent('ROLL_CARD',601));equal(rolled.status,200);equal(rolled.body.roll,{kind:4,value:4});equal(rolled.body.state.round.cardId,hand[3]);equal(rng,[4]);equal(legacy.used.size,1);
 const sent=await deliver(intent('SEND',602));equal(sent.status,200);equal(legacy.outbox,[{actor:'b',kind:'invitation',roundId:'onde-1'}]);
 const invited=await deliver({op:'state'},tokenB);equal(invited.body.state.phase,'category');equal(invited.body.incoming.length,1);equal(invited.body.incoming[0].round.cardId,hand[3]);equal(invited.body.incoming[0].round.hand.length,4);ok(G.validateState(invited.body.incoming[0]));equal(invited.body.state.stats.totalCompleted,21);
}

// Old private defended history remains private after one idempotent migration.
{
 const legacy=new MemoryStore();legacy.state=draft();
 legacy.state.phase='resolved';Object.assign(legacy.state.round,{status:'defended',awaiting:null,closedBy:'a',endedAt:at,draftChallengeUsed:true,draftRolls:[20,20],draftRollTokens:['old1','old2']});
 legacy.state.history=[clone(legacy.state.round)];
 const oldCard=legacy.state.round.cardId;delete legacy.state.round.cardRerolled;for(const past of legacy.state.history)delete past.cardRerolled;await authorize(legacy);
 const deliver=client(createHandler({G,store:legacy,rateSecret:'fixture',clock:()=>new Date(at)}));
 const response=await deliver({op:'state'},tokenB);equal(response.status,200);equal(response.body.incoming,[]);equal(response.body.state.history,[]);ok(!JSON.stringify(response.body).includes(oldCard));ok(G.validateRoom(legacy.state));equal(legacy.revision,1);await deliver({op:'state'},tokenB);equal(legacy.revision,1);
}

// Both players can start their own draw concurrently. CAS retains both results.
for(const firstActor of ['a','b']){
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);
 const deliver=client(createHandler({G:{...G,randomInt:()=>1},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const claim=actor=>deliver(intent('ROLL_CATEGORY',actor==='a'?610:611,view(store,actor).round.id),actor==='a'?tokenA:tokenB);
 const results=await Promise.all([claim(firstActor),claim(G.otherPlayer(firstActor))]);equal(results.map(x=>x.status),[200,200]);equal(store.state.lanes.a.phase,'card');equal(store.state.lanes.b.phase,'card');equal(store.used.size,2);equal(store.receipts.size,2);equal(store.revision,2);
 for(const [index,actor] of [firstActor,G.otherPlayer(firstActor)].entries()){
  equal(results[index].body.state.round.from,actor);equal(results[index].body.incoming,[]);equal(results[index].body.quota.remaining,0);equal(results[index].body.drawAvailable,false);
  const replay=await claim(actor);equal(replay.status,200);equal(replay.body,results[index].body);equal(store.revision,2);
 }
}

// Same-actor simultaneous deliveries return one committed receipt and one ticket.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);let draws=0;
 const deliver=client(createHandler({G:{...G,randomInt:()=>++draws===1?1:42},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const action=intent('ROLL_CATEGORY',620),results=await Promise.all([deliver(action),deliver(action)]);
 equal(results.map(x=>x.status),[200,200]);equal(results[0].body,results[1].body);equal(store.used.size,1);equal(store.receipts.size,1);equal(store.revision,1);equal(store.state.lanes.b.phase,'category');
}

// Legacy reroll receipts still commit once through the new parallel protocol.
for(const sides of [4,6]){
 const store=new MemoryStore();store.state=draft('a',2,sides);store.used.add('a');await authorize(store);let draws=0;
 const deliver=client(createHandler({G:{...G,randomInt:n=>{equal(n,sides-1);return ++draws===1?1:sides-1;}},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 await deliver({op:'state'});const before=store.revision,action=intent('REROLL_CARD',630+sides);
 const results=await Promise.all([deliver(action),deliver(action)]);equal(results.map(x=>x.status),[200,200]);equal(results[0].body,results[1].body);equal(store.receipts.size,1);equal(store.revision,before+1);equal(view(store,'a').round.cardRoll,results[0].body.roll.value);equal(store.used.size,1);equal(store.outbox,[]);
}

// Draws stay private until send; replies preserve both active lanes and queued tasks.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);const rng=[];let category=0;
 const deliver=client(createHandler({G:{...G,randomInt:n=>{rng.push(n);return n===42?(++category===1?1:42):n===20?1:2;}},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const aId=view(store,'a').round.id,bId=view(store,'b').round.id;
 for(const [actor,token,id,offset] of [['a',tokenA,aId,640],['b',tokenB,bId,650]]){
  equal((await deliver(intent('ROLL_CATEGORY',offset,id),token)).status,200);
  equal((await deliver(intent('ROLL_CARD',offset+1,id),token)).status,200);
  equal((await deliver(intent('ROLL_VARIANT',offset+2,id),token)).status,200);
  equal(view(store,actor).phase,'draft');
  const partner=await deliver({op:'state'},actor==='a'?tokenB:tokenA);equal(partner.body.incoming,[]);ok(!JSON.stringify(partner.body).includes(view(store,actor).round.cardId));
 }
 const aBefore=clone(store.state.lanes.a),bBefore=clone(store.state.lanes.b),oldRng=rng.length;
 const forbidden=await deliver(intent('ROLL_VARIANT',660,aId),tokenB);equal(forbidden.status,409);equal(forbidden.body.state.round.id,bId);equal(forbidden.body.incoming,[]);equal(rng.length,oldRng);equal(store.state.lanes.a,aBefore);equal(store.state.lanes.b,bBefore);
 equal((await deliver(intent('SEND',661,aId))).status,200);equal(store.outbox,[{actor:'b',kind:'invitation',roundId:aId}]);
 equal(store.state.lanes.a.phase,'category');ok(store.state.lanes.a.round.id!==aId);
 const invited=await deliver({op:'state'},tokenB);equal(invited.body.state.round.id,bId);equal(invited.body.state.phase,'draft');equal(invited.body.incoming.length,1);equal(invited.body.incoming[0].round.id,aId);equal(invited.body.incoming[0].round.variantRoll,2);
 const altered=clone(store.state),queued=altered.pendingRounds.find(item=>item.round.id===aId).round,others=queued.hand.filter(id=>id!==queued.cardId).reverse();others.splice(queued.cardRoll-1,0,queued.cardId);queued.hand=others;
 equal(projectState(G,altered,'b',3,aId),invited.body.incoming[0],'private permutation never leaks to receiver');
 const sentAgain=await deliver(intent('SEND',661,aId));equal(sentAgain.status,200);equal(store.outbox.length,1);
 const aSent=clone(store.state.lanes.a);
 const refusedChallenge=await deliver(intent('CHALLENGE',662,aId),tokenB);equal(refusedChallenge.status,400,'the recipient D20 no longer exists');equal(refusedChallenge.body.error.code,'invalid_action');equal(store.state.lanes.a,aSent);equal(store.state.lanes.b,bBefore);
 const accepted=await deliver(intent('ACCEPT',664,aId),tokenB);equal(accepted.status,200);equal(accepted.body.incoming,[]);equal(accepted.body.state.round.id,bId);equal(accepted.body.state.tasks.length,1);equal(accepted.body.state.tasks[0].id,aId);
 const checkA=intent('TOGGLE_TASK_CHECK',665,aId,{taskId:aId,checked:true}),checkB=intent('TOGGLE_TASK_CHECK',666,bId,{taskId:aId,checked:true});
 const checked=await Promise.all([deliver(checkA),deliver(checkB,tokenB)]);equal(checked.map(x=>x.status),[200,200]);equal(store.state.stats.totalCompleted,1);equal(store.state.tasks.length,0);equal(store.state.lanes.a.phase,'category');equal(store.state.lanes.b,bBefore);
 equal((await deliver(checkB,tokenB)).status,200);equal(store.state.stats.totalCompleted,1);
 const next=await deliver({op:'state'},tokenA);equal(next.status,200);equal(next.body.state.round.from,'a');equal(next.body.state.phase,'category');ok(next.body.state.round.id!==aId);equal(next.body.quota.remaining,0);
 const exhausted=await deliver(intent('ROLL_CATEGORY',668,next.body.state.round.id));equal(exhausted.status,409);equal(exhausted.body.error.code,'quota_exhausted');equal(store.state.lanes.b,bBefore);
 equal((await deliver(intent('SEND',669,bId),tokenB)).status,200);equal(store.outbox.at(-1),{actor:'a',kind:'invitation',roundId:bId});
}

// Accepting or passing removes a queued invitation without blocking another draw.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);
 const deliver=client(createHandler({G:{...G,randomInt:()=>1},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const id=view(store,'a').round.id,untouched=clone(store.state.lanes.b);let requestId=680;
 for(const type of ['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT'])equal((await deliver(intent(type,requestId++,id))).status,200);
 equal((await deliver(intent('PASS',requestId++,id))).status,409,'the sender cannot pass a private draft');
 equal((await deliver(intent('ACCEPT',requestId++,id))).status,409,'the sender cannot accept their own draft');
 equal(store.outbox,[]);equal(store.used.size,1);
 equal((await deliver(intent('SEND',requestId++,id))).status,200);
 equal(store.state.lanes.a.phase,'category');equal(store.state.lanes.b,untouched);equal(store.state.pendingRounds[0].round.id,id);equal(store.outbox,[{actor:'b',kind:'invitation',roundId:id}]);
 const invited=await deliver({op:'state'},tokenB);equal(invited.body.drawAvailable,true);equal(invited.body.incoming[0].phase,'pending');
 equal((await deliver(intent('PASS',requestId++,id))).status,409,'the sender cannot pass their own invitation');
 const passed=await deliver(intent('PASS',requestId++,id),tokenB);equal(passed.status,200);
 equal(passed.body.incoming,[]);equal(store.state.pendingRounds.length,0);equal(store.state.history.find(round=>round.id===id).status,'passed');
 equal(store.state.stats.totalCompleted,0);equal(store.state.tasks.length,0);equal(store.outbox.length,2,'passing notifies the sender once');equal(store.outbox.at(-1),{actor:'a',kind:'confirmation',roundId:id});
 equal((await deliver(intent('PASS',requestId++,id),tokenB)).status,409,'a passed round is closed');
 const reopened=await deliver({op:'state'},tokenA);equal(reopened.status,200);equal(reopened.body.state.phase,'category');ok(reopened.body.state.round.id!==id);
 const bId=view(store,'b').round.id;
 for(const type of ['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT','SEND'])equal((await deliver(intent(type,requestId++,bId),tokenB)).status,200);
 equal(store.outbox.at(-1),{actor:'a',kind:'invitation',roundId:bId});
 const accepted=await deliver(intent('ACCEPT',requestId++,bId),tokenA);equal(accepted.status,200);
 equal(store.outbox.at(-1),{actor:'b',kind:'confirmation',roundId:bId},'accepting notifies the sender');
 equal(accepted.body.incoming,[]);equal(accepted.body.state.tasks.length,1);equal(accepted.body.state.tasks[0].id,bId);
 equal(accepted.body.state.phase,'category','the accepter keeps their own active lane');equal(store.used.size,2);
}

// Weekly joker: a chosen category once per week, still consuming the day's draw pool.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);
 const deliver=client(createHandler({G:{...G,randomInt:()=>1},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const id=view(store,'a').round.id;
 const bad=await deliver(intent('JOKER_DRAW',690,id,{category:9}),tokenA);equal(bad.status,400);equal(bad.body.error.code,'invalid_action');
 const joker=await deliver(intent('JOKER_DRAW',691,id,{category:3}),tokenA);equal(joker.status,200);
 equal(joker.body.roll,{kind:4,value:3});equal(joker.body.state.round.categoryId,'projets');equal(joker.body.state.phase,'card');equal(store.used.size,1,'the joker consumes one draw');
 const again=await deliver(intent('JOKER_DRAW',692,id,{category:1}),tokenA);equal(again.status,409,'the joker needs a fresh category phase');
}

// Shared expiry removes due tasks and keeps the free lanes available.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);let now=at;
 const deliver=client(createHandler({G:{...G,randomInt:()=>1},store,rateSecret:'fixture',clock:()=>new Date(now)}));
 let idCounter=700;
 for(const [actor,token,otherToken] of [['a',tokenA,tokenB],['b',tokenB,tokenA]]){
  const id=view(store,actor).round.id;
  for(const type of ['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT','SEND'])equal((await deliver(intent(type,idCounter++,id),token)).status,200);
  equal((await deliver(intent('ACCEPT',idCounter++,id),otherToken)).status,200);
 }
 const taskIds=store.state.tasks.map(task=>task.id);equal(store.state.tasks.length,2);now='2026-11-03T15:00:00.000Z';const expired=await deliver({op:'state'});equal(expired.status,200);equal(expired.body.state.tasks,[]);equal(store.state.lanes.a.phase,'category');equal(store.state.lanes.b.phase,'category');equal(taskIds.every(id=>store.state.history.some(round=>round.id===id&&round.status==='expired')),true);equal(store.state.stats.totalCompleted,0);
 const late=await deliver(intent('TOGGLE_TASK_CHECK',idCounter++,view(store,'a').round.id,{taskId:taskIds[0],checked:true}),tokenB);equal(late.status,409);equal(store.state.stats.totalCompleted,0);
}

// Identity, CORS, limits, authoritative time and idempotent receipts use the normal HTTP entry point.
const store=new MemoryStore();let now=at;const rngCalls=[];
const handler=createHandler({G:{...G,randomInt:n=>{rngCalls.push(n);return 1;}},store,rateSecret:'test-rate-secret',clock:()=>new Date(now),push:{ensurePushConfig:async()=>({publicKey:'test-vapid-public'}),saveSubscription:async()=>({subscribed:true}),flushPushOutbox:async()=>({})}}),request=client(handler);
let response=await request({op:'create'});equal(response.status,404);equal((await request({op:'join',code:'anything'})).status,404);
equal((await request({op:'state'})).status,401);
response=await request({op:'login',username:'alpha',password:'not-the-fixture-password'});equal(response.status,401);ok(!JSON.stringify(response.body).includes('not-the-fixture-password'));
store.blockRates=true;const beforeLogin=store.loginChecks;equal((await request({op:'login',username:'alpha',password:'test-only-password'})).status,429);equal(store.loginChecks,beforeLogin);store.blockRates=false;
response=await request({op:'login',username:' ÁLPHÀ ',password:'test-only-password'});equal(response.status,200);equal(response.body.connection.actor,'a');equal(response.body.connection.token,tokenA);equal(response.body.serverTime,at);ok(G.validateRoom(store.state));equal(response.body.gameVersion,3);equal(response.body.drawAvailable,true);equal(response.body.incoming,[]);
equal((await request({op:'login',username:'bravo',password:'test-only-password'},tokenB)).status,200);
equal((await request({op:'login',username:'bravo',password:'test-only-password'},tokenA)).status,409);
response=await request({op:'state'});equal(response.status,200);ok(!JSON.stringify(response.body).includes(tokenA));equal(response.body.actor,'a');equal(response.body.state.round.from,'a');
equal((await request({op:'push_config'})).body,{vapidPublicKey:'test-vapid-public'});equal((await request({op:'subscribe',subscription:{test:true}})).status,200);
equal((await request(intent('ROLL_CATEGORY',801,'onde-1',{value:6}))).status,400);equal((await request(intent('RESET',802))).status,400);
store.forceRace=true;response=await request(intent('ROLL_CATEGORY',803));equal(response.status,200);equal(response.body.roll.kind,4);equal(response.body.state.round.hand.length,6);equal(store.used.size,1);const original=clone(response.body),revision=store.revision,calls=rngCalls.length;
response=await request(intent('ROLL_CATEGORY',803));equal(response.status,200);equal(response.body,original);equal(store.revision,revision);equal(rngCalls.length,calls);
now='2026-11-02T15:00:10.000Z';response=await request(intent('ROLL_CATEGORY',803));equal(response.body.serverTime,now);equal(response.body.state,original.state);equal(response.body.roll,original.roll);now=at;
equal((await request(intent('ROLL_CARD',803))).body.error.code,'request_id_reused');
response=await request({op:'state'},tokenB);equal(response.body.state.round.from,'b');equal(response.body.drawAvailable,true);equal(response.body.incoming,[]);equal(response.body.quota.remaining,1);
response=await request(intent('ROLL_CARD',804,'onde-1'),tokenB);equal(response.status,409);equal(response.body.incoming,[]);equal(response.body.state.round.cardId,null);
response=await request({op:'state'},tokenA,{Origin:'https://unrelated.example'});equal(response.status,403);equal(response.headers.get('Access-Control-Allow-Origin'),null);
const badHandler=createHandler({G,store:{rpc:async()=>{throw new Error('SECRET-DATABASE-ERROR');}},rateSecret:'test'});
const bad=await badHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json'},body:'{"op":"state","gameVersion":3}'}));equal(bad.status,503);ok(!(await bad.text()).includes('SECRET-DATABASE-ERROR'));
const cronCalls=[],cronHandler=createHandler({G,store,rateSecret:'test',push:{isPushCronAuthorized:async(_store,header)=>header==='test-only-cron-secret',enqueueScheduled:async()=>cronCalls.push('enqueue'),flushPushOutbox:async()=>cronCalls.push('flush')}});
let cron=await cronHandler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"drain_push"}'}));equal(cron.status,401);equal(cronCalls,[]);
cron=await cronHandler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json','x-desir-cron':'test-only-cron-secret'},body:'{"op":"drain_push"}'}));equal(cron.status,202);equal(cronCalls,['enqueue','flush']);
let canceled=false;const oversized=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(7000));},cancel(){canceled=true;}});
const tooLarge=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenA},body:oversized,duplex:'half'}));equal(tooLarge.status,413);equal(canceled,true);
const preflight=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:'https://cgiy.github.io'}}));equal(preflight.status,204);equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://cgiy.github.io');equal(preflight.headers.get('Access-Control-Max-Age'),'600');
equal((await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:'https://unrelated.example'}}))).status,403,'cached preflight never allows an unrelated origin');
// Independent rate checks overlap, but either denial still blocks all private reads.
for(const denied of ['authenticated-ip:','device:']){
 const reached=[],releases=[];let privateReads=0;
 const guarded=createHandler({G,rateSecret:'test',store:{rpc(name,args){
  if(name!=='desir_rate_limit'){privateReads++;return null;}
  reached.push(args.p_bucket);return new Promise(resolve=>releases.push(()=>resolve(!args.p_bucket.startsWith(denied))));
 }}});
 const pending=client(guarded)({op:'state'});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{clearInterval(poll);reject(new Error('Rate checks did not overlap'));},1000);
  const poll=setInterval(()=>{if(releases.length===2){clearTimeout(timeout);clearInterval(poll);resolve();}},1);
 });
 equal(reached.length,2);equal(privateReads,0,'session waits for both rate checks');
 for(const release of releases)release();
 equal((await pending).status,429);equal(privateReads,0,'each limit independently protects private data');
}
console.log(`Dés·ir backend: ${checks} privacy/auth/RNG/CAS/idempotency/quota/expiry assertions passed.`);
