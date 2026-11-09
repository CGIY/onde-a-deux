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
for(const type of ['ROLL_CATEGORY','REROLL_CARD','ROLL_VARIANT'])for(const forbidden of ['actor','value','hand','at','token','player','gameVersion','catalogueVersion','variantRoll','intimacyPool','modeRoll','hardcoreOffer','__proto__']){
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
// A private draw affects only the authenticated player's activity projection.
{
 const room=G.createRoom({at}),own=G.roomView(room,'a'),roundId=own.round.id;
 const drawn=G.reduceRoom(room,{type:'ROLL_CATEGORY',actor:'a',roundId,at,value:1,...G.drawCategory(own,1,3,()=>1)});
 const view=actor=>snapshot(G,{room:{id:roomId,state:drawn,revision:1},member:{actor},paired:true,quota:{remaining:1}}, {},6);
 const a=view('a'),b=view('b');
 equal(a.activity,{streak:1,lastDay:'2026-11-02'});
 equal(b.activity,{streak:0,lastDay:null});
 equal(G.activeStreak(a.activity,'2026-11-03T22:59:00.000Z'),1);
 equal(G.activeStreak(a.activity,'2026-11-03T23:00:00.000Z'),0);
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
  const response=await handler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://cgiy.github.io',...extra},body:JSON.stringify({gameVersion:6,...body})}));
  return {status:response.status,body:await response.json(),headers:response.headers};
 };
}
const intent=(type,id,roundId='onde-1',extra={})=>({op:'action',requestId:uuid(id),action:{type,roundId,...extra}});
const view=(store,actor,roundId)=>G.roomView(store.state,actor,roundId);

// Portraits use only the device's verified room and never change the game.
{
 const saved=new MemoryStore();saved.state=G.createRoom({at});await authorize(saved);
 const before=clone(saved.state),revision=saved.revision,paths=[];
 saved.request=async path=>{
  paths.push(path);
  return [{actor:'a',jpeg_base64:'/9j/2Q=='},{actor:'b',jpeg_base64:'/9j/AA=='},{actor:'c',jpeg_base64:'/9j/2Q=='}];
 };
 const deliver=client(createHandler({G,store:saved,rateSecret:'fixture-portraits'}));
 const request={op:'portraits',gameVersion:8};
 equal((await deliver(request,'X'.repeat(43))).status,401);
 equal((await deliver({...request,roomId:'unauthorized-room'})).status,400);
 equal(paths,[]);
 for(const token of [tokenA,tokenB]){
  const reply=await deliver(request,token);
  equal(reply.status,200);equal(reply.headers.get('cache-control'),'no-store');
  equal(reply.body,{portraits:{a:'/9j/2Q==',b:'/9j/AA=='}});
 }
 equal(paths,Array(2).fill('desir_room_portraits?select=actor,jpeg_base64&room_id=eq.'+roomId));
 equal(saved.state,before);equal(saved.revision,revision);equal(saved.used.size,0);equal(saved.receipts.size,0);
}

// Outdated clients receive a safe upgrade before migration or any game mutation.
{
 const saved=new MemoryStore();await authorize(saved);
 const handler=createHandler({G,store:saved,rateSecret:'fixture',clock:()=>new Date(at)}),deliver=client(handler);
 for(const gameVersion of [1,2,3,4,5])for(const op of ['login','state','action','hardcore','push_config','subscribe']){
  const before=clone(saved.state),revision=saved.revision,calls=saved.calls.length;
  const response=await deliver({op,gameVersion,username:'alpha',password:'test-only-password',requestId:uuid(600),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});
  equal(response.status,409);equal(response.body.error.code,'upgrade_required');equal(response.body.state,undefined);equal(saved.state,before);equal(saved.revision,revision);equal(saved.used.size,0);
  equal(saved.calls.length,calls,'old protocols are rejected before rate writes, session reads or receipt lookup');
 }
 equal((await deliver({op:'state',gameVersion:'6'})).status,400);
}

// A published legacy hand, score, D4 and quota survive migration into its owner lane.
{
 const legacy=new MemoryStore(),saved=draft('a',1,4,'detente'),hand=clone(saved.round.hand);
 saved.phase='card';Object.assign(saved.round,{cardId:null,cardRoll:null,hp:null,status:'drawing'});delete saved.round.cardRerolled;
 saved.stats={totalCompleted:21,byCategory:{complicite:1,detente:2,projets:3,attention:4,bouffe:5,intimite:6}};legacy.state=saved;legacy.used.add('a');await authorize(legacy);
 const rng=[],handler=createHandler({G:{...G,randomInt:n=>{rng.push(n);return n;}},store:legacy,rateSecret:'fixture',clock:()=>new Date(at)}),deliver=client(handler);
 const own=await deliver({op:'state'});equal(own.status,200);equal(legacy.state.version,2);equal(own.body.gameVersion,6);equal(own.body.state.round.hand,hand);equal(own.body.state.stats,saved.stats);equal(own.body.state.round.categoryId,'detente');equal(own.body.state.round.categoryRoll,2);equal(own.body.quota.remaining,0);equal(rng,[]);equal(legacy.revision,1);
 const other=await deliver({op:'state'},tokenB);equal(other.status,200);equal(other.body.state.phase,'category');equal(other.body.state.round.from,'b');equal(other.body.incoming,[]);equal(other.body.drawAvailable,true);equal(other.body.quota.remaining,1);equal(legacy.revision,1);
 const rolled=await deliver(intent('ROLL_CARD',601));equal(rolled.status,200);equal(rolled.body.roll,{kind:4,value:4});equal(rolled.body.state.round.cardId,hand[3]);equal(rng,[4]);equal(legacy.used.size,1);
 const sent=await deliver(intent('SEND',602));equal(sent.status,200);equal(legacy.outbox,[{actor:'b',kind:'invitation',roundId:'onde-1'}]);
 const invited=await deliver({op:'state'},tokenB);equal(invited.body.state.phase,'category');equal(invited.body.incoming,[]);equal(invited.body.state.tasks[0].cardId,hand[3]);ok(G.validateState(invited.body.state));equal(invited.body.state.stats.totalCompleted,21);
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
 const deliver=client(createHandler({G:{...G,randomInt:n=>n===42?(++draws===1?1:42):1},store,rateSecret:'fixture',clock:()=>new Date(at)}));
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

// Private draws become shared tasks immediately, with one receipt and notification.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);const rng=[];let category=0;
 const deliver=client(createHandler({G:{...G,drawDaily(){throw Error('Daily cards must not be drawn');},randomInt:n=>{rng.push(n);return n===42?(++category===1?1:42):n===20?1:2;}},store,rateSecret:'fixture',clock:()=>new Date(at)}));
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
 const sent=await deliver(intent('SEND',661,aId));equal(sent.status,200);equal(store.outbox,[{actor:'b',kind:'invitation',roundId:aId}]);
 equal(store.state.lanes.a.phase,'category');ok(store.state.lanes.a.round.id!==aId);equal(store.state.pendingRounds,[]);equal(store.state.tasks.length,1);equal(store.state.history.find(r=>r.id===aId).toConfirmed,false,'queuing does not fabricate recipient acceptance');
 const recipient=await deliver({op:'state'},tokenB);equal(recipient.body.state.round.id,bId);equal(recipient.body.state.phase,'draft');equal(recipient.body.incoming,[]);equal(recipient.body.pendingOutgoing,0);equal(recipient.body.state.tasks[0].id,aId);equal(recipient.body.state.tasks[0].variantRoll,2);
 const sentAgain=await deliver(intent('SEND',661,aId));equal(sentAgain.status,200);equal(sentAgain.body,sent.body);equal(store.outbox.length,1);equal(store.state.tasks.length,1);
 for(const type of ['SEND_DAILY','ACCEPT','PASS','CHALLENGE']){const removed=await deliver(intent(type,662,aId),tokenB);equal(removed.status,400);equal(removed.body.error.code,'invalid_action');}
 equal((await deliver(intent('SEND',663,view(store,'a').round.id,{directQueue:true}))).status,400,'the trusted internal flag is never client input');
 const checkA=intent('TOGGLE_TASK_CHECK',665,view(store,'a').round.id,{taskId:aId,checked:true}),checkB=intent('TOGGLE_TASK_CHECK',666,bId,{taskId:aId,checked:true});
 const checked=await Promise.all([deliver(checkA),deliver(checkB,tokenB)]);equal(checked.map(x=>x.status),[200,200]);equal(store.state.stats.totalCompleted,1);equal(store.state.tasks.length,0);equal(store.state.lanes.a.phase,'category');equal(store.state.lanes.b,bBefore);
 equal((await deliver(checkB,tokenB)).status,200);equal(store.state.stats.totalCompleted,1);
 const next=await deliver({op:'state'},tokenA);equal(next.status,200);equal(next.body.state.round.from,'a');equal(next.body.state.phase,'category');ok(next.body.state.round.id!==aId);equal(next.body.quota.remaining,0);
 const exhausted=await deliver(intent('ROLL_CATEGORY',668,next.body.state.round.id));equal(exhausted.status,409);equal(exhausted.body.error.code,'quota_exhausted');equal(store.state.lanes.b,bBefore);
 equal((await deliver(intent('SEND',669,bId),tokenB)).status,200);equal(store.outbox.at(-1),{actor:'a',kind:'invitation',roundId:bId});
 equal(store.state.daily,null,'no extra daily card is created');
}

// Every authoritative refusal face dismisses the task once, without points or quota.
for(let face=1;face<=20;face++){
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);const randomCalls=[];
 const deliver=client(createHandler({G:{...G,randomInt:n=>{randomCalls.push(n);return n===20?face:1;}},store,rateSecret:'fixture',clock:()=>new Date(at)}));
 const taskId=view(store,'a').round.id;let requestId=1000+face*10;
 for(const type of ['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT','SEND'])equal((await deliver(intent(type,requestId++,taskId))).status,200);
 const used=store.used.size,revision=store.revision,bId=view(store,'b').round.id,calls=randomCalls.length;
 const invalidSender=await deliver(intent('REFUSE_TASK',requestId++,view(store,'a').round.id,{taskId}));equal(invalidSender.status,409);equal(randomCalls.length,calls,'sender refusal does not draw');
 const illegal=await deliver(intent('REFUSE_TASK',requestId++,bId,{taskId,value:20}),tokenB);equal(illegal.status,400);equal(randomCalls.length,calls,'client cannot choose the D20');
 const action=intent('REFUSE_TASK',requestId++,bId,{taskId});
 const results=await Promise.all([deliver(action,tokenB),deliver(action,tokenB)]);equal(results.map(x=>x.status),[200,200]);equal(results[0].body,results[1].body,'concurrent replay keeps the committed D20');
 equal(results[0].body.roll,{kind:20,value:face});equal(store.state.tasks,[]);equal(store.state.stats.totalCompleted,0);equal(store.used.size,used);equal(store.revision,revision+1);equal(store.state.history.find(r=>r.id===taskId).refusalRoll,face);equal(store.state.history.find(r=>r.id===taskId).status,'passed');
 const replay=await deliver(action,tokenB);equal(replay.body,results[0].body);equal(store.revision,revision+1);
 equal((await deliver(intent('REFUSE_TASK',requestId++,bId,{taskId}),tokenB)).status,409,'a dismissed task cannot be refused again');
 equal(randomCalls.slice(calls).every(n=>n===20),true);equal(store.outbox.length,1,'refusal creates no extra person-directed notification');
}

// Polling refreshes state without creating redundant push drain workers.
{
 const store=new MemoryStore();store.state=G.createRoom();await authorize(store);let drains=0;
 const deliver=client(createHandler({G,store,rateSecret:'fixture',clock:()=>new Date(at),push:{flushPushOutbox:async()=>{drains++;}}}));
 for(let n=0;n<3;n++)equal((await deliver({op:'state'})).status,200);
 equal(drains,0);equal(store.revision,0,'read polls do not change settled game state');
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
response=await request({op:'login',username:' ÁLPHÀ ',password:'test-only-password'});equal(response.status,200);equal(response.body.connection.actor,'a');equal(response.body.connection.token,tokenA);equal(response.body.serverTime,at);ok(G.validateRoom(store.state));equal(response.body.gameVersion,6);equal(response.body.drawAvailable,true);equal(response.body.incoming,[]);
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
const bad=await badHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json'},body:'{"op":"state","gameVersion":6}'}));equal(bad.status,503);ok(!(await bad.text()).includes('SECRET-DATABASE-ERROR'));
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
// Badge progression shares the existing action receipt/CAS transaction. It is
// projected separately, and no extra badge RPC is added to a settled state poll.
{
 const saved=new MemoryStore();saved.state=G.createRoom({at});await authorize(saved);
 let time='2026-11-08T10:00:00.000Z';const randomCalls=[];
 const deliver=client(createHandler({G:{...G,randomInt:n=>{randomCalls.push(n);return n===155?155:1;}},store:saved,rateSecret:'fixture-badges',clock:()=>new Date(time)}));
 const initialA=await deliver({op:'state'}),initialB=await deliver({op:'state'},tokenB);
 equal(initialA.status,200);equal(initialB.status,200);equal(saved.state.progression,undefined);equal(saved.revision,0);
 ok(G.validateBadgeView(initialA.body.badges,'a'));ok(G.validateBadgeView(initialB.body.badges,'b'));
 const aId=saved.state.lanes.a.round.id,bId=saved.state.lanes.b.round.id;
 for(const key of ['progression','badges','badgeId','award','sequence']){
  const before=clone(saved.state),response=await deliver(intent('ROLL_CATEGORY',1900,aId,{[key]:1}));
  equal(response.status,400);equal(saved.state,before,'client cannot submit '+key+' progression');
 }
 saved.forceRace=true;
 const draw=intent('ROLL_CATEGORY',1901,aId),draws=await Promise.all([deliver(draw),deliver(draw)]);
 equal(draws.map(result=>result.status),[200,200]);equal(draws[0].body,draws[1].body,'racing replay returns exactly the committed badge attribution');
 equal(saved.state.progression.individual.a.draws,1);equal(saved.receipts.size,1);
 equal(saved.state.progression.epoch,initialA.body.badges.epoch,'first HTTP gain keeps the initial UI epoch');
 const drawAward=draws[0].body.badges.items.find(item=>item.id==='ind-draws-1').award;
 equal(drawAward.at,time);equal(drawAward.source,undefined);equal(drawAward.sequence,1);
 ok(randomCalls.includes(155),'weekend HTTP draw requests the exact 155-ticket distribution');
 await deliver(intent('ROLL_CARD',1902,aId));await deliver(intent('ROLL_VARIANT',1903,aId));
 const privateCard=saved.state.lanes.a.round.cardId,hidden=await deliver({op:'state'},tokenB);
 equal(hidden.body.badges,initialB.body.badges,'partner private draw changes no visible badge progress or sequence');
 equal(hidden.body.state.progression,undefined);ok(!JSON.stringify(hidden.body).includes(privateCard));
 const send=intent('SEND',1904,aId),sent=await Promise.all([deliver(send),deliver(send)]);
 equal(sent.map(result=>result.status),[200,200]);equal(sent[0].body,sent[1].body);equal(saved.state.progression.individual.a.proposals,1);equal(saved.outbox.length,1);
 equal(saved.state.progression.shared.completed,0);equal(saved.state.progression.individual.b.participations,0);
 const checkA=intent('TOGGLE_TASK_CHECK',1905,saved.state.lanes.a.round.id,{taskId:aId,checked:true}),checkB=intent('TOGGLE_TASK_CHECK',1906,bId,{taskId:aId,checked:true});
 const checked=await Promise.all([deliver(checkA),deliver(checkB,tokenB)]);
 equal(checked.map(result=>result.status),[200,200]);equal(saved.state.stats.totalCompleted,1);equal(saved.state.progression.shared.completed,1);
 equal(saved.state.progression.individual.a.participations,1);equal(saved.state.progression.individual.b.participations,1);
 const completed=clone(saved.state.progression),views=await Promise.all([deliver({op:'state'}),deliver({op:'state'},tokenB)]);
 for(const [index,actor] of ['a','b'].entries()){
  const body=views[index].body;ok(G.validateBadgeView(body.badges,actor));equal(body.state.progression,undefined);
  const text=JSON.stringify(body);ok(!text.includes('sequenceByActor'));ok(!text.includes('"progression"'));ok(!text.includes(':individual:'+G.otherPlayer(actor)+':'));
 }
 equal(views[0].body.badges.items.find(item=>item.id==='duo-completed-1').award.id,views[1].body.badges.items.find(item=>item.id==='duo-completed-1').award.id);
 time='2026-11-08T10:05:00.000Z';
 const repeated=await deliver(checkB,tokenB);
 equal(repeated.body.badges,checked[1].body.badges,'response loss preserves award time, source and badge sequence');equal(repeated.body.revision,checked[1].body.revision);equal(saved.state.progression,completed);
 const callsBefore=saved.calls.length;await deliver({op:'state'});
 equal(saved.calls.slice(callsBefore).map(call=>call.name).sort(),['desir_get_session','desir_rate_limit','desir_rate_limit'],'badge reads add no database round trip');
 saved.receipts.clear();
 equal((await deliver(checkB,tokenB)).status,409,'even without old receipts a removed task cannot reward twice');equal(saved.state.progression,completed);
 equal((await deliver(draw)).status,409);equal(saved.state.progression,completed,'a stale draw ID cannot reward after receipt cleanup');
 const oldEpoch=G.badgeView(saved.state,'a').epoch;
 saved.state=G.resetRoom(saved.state,{at:time});saved.revision++;saved.used.clear();saved.receipts.clear();
 const reset=await deliver({op:'state'});ok(reset.body.badges.epoch>oldEpoch);equal(reset.body.badges.items.filter(item=>item.award).length,0);
 equal((await deliver(send)).status,409);equal(saved.state.progression,undefined);
 const after=await deliver(intent('ROLL_CATEGORY',1907,saved.state.lanes.a.round.id));equal(after.status,200);
 const first=after.body.badges.items.find(item=>item.id==='ind-draws-1').award;
 ok(first.id!==drawAward.id);equal(first.source,undefined);equal(first.sequence,1);
}
// Mixed catalogue v3 uses the existing authoritative action/CAS/receipt path.
// The sub-pool and sampled hand remain private until a concrete task is shared.
{
 const saved=new MemoryStore();saved.state=G.createRoom({at});await authorize(saved);
 const randomCalls=[];
 const deliver=client(createHandler({G:{...G,randomInt:n=>{randomCalls.push(n);return n;}},store:saved,rateSecret:'fixture-mix',clock:()=>new Date(at)}));
 const initialB=await deliver({op:'state'},tokenB),aId=view(saved,'a').round.id,bId=view(saved,'b').round.id;
 saved.forceRace=true;
 const request=intent('ROLL_CATEGORY',2100,aId),draws=await Promise.all([deliver(request),deliver(request)]);
 equal(draws.map(result=>result.status),[200,200]);equal(draws[0].body,draws[1].body);equal(saved.receipts.size,1);equal(saved.used.size,1);
 equal(draws[0].body.gameVersion,6);equal(draws[0].body.roll,{kind:4,value:4});
 const drawn=view(saved,'a');equal(drawn.round.catalogueVersion,3);equal(drawn.round.intimacyPool,'hardcore');equal(drawn.round.hardcoreOffer,false);equal(drawn.round.hand.length,6);equal(G.needsVariant(drawn.round),false);
 ok(randomCalls.includes(42));ok(randomCalls.includes(20));
 const hidden=await deliver({op:'state'},tokenB);equal(hidden.body.badges,initialB.body.badges);equal(hidden.body.state.round.intimacyPool,undefined);
 for(const id of drawn.round.hand)ok(!JSON.stringify(hidden.body).includes(id),'private Hardcore sample is never delivered');
 const hiddenSingle=projectState(G,drawn,'b',6);equal(hiddenSingle.phase,'category');equal(hiddenSingle.round.intimacyPool,undefined);equal(hiddenSingle.round.hand,[]);
 const card=await deliver(intent('ROLL_CARD',2101,aId));equal(card.status,200);equal(card.body.roll,{kind:6,value:6});equal(card.body.state.phase,'draft');equal(card.body.state.round.hp,null);equal(card.body.state.round.variantRoll,undefined);
 const calls=randomCalls.length,invalidVariant=await deliver(intent('ROLL_VARIANT',2102,aId));
 equal(invalidVariant.status,409);equal(invalidVariant.body.error.code,'invalid_phase');equal(randomCalls.length,calls,'no extra RNG or variant is consumed');
 const reroll=await deliver(intent('REROLL_CARD',2103,aId));equal(reroll.status,200);equal(reroll.body.state.phase,'draft');equal(reroll.body.state.round.intimacyPool,'hardcore');equal(reroll.body.state.round.hand,drawn.round.hand);equal(reroll.body.state.round.variantRoll,undefined);equal(saved.used.size,1);

 // The recipient's accepted-round projection depends on the selected title,
 // never on the other five secretly sampled entries.
 const privateDraft=view(saved,'a'),published=G.reduce(privateDraft,{type:'SEND',directQueue:true,actor:'a',at});
 ok(G.validateState(published));const publicView=projectState(G,published,'b',6);
 equal(publicView.round.cardId,privateDraft.round.cardId);ok(G.validateState(publicView));
 const changed=clone(published),selected=changed.round.cardId,alternatives=G.hardcoreCards.filter(c=>c.id!==selected).slice(-5).map(c=>c.id);let index=0;
 changed.round.hand=Array.from({length:6},(_,i)=>i===changed.round.cardRoll-1?selected:alternatives[index++]);
 ok(G.validateState(changed));equal(projectState(G,changed,'b',6),publicView,'unrevealed hand changes do not affect recipient output');

 const send=intent('SEND',2104,aId),sent=await Promise.all([deliver(send),deliver(send)]);
 equal(sent.map(result=>result.status),[200,200]);equal(sent[0].body,sent[1].body);equal(saved.state.tasks.length,1);equal(saved.outbox.length,1);
 const task=saved.state.tasks[0];equal(task.catalogueVersion,3);equal(task.intimacyPool,'hardcore');equal(task.variantRoll,undefined);equal(task.cardId,selected);equal(task.checks,{a:false,b:false});equal(saved.state.pendingRounds,[]);
 const shared=await deliver({op:'state'},tokenB);equal(shared.body.state.tasks[0],task);equal(shared.body.state.progression,undefined);
 for(const id of drawn.round.hand.filter(id=>id!==selected))ok(!JSON.stringify(shared.body).includes(id),'only the selected title is shared');
 const completeA=intent('TOGGLE_TASK_CHECK',2105,view(saved,'a').round.id,{taskId:aId,checked:true}),completeB=intent('TOGGLE_TASK_CHECK',2106,bId,{taskId:aId,checked:true});
 const complete=await Promise.all([deliver(completeA),deliver(completeB,tokenB)]);equal(complete.map(result=>result.status),[200,200]);
 equal(saved.state.stats.totalCompleted,1);equal(saved.state.stats.byCategory.intimite,1);equal(saved.state.progression.shared.completedByCard[selected],1);equal(saved.state.progression.shared.completedByVariant,{});
 equal(saved.state.progression.individual.a.participations,1);equal(saved.state.progression.individual.b.participations,1);equal(saved.state.history[0].catalogueVersion,3);
 const progress=clone(saved.state.progression),replay=await deliver(completeB,tokenB);equal(replay.body,complete[1].body);equal(saved.state.progression,progress);
 const quota=await deliver(intent('ROLL_CATEGORY',2107,view(saved,'a').round.id));equal(quota.status,409);equal(quota.body.error.code,'quota_exhausted');equal(saved.used.size,1);
 const beforeCalls=saved.calls.length,removed=await deliver({op:'hardcore'});equal(removed.status,410);equal(removed.body.error.code,'mode_removed');equal(saved.calls.length,beforeCalls,'retired combat performs no database operation');
}
// Cocon draws eight cards through protocol 7 while protocol 6 can finish its
// own D6 draw and retry a receipt without exposing the new private draw.
{
 const saved=new MemoryStore();saved.state=G.createRoom({at});await authorize(saved);
 const rng=[];
 const deliver=client(createHandler({G:{...G,randomInt:n=>{rng.push(n);return n>20?1:n;}},store:saved,rateSecret:'fixture-cocon',clock:()=>new Date(at)}));
 const aId=view(saved,'a').round.id,bId=view(saved,'b').round.id;
 const modern=(type,id,roundId=aId,extra={})=>({...intent(type,id,roundId,extra),gameVersion:7});
 const draw=await deliver(modern('ROLL_CATEGORY',2300));
 equal(draw.status,200);equal(draw.body.gameVersion,7);equal(draw.body.roll,{kind:4,value:1});
 const {round}=draw.body.state;
 equal(round.catalogueVersion,4);equal(round.hand.length,8);equal(G.cardSides(round),8);
 equal(round.hand.map(id=>G.getCard(id,4).keyword),['Paper','Selfie','Massage','Soin','Soirée','No Phone','Kiss','Aide']);
 equal(G.getCard(round.hand[0]).title,'Cacher un petit papier');equal(G.getCard(round.hand[0],4).title,'Petit papier');
 equal((await deliver({op:'state'})).body.error.code,'upgrade_required');
 const legacyRequest=intent('ROLL_CATEGORY',2301,bId),legacy=await deliver(legacyRequest,tokenB);
 equal(legacy.status,200);equal(legacy.body.state.round.hand.length,6);equal(legacy.body.state.round.catalogueVersion,3);
 for(const id of round.hand.slice(-2))ok(!JSON.stringify(legacy.body).includes(id),'the private D8 hand stays private');
 equal((await deliver(modern('ROLL_CARD',2302,bId),tokenB)).body.roll,{kind:6,value:6});
 const relaunch=await deliver(modern('REROLL_CATEGORY',2303));
 equal(relaunch.body.state.round.hand,round.hand);equal(relaunch.body.state.round.catalogueVersion,4);
 const selected=await deliver(modern('ROLL_CARD',2304));
 equal(selected.body.roll,{kind:8,value:8});equal(selected.body.state.round.cardId,'eight-complicite-aide');
 const variation=await deliver(modern('ROLL_VARIANT',2305));
 equal(variation.body.roll,{kind:6,value:6});equal(variation.body.state.round.variantRoll,6);
 const replacement=await deliver(modern('REROLL_CARD',2306));
 equal(replacement.body.roll,{kind:8,value:7});equal(replacement.body.state.round.cardId,'eight-complicite-baiser');
 equal(replacement.body.state.round.variantRoll,null);
 equal((await deliver(modern('ROLL_VARIANT',2307))).body.roll,{kind:6,value:6});
 equal((await deliver(modern('SEND',2308))).status,200);
 const task=saved.state.tasks[0];
 equal(task.catalogueVersion,4);equal(task.cardId,'eight-complicite-baiser');equal(task.variantRoll,6);
 equal((await deliver({op:'state'},tokenB)).body.error.code,'upgrade_required');
 equal((await deliver(legacyRequest,tokenB)).body,legacy.body,'a pending pre-update request can still recover its original receipt');
 const shared=await deliver({op:'state',gameVersion:7},tokenB);
 equal(shared.body.state.tasks,[task]);ok(!JSON.stringify(shared.body).includes('eight-complicite-aide'));
 const checkedA=await deliver(modern('TOGGLE_TASK_CHECK',2309,view(saved,'a').round.id,{taskId:aId,checked:true}));
 const checkedB=await deliver(modern('TOGGLE_TASK_CHECK',2310,bId,{taskId:aId,checked:true}),tokenB);
 equal([checkedA.status,checkedB.status],[200,200]);equal(saved.state.stats.byCategory.complicite,1);
 equal(saved.state.history[0].catalogueVersion,4);equal(saved.state.progression.shared.completedByCard[task.cardId],1);
 const serialized=clone(saved.state);equal(G.normalizeRoom(serialized),serialized);
 const older=await deliver({op:'state'},tokenB);
 equal(older.status,200);equal(older.body.state.history.some(item=>item.catalogueVersion===4),false);
 ok(rng.includes(8));ok(rng.includes(7));
}

// Protocol 8 uses the unified D8 catalogue for each D4 result. Protocol 7
// still resolves Braises through its original D20 and six-card hand.
for(const [ticket,face] of [[1,1],[12,2],[22,3],[32,4]]){
 const rng=[],room=G.createRoom({at}),roundId=G.roomView(room,'a').round.id;
 const result=applyAction(G,room,'a',{type:'ROLL_CATEGORY',roundId},uuid(2400+face),at,sides=>{rng.push(sides);return sides===42?ticket:sides;},8);
 const drawn=G.roomView(result.state,'a').round;
 equal(result.roll,{kind:4,value:face});equal(drawn.catalogueVersion,5);equal(drawn.hand.length,8);equal(G.cardSides(drawn),8);
 equal(drawn.categoryId,G.categories[face-1].id);equal(drawn.modeRoll,null);ok(!rng.includes(20));
 const card=applyAction(G,result.state,'a',{type:'ROLL_CARD',roundId},uuid(2410+face),at,sides=>{equal(sides,8);return 8;},8);
 equal(card.roll,{kind:8,value:8});equal(G.roomView(card.state,'a').phase,'variant');
}
{
 const room=G.createRoom({at}),roundId=G.roomView(room,'a').round.id,rng=[];
 const result=applyAction(G,room,'a',{type:'ROLL_CATEGORY',roundId},uuid(2420),at,sides=>{rng.push(sides);return sides;},7);
 const drawn=G.roomView(result.state,'a').round;
 equal(result.roll,{kind:4,value:4});equal(drawn.catalogueVersion,3);equal(G.cardSides(drawn),6);
 equal(drawn.intimacyPool,'hardcore');ok(rng.includes(20));
}

// Keep the author's Oral table throughout drawing, sharing, and completion,
// even after the other player becomes active or reloads their own view.
{
 const saved=new MemoryStore();saved.state=G.createRoom({at});await authorize(saved);
 let choice=null,request=2430;
 const deliver=client(createHandler({G:{...G,randomInt:n=>choice??n},store:saved,rateSecret:'fixture-unified',clock:()=>new Date(at)}));
 const modern=(type,roundId,extra={})=>({...intent(type,request++,roundId,extra),gameVersion:8});
 for(const [actor,token,recipientToken,expected] of [['a',tokenA,tokenB,'Sit Face'],['b',tokenB,tokenA,'Golden Shower sur Agathe']]){
  const recipient=G.otherPlayer(actor),roundId=view(saved,actor).round.id;
  const drawRequest=modern('ROLL_CATEGORY',roundId),draw=await deliver(drawRequest,token);
  equal(draw.status,200);equal(draw.body.gameVersion,8);equal(draw.body.roll,{kind:4,value:4});
  equal(draw.body.state.round.catalogueVersion,5);equal(draw.body.state.round.modeRoll,null);
  const peer=await deliver({op:'state',gameVersion:7},recipientToken);
  equal(peer.status,200);equal(peer.body.state.round.from,recipient);equal(peer.body.state.round.hand,[]);
  const incompatible=await deliver({op:'state',gameVersion:7},token);
  equal(incompatible.status,409);equal(incompatible.body.error.code,'upgrade_required');equal(incompatible.body.state,undefined);
  const oralFace=draw.body.state.round.hand.findIndex(id=>G.getCard(id,5).title==='Oral')+1;
  ok(oralFace>0);
  choice=oralFace;
  const card=await deliver(modern('ROLL_CARD',roundId),token);
  equal(card.status,200);equal(card.body.roll,{kind:8,value:oralFace});equal(card.body.state.phase,'variant');
  choice=4;
  const variant=await deliver(modern('ROLL_VARIANT',roundId),token);
  choice=null;
  equal(variant.status,200);equal(variant.body.roll,{kind:6,value:4});equal(G.getVariant(variant.body.state.round),expected);
  equal((await deliver(modern('SEND',roundId),token)).status,200);
  const task=(await deliver({op:'state',gameVersion:8},recipientToken)).body.state.tasks.find(task=>task.id===roundId);
  equal(task.from,actor);equal(task.catalogueVersion,5);equal(G.getVariant(task),expected);
  const oldPeer=await deliver({op:'state',gameVersion:7},recipientToken);
  equal(oldPeer.status,409);equal(oldPeer.body.error.code,'upgrade_required');
  for(const [id,checker] of [[actor,token],[recipient,recipientToken]]){
   equal((await deliver(modern('TOGGLE_TASK_CHECK',view(saved,id).round.id,{taskId:roundId,checked:true}),checker)).status,200);
  }
  equal(G.getVariant(saved.state.history.find(entry=>entry.id===roundId)),expected);
  const after=await deliver({op:'state',gameVersion:7},recipientToken);
  equal(after.status,200);ok(after.body.state.history.every(entry=>entry.catalogueVersion!==5));
  equal((await deliver(drawRequest,token)).body,draw.body,'the earlier roll is replayed without drawing again');
 }
 equal(saved.state.stats.byCategory.intimite,2);ok(G.validateRoom(saved.state));
 equal(G.normalizeRoom(clone(saved.state)),saved.state);
}

// Wallets stay private to compatible transports. A conflicting commit and an
// idempotent replay must charge only one star, using the server's Paris day.
{
 let time='2026-11-09T10:00:00.000Z',request=2500,rolls=0;
 const saved=new MemoryStore();saved.state=G.createRoom({at:time});await authorize(saved);
 const deliver=client(createHandler({G:{...G,randomInt:n=>{rolls++;return n===42?1:n;}},store:saved,rateSecret:'fixture-stars',clock:()=>new Date(time)}));
 const modern=(type,roundId=view(saved,'a').round.id)=>({...intent(type,request++,roundId),gameVersion:8});
 for(const gameVersion of [6,7]){
  const old=await deliver({op:'state',gameVersion});
  equal(old.status,200);equal(old.body.state.cardRerollWallets,undefined);
  equal(old.body.badges.items.length,90);ok(G.validateBadgeView(old.body.badges,'a'));
 }
 const initial=await deliver({op:'state',gameVersion:8});
 equal(initial.status,200);equal(G.cardRerollStars(initial.body.state,'a',initial.body.serverTime).balance,1);
 equal(G.cardRerollStars(initial.body.state,'b',initial.body.serverTime).balance,1);
 equal(initial.body.badges.items.length,120);ok(G.validateBadgeView(initial.body.badges,'a'));
 const originalPartner=clone(saved.state.cardRerollWallets.b);
 const draft=async()=>{for(const type of ['ROLL_CATEGORY','ROLL_CARD','ROLL_VARIANT'])equal((await deliver(modern(type))).status,200);};
 await draft();
 time='2026-11-09T22:30:00.000Z';
 const rerollRequest=modern('REROLL_CARD'),commits=saved.calls.filter(call=>call.name==='desir_commit').length;
 saved.forceRace=true;
 const rerolled=await deliver(rerollRequest);
 equal(rerolled.status,200);equal(rerolled.body.roll.kind,8);
 equal(saved.calls.filter(call=>call.name==='desir_commit').length,commits+2);
 equal(G.cardRerollStars(rerolled.body.state,'a',rerolled.body.serverTime),{balance:1,nextAt:'2026-11-10T10:00:00.000Z',usedToday:true});
 equal(saved.state.cardRerollWallets.b,originalPartner);
 const walletAfter=clone(saved.state.cardRerollWallets),revision=saved.revision,draws=rolls;
 equal((await deliver(rerollRequest)).body,rerolled.body);
 equal(saved.state.cardRerollWallets,walletAfter);equal(saved.revision,revision);equal(rolls,draws);
 equal((await deliver(modern('ROLL_VARIANT'))).status,200);
 equal((await deliver(modern('SEND'))).status,200);

 // The in-memory store models one ticket per slot; advance its slot so the
 // same actor can open a new round while it is still the same Paris day.
 saved.used.delete('a');
 time='2026-11-09T22:59:59.999Z';
 await draft();
 const deniedRolls=rolls,deniedWallet=clone(saved.state.cardRerollWallets);
 const denied=await deliver(modern('REROLL_CARD'));
 equal(denied.status,409);equal(denied.body.error.code,'invalid_phase');
 equal(rolls,deniedRolls);equal(saved.state.cardRerollWallets,deniedWallet);
 time='2026-11-09T23:00:00.000Z';
 const nextDay=await deliver(modern('REROLL_CARD'));
 equal(nextDay.status,200);
 equal(G.cardRerollStars(nextDay.body.state,'a',nextDay.body.serverTime),{balance:0,nextAt:'2026-11-10T10:00:00.000Z',usedToday:true});
 equal(saved.state.cardRerollWallets.b,originalPartner);
 const refreshed=await deliver({op:'state',gameVersion:8});
 equal(refreshed.body.state.cardRerollWallets,saved.state.cardRerollWallets);
 ok(G.validateRoom(saved.state));
}

// Catalogue expansion keeps old attributed awards and imports only newly
// introduced qualifications. A real 2 -> 3 completion is still a live gain,
// committed once with the existing CAS and idempotency receipt.
{
 const badgeId='duo-hc-golden-3',time='2026-11-02T16:00:00.000Z';
 function mutate(room,type,actor,extra={}){
  const next=G.reduceRoom(room,{type,actor,roundId:room.lanes[actor].round.id,at,...extra});
  ok(next!==room);ok(G.validateRoom(next));return next;
 }
 function queueHardcore(room){
  const prepared=G.drawCategory(G.roomView(room,'a'),4,3,n=>n);
  room=mutate(room,'ROLL_CATEGORY','a',{value:4,...prepared});room=mutate(room,'ROLL_CARD','a',{value:1});
  const taskId=room.lanes.a.round.id;room=mutate(room,'SEND','a',{directQueue:true});return {room,taskId};
 }
 function completeHardcore(room){
  const queued=queueHardcore(room);room=mutate(queued.room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true});
  return mutate(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true});
 }
 function legacyRegistry(room){
  const next=clone(room),progress=next.progression;delete progress.catalogueVersion;
  for(const badge of G.badgeCatalog.slice(60)){
   if(badge.scope==='shared')delete progress.awards.shared[badge.id];
   else for(const actor of ['a','b'])delete progress.awards.individual[actor][badge.id];
  }
  for(const actor of ['a','b']){
   const rows=[...Object.values(progress.awards.individual[actor]).map(award=>({award,n:award.sequence,shared:false})),...Object.values(progress.awards.shared).map(award=>({award,n:award.sequenceByActor[actor],shared:true}))].sort((a,b)=>a.n-b.n);
   rows.forEach(({award,shared},index)=>{if(shared)award.sequenceByActor[actor]=index+1;else award.sequence=index+1;});progress.sequences[actor]=rows.length;
  }
  ok(G.validateRoom(next));return next;
 }
 let baseline=G.createRoom({at});for(let n=0;n<2;n++)baseline=completeHardcore(baseline);
 const third=queueHardcore(baseline),saved=new MemoryStore();saved.state=legacyRegistry(third.room);await authorize(saved);
 const before=clone(saved.state),oldAwards=clone(saved.state.progression.awards),epoch=saved.state.progression.epoch;
 const deliver=client(createHandler({G,store:saved,rateSecret:'fixture-expansion',clock:()=>new Date(time)}));
 const reads=await Promise.all([deliver({op:'state'}),deliver({op:'state'},tokenB)]);
 for(const response of reads){equal(response.status,200);equal(response.body.gameVersion,6);equal(response.body.badges.items.length,90);equal(response.body.badges.items.find(item=>item.id===badgeId).award,null);}
 equal(saved.state,before,'reading expanded collection leaves stored room untouched');equal(saved.revision,0);
 saved.forceRace=true;
 const actions=[intent('TOGGLE_TASK_CHECK',2200,view(saved,'a').round.id,{taskId:third.taskId,checked:true}),intent('TOGGLE_TASK_CHECK',2201,view(saved,'b').round.id,{taskId:third.taskId,checked:true})];
 const applied=await Promise.all([deliver(actions[0]),deliver(actions[1],tokenB)]);equal(applied.map(result=>result.status),[200,200]);
 equal(saved.state.progression.catalogueVersion,3);equal(saved.state.progression.epoch,epoch);equal(saved.state.stats.totalCompleted,3);equal(saved.state.progression.shared.completedByCard['hardcore-01'],3);equal(saved.receipts.size,2);
 const award=saved.state.progression.awards.shared[badgeId];equal(award.at,time);equal(award.source,undefined);
 for(const [id,old] of Object.entries(oldAwards.shared))equal(saved.state.progression.awards.shared[id],old);
 for(const actor of ['a','b'])for(const [id,old] of Object.entries(oldAwards.individual[actor]))equal(saved.state.progression.awards.individual[actor][id],old);
 const committed=clone(saved.state.progression);
 for(const [index,token] of [tokenA,tokenB].entries()){const replay=await deliver(actions[index],token);equal(replay.body,applied[index].body);equal(saved.state.progression,committed);}

 // The same threshold satisfied before the release is imported, never dated
 // at the read or at the following private draw's commit.
 const previous=new MemoryStore();previous.state=legacyRegistry(saved.state);await authorize(previous);
 const old=clone(previous.state),reader=client(createHandler({G:{...G,randomInt:()=>1},store:previous,rateSecret:'fixture-import',clock:()=>new Date(time)}));
 const first=await reader({op:'state'}),second=await reader({op:'state'},tokenB);
 for(const response of [first,second]){const item=response.body.badges.items.find(item=>item.id===badgeId);equal(item.progress.value,3);equal(item.award.at,null);equal(item.award.source,'imported');}
 equal(previous.state,old);equal(previous.revision,0);equal(previous.receipts.size,0);
 const draw=await reader(intent('ROLL_CATEGORY',2202,view(previous,'a').round.id));equal(draw.status,200);
 equal(draw.body.badges.items.find(item=>item.id===badgeId).award,first.body.badges.items.find(item=>item.id===badgeId).award);
 equal(previous.state.progression.awards.shared[badgeId].at,null);equal(previous.state.progression.awards.shared[badgeId].source,'imported');equal(previous.state.stats,old.stats);equal(previous.state.players,old.players);
 equal(previous.state.progression.epoch,old.progression.epoch);equal(previous.state.progression.catalogueVersion,3);
 const calls=previous.calls.length;
 const obsolete=await reader({...intent('ROLL_CATEGORY',2202,view(previous,'a').round.id),gameVersion:5});
 equal(obsolete.status,409);equal(obsolete.body.error.code,'upgrade_required');equal(previous.calls.length,calls,'v5 cannot replay a saved request after v6 migration');
}
console.log(`Dés·ir backend: ${checks} privacy/auth/RNG/CAS/idempotency/quota/expiry assertions passed.`);
