import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHandler} from '../functions/desir-game/server.mjs';
import {projectState,validDeviceToken,sha256,privateBucket,applyAction,parseAction,HttpError,normalizeUsername} from '../functions/desir-game/model.mjs';
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
 const privateDefense=act(act(act(s,'CHALLENGE_DRAFT'),'ROLL_DRAFT_DEFENSE',{value:20,token:'p1'}),'ROLL_DRAFT_DEFENSE',{value:20,token:'p2'});
 const hidden=projectState(G,privateDefense,to);equal(hidden.history,[]);equal(hidden.round.cardId,null);
 const own=projectState(G,privateDefense,from);equal(own.round.cardId,s.round.cardId);equal(own.history.length,1);
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
for(const category of G.categories){
 const randomCalls=[],drawn=applyAction(G,G.createState(),'a',{type:'ROLL_CATEGORY',roundId:'onde-1'},uuid(30+category.number),at,sides=>{randomCalls.push(sides);return category.number;},2);
 equal(randomCalls,[4],'new category draw uses four equiprobable faces');equal(drawn.roll,{kind:4,value:category.number});equal(drawn.state.round.categoryId,category.id);equal(drawn.state.round.catalogueVersion,2);equal(drawn.state.round.hand.length,6);equal(drawn.consumeTicket,true);
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
  equal(G.canRerollCard(result.state),false);equal(G.canChallengeDraft(result.state),false,'reroll removes the initiator D20');ok(!Object.hasOwn(result.state.round,'previousCardId'),'old card is not stored as previousCardId');
  const hidden=projectState(G,result.state,to);equal(hidden.round.cardId,null);equal(hidden.round.hand,[]);equal(hidden.round.cardRerolled,false,'recipient learns nothing about private reroll');equal(hidden.seen,{});
  const sent=applyAction(G,result.state,from,{type:'SEND',roundId:source.round.id},uuid(200+rank),at).state;
  const challenge=applyAction(G,sent,to,{type:'CHALLENGE',roundId:source.round.id},uuid(210+rank),at);
  equal(challenge.state.phase,'challenge','recipient still has a D20 challenge');
  const defense=applyAction(G,challenge.state,to,{type:'ROLL_DEFENSE',roundId:source.round.id},uuid(220+rank),at,()=>1);
  equal(defense.state.round.rolls,[1]);equal(defense.consumeTicket,false);
  for(const blocked of [result.state,act(source,'CHALLENGE_DRAFT'),act(source,'SEND')]){
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
// Both simultaneous deliveries must observe the one committed replacement face.
for(const sides of [4,6]){
 const concurrent=new MemoryStore();concurrent.state=draft('a',2,sides);concurrent.used.add('a');
 const hash=await sha256('device:'+tokenA);concurrent.members.set(hash,{token_hash:hash,room_id:roomId,actor:'a'});
 let randomCalls=0;const concurrentHandler=createHandler({G:{...G,randomInt:n=>{equal(n,sides-1);return ++randomCalls===1?1:sides-1;}},store:concurrent,rateSecret:'fixture',clock:()=>new Date(at)});
 const deliver=async()=>{const result=await concurrentHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json'},body:JSON.stringify({op:'action',requestId:uuid(300),action:{type:'REROLL_CARD',roundId:'onde-1'}})}));return {status:result.status,body:await result.json()};};
 const [first,second]=await Promise.all([deliver(),deliver()]);equal(first.status,200);equal(second.status,200);equal(first.body,second.body,'concurrent retry returns the committed receipt, never a losing RNG result');equal(concurrent.receipts.size,1);equal(concurrent.revision,1);equal(concurrent.state.round.cardRoll,first.body.roll.value);equal(concurrent.used.size,1);equal(concurrent.outbox,[]);
}
// Existing persisted rounds/history lacking the new flag are migrated before strict projection.
{
 const legacy=new MemoryStore();legacy.state=act(act(act(draft(),'CHALLENGE_DRAFT'),'ROLL_DRAFT_DEFENSE',{value:20,token:'old1'}),'ROLL_DRAFT_DEFENSE',{value:20,token:'old2'});
 const oldCard=legacy.state.round.cardId;delete legacy.state.round.cardRerolled;for(const past of legacy.state.history)delete past.cardRerolled;
 const hash=await sha256('device:'+tokenB);legacy.members.set(hash,{token_hash:hash,room_id:roomId,actor:'b'});
 const legacyHandler=createHandler({G,store:legacy,rateSecret:'fixture',clock:()=>new Date(at)});
 const result=await legacyHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokenB,'Content-Type':'application/json'},body:'{"op":"state"}'})),body=await result.json();
 equal(result.status,200);equal(legacy.state.round.cardRerolled,false);ok(legacy.state.history.every(past=>past.cardRerolled===false));equal(legacy.revision,1,'normalization is persisted through CAS');ok(G.validateState(body.state));equal(body.state.history,[]);equal(body.state.round.cardId,null);ok(!JSON.stringify(body).includes(oldCard),'old private history remains hidden after migration');
}
// A published six-category save is normalized once without redrawing its hand,
// changing its score, spending another quota, or changing its challenge die.
{
 const legacy=new MemoryStore(),saved=draft('a',1,4,'detente'),hand=clone(saved.round.hand);
 saved.phase='card';Object.assign(saved.round,{cardId:null,cardRoll:null,hp:null,status:'drawing'});delete saved.round.cardRerolled;
 saved.stats={totalCompleted:21,byCategory:{complicite:1,detente:2,projets:3,attention:4,bouffe:5,intimite:6}};legacy.state=saved;legacy.used.add('a');
 for(const [token,actor] of [[tokenA,'a'],[tokenB,'b']]){const hash=await sha256('device:'+token);legacy.members.set(hash,{token_hash:hash,room_id:roomId,actor});}
 const migrationRng=[],legacyHandler=createHandler({G:{...G,randomInt:n=>{migrationRng.push(n);return n;}},store:legacy,rateSecret:'fixture',clock:()=>new Date(at)});
 const deliver=async(body,token=tokenA)=>{const response=await legacyHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const own=await deliver({op:'state'});equal(own.status,200);equal(own.body.state.round.hand,hand);equal(own.body.state.round.categoryId,'detente');equal(own.body.state.round.categoryRoll,2);equal(own.body.state.stats,saved.stats);equal(legacy.revision,1,'category normalization is persisted once');equal(migrationRng,[],'migration draws no dice');equal(legacy.used.size,1);
 const other=await deliver({op:'state'},tokenB);equal(other.status,200);equal(other.body.state.round.hand,[]);equal(legacy.revision,1,'a second read does not migrate or sum the score again');
 const rolled=await deliver({op:'action',requestId:uuid(401),action:{type:'ROLL_CARD',roundId:'onde-1'}});equal(rolled.status,200);equal(rolled.body.roll,{kind:4,value:4});equal(rolled.body.state.round.cardId,hand[3]);equal(migrationRng,[4]);equal(legacy.used.size,1,'continuing an old hand spends no new quota');
 const sent=await deliver({op:'action',requestId:uuid(402),action:{type:'SEND',roundId:'onde-1'}});equal(sent.status,200);equal(sent.body.state.round.hand,hand);
 const invited=await deliver({op:'state'},tokenB);equal(invited.status,200);equal(invited.body.state.round.hand.length,4);equal(invited.body.state.round.cardId,hand[3]);equal(invited.body.state.stats.totalCompleted,21);ok(G.validateState(invited.body.state),'recipient can respond to a migrated four-card invitation');
}
// Mixed-version clients can finish legacy draws. A v2 draw can never be
// advanced by an old client that can't show the selected variation.
{
 const mixed=new MemoryStore(),rng=[];
 for(const [token,actor] of [[tokenA,'a'],[tokenB,'b']]){
  const hash=await sha256('device:'+token);mixed.members.set(hash,{token_hash:hash,room_id:roomId,actor});
 }
 const mixedHandler=createHandler({G:{...G,randomInt:n=>{rng.push(n);return n===20?1:n;}},store:mixed,rateSecret:'fixture',clock:()=>new Date(at)});
 const deliver=async(body,token=tokenA)=>{
  const response=await mixedHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  return {status:response.status,body:await response.json()};
 };
 const action=(type,id,gameVersion=2,roundId='onde-1',extra={})=>({op:'action',gameVersion,requestId:uuid(id),action:{type,roundId,...extra}});
 equal((await deliver({op:'state',gameVersion:'2'})).status,400);
 equal((await deliver(action('ROLL_VARIANT',500))).status,409);equal(rng,[],'early third D6 cannot consume RNG or a ticket');
 const draw=await deliver(action('ROLL_CATEGORY',501));equal(draw.status,200);equal(draw.body.roll,{kind:4,value:4});equal(draw.body.state.round.catalogueVersion,2);
 const stale=await deliver({op:'state'});equal(stale.status,409);equal(stale.body.error.code,'upgrade_required');equal(stale.body.state,undefined);
 equal((await deliver({op:'state'},tokenB)).body.state.round.hand,[],'an old recipient still sees a neutral private round');
 equal((await deliver(action('ROLL_CARD',502,1))).status,409);equal(rng,[4],'outdated client does not advance the private round');
 const drawn=await deliver(action('ROLL_CARD',502));equal(drawn.status,200);equal(drawn.body.roll,{kind:6,value:6});equal(drawn.body.state.phase,'variant');
 const hidden=await deliver({op:'state',gameVersion:2},tokenB);equal(hidden.body.state.round.cardId,null);equal(hidden.body.state.round.variantRoll,undefined);
 equal((await deliver(action('ROLL_VARIANT',503),tokenB)).status,409);equal(rng,[4,6],'other player cannot roll a private variation');
 equal((await deliver(action('ROLL_VARIANT',503,2,'onde-1',{value:2}))).status,400);
 equal((await deliver(action('SEND',503))).status,409);equal(mixed.outbox,[]);
 const variantAction=action('ROLL_VARIANT',504),variant=await deliver(variantAction);
 equal(variant.status,200);equal(variant.body.roll,{kind:6,value:6});equal(variant.body.state.phase,'draft');equal(variant.body.state.round.variantRoll,6);equal(variant.body.quota.remaining,0);
 const revision=mixed.revision;
 equal(await deliver(variantAction),variant,'same request returns the committed third face');
 equal((await deliver(action('ROLL_VARIANT',505))).status,409);equal(mixed.revision,revision);equal(rng,[4,6,6]);
 equal((await deliver(action('REROLL_CARD',506))).status,409,'new turns use the D20 without another card reroll');
 const sent=await deliver(action('SEND',507));equal(sent.status,200);equal(mixed.outbox,[{actor:'b',kind:'invitation'}]);
 const oldInvitation=await deliver({op:'state'},tokenB);equal(oldInvitation.status,409);equal(oldInvitation.body.error.code,'upgrade_required');equal(oldInvitation.body.state,undefined);
 const invitation=await deliver({op:'state',gameVersion:2},tokenB);equal(invitation.status,200);equal(invitation.body.state.round.variantRoll,6);
 const before=clone(mixed.state),deck=before.round.hand.filter(id=>id!==before.round.cardId).reverse();
 deck.splice(before.round.cardRoll-1,0,before.round.cardId);before.round.hand=deck;
 equal(projectState(G,before,'b'),invitation.body.state,'the recipient cannot distinguish private challenge permutations');
 equal((await deliver(action('CHALLENGE',508),tokenB)).status,200);
 const d20=await deliver(action('ROLL_DEFENSE',509),tokenB);equal(d20.status,200);equal(d20.body.roll,{kind:20,value:1});
 const accepted=await deliver(action('ACCEPT',510),tokenB);equal(accepted.status,200);equal(accepted.body.state.tasks[0].variantRoll,6);equal(G.getVariant(accepted.body.state.tasks[0]),G.getVariant(variant.body.state.round));
 equal(mixed.used.size,1,'only the category roll consumed a ticket');
 equal((await deliver(action('NEW_ROUND',511),tokenB)).status,200);
 equal((await deliver({op:'state'},tokenB)).body.error.code,'upgrade_required','old UI cannot render a still-active v2 task');
 const check={taskId:'onde-1',checked:true};
 equal((await deliver(action('TOGGLE_TASK_CHECK',512,2,'onde-2',check))).status,200);
 const completed=await deliver(action('TOGGLE_TASK_CHECK',513,2,'onde-2',check),tokenB);equal(completed.status,200);equal(completed.body.state.stats.totalCompleted,1);
 const oldSummary=await deliver({op:'state'},tokenB);equal(oldSummary.status,200);equal(oldSummary.body.state.history,[]);equal(oldSummary.body.state.stats.totalCompleted,1);
 const oldDraw=await deliver(action('ROLL_CATEGORY',514,1,'onde-2'),tokenB);equal(oldDraw.status,200);equal(oldDraw.body.roll,{kind:6,value:6});equal(oldDraw.body.state.round.hand.length,4);
 const oldReceipt=await deliver(action('ROLL_CATEGORY',514,2,'onde-2'),tokenB);equal(oldReceipt.status,409);equal(oldReceipt.body.error.code,'request_id_reused');
 const oldCard=await deliver(action('ROLL_CARD',515,2,'onde-2'),tokenB);equal(oldCard.status,200);equal(oldCard.body.roll,{kind:4,value:4});equal(oldCard.body.state.phase,'draft');
}
const store=new MemoryStore();let now=at;
const rngCalls=[];
const handler=createHandler({G:{...G,randomInt:sides=>{rngCalls.push(sides);return G.randomInt(sides);}},store,rateSecret:'test-rate-secret',clock:()=>new Date(now),push:{ensurePushConfig:async()=>({publicKey:'test-vapid-public'}),saveSubscription:async()=>({subscribed:true}),flushPushOutbox:async()=>({})}});
async function request(body,token=tokenA,extra={}){
 const response=await handler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://cgiy.github.io',...extra},body:JSON.stringify(body)}));
 return {status:response.status,body:await response.json(),headers:response.headers};
}
let response=await request({op:'create'});equal(response.status,404);response=await request({op:'join',code:'anything'});equal(response.status,404);
response=await request({op:'state'});equal(response.status,401);equal(response.body.state,undefined);
response=await request({op:'login',username:'alpha',password:'not-the-fixture-password'});equal(response.status,401);ok(!JSON.stringify(response.body).includes('not-the-fixture-password'));
store.blockRates=true;const loginBefore=store.loginChecks;response=await request({op:'login',username:'alpha',password:'test-only-password'});equal(response.status,429);equal(store.loginChecks,loginBefore,'rate limit happens before password verification');store.blockRates=false;
response=await request({op:'login',username:' ÁLPHÀ ',password:'test-only-password'});equal(response.status,200);equal(response.body.connection.actor,'a');equal(response.body.connection.token,tokenA);equal(response.body.roomId,roomId);equal(response.body.serverTime,at,'snapshot uses authoritative clock');ok(G.validateState(response.body.state));
response=await request({op:'login',username:'bravo',password:'test-only-password'},tokenB);equal(response.status,200);equal(response.body.actor,'b');
response=await request({op:'login',username:'bravo',password:'test-only-password'},tokenA);equal(response.status,409,'existing device cannot change account');
response=await request({op:'state'});equal(response.status,200);equal(response.body.actor,'a');ok(!JSON.stringify(response.body).includes(tokenA),'state never repeats the bearer');
response=await request({op:'push_config'});equal(response.body,{vapidPublicKey:'test-vapid-public'});
response=await request({op:'subscribe',subscription:{test:true}});equal(response.status,200);
response=await request({op:'action',requestId:uuid(1),action:{type:'ROLL_CATEGORY',roundId:'onde-1',value:6}});equal(response.status,400,'caller cannot choose the category face');
response=await request({op:'action',requestId:uuid(2),action:{type:'RESET',roundId:'onde-1'}});equal(response.status,400,'caller cannot reset the shared room');
store.forceRace=true;response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body.roll.kind,6);ok(response.body.roll.value>=1&&response.body.roll.value<=6);equal(response.body.state.round.hand.length,4);equal(store.used.size,1);equal(response.body.quota.remaining,0);const originalResponse=clone(response.body),afterRevision=store.revision;
response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body,originalResponse,'request retry replays identical authoritative RNG/result');equal(store.revision,afterRevision);equal(store.used.size,1);
now='2026-11-02T15:00:10.000Z';response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body.serverTime,now,'receipt uses fresh server clock');equal(response.body.roll,originalResponse.roll,'receipt retains exact random outcome');equal(response.body.state,originalResponse.state,'receipt retains exact action snapshot');now=at;
response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CARD',roundId:'onde-1'}});equal(response.status,409,'request ID cannot be reused for a different operation');
response=await request({op:'state'},tokenB);equal(response.status,200);equal(response.body.state.phase,'category');equal(response.body.state.round.hand,[]);equal(response.body.state.round.categoryId,null);equal(response.body.state.seen,{});
response=await request({op:'action',requestId:uuid(4),action:{type:'ROLL_CARD',roundId:'onde-1'}},tokenB);equal(response.status,409);equal(response.body.state.round.cardId,null,'rejected wrong actor never receives private state');
response=await request({op:'action',requestId:uuid(5),action:{type:'ROLL_CARD',roundId:'onde-1'}});equal(response.status,200);equal(response.body.roll.kind,4);let secretCard=store.state.round.cardId;
response=await request({op:'state'},tokenB);ok(!JSON.stringify(response.body).includes(secretCard));
const preReroll=clone(store.state),beforeRerollRevision=store.revision,beforeRerollRng=rngCalls.length;
response=await request({op:'action',requestId:uuid(50),action:{type:'REROLL_CARD',roundId:'onde-1'}},tokenB);equal(response.status,409);equal(store.revision,beforeRerollRevision);equal(rngCalls.length,beforeRerollRng);equal(response.body.state.round.cardId,null);
response=await request({op:'action',requestId:uuid(51),action:{type:'REROLL_CARD',roundId:'onde-1',value:4}});equal(response.status,400,'caller cannot choose the replacement D6');
response=await request({op:'action',requestId:uuid(52),action:{type:'REROLL_CARD',roundId:'onde-1'}});equal(response.status,200);equal(response.body.roll.kind,4);equal(rngCalls.at(-1),3);ok(response.body.roll.value!==preReroll.round.cardRoll);ok(store.state.round.cardId!==secretCard);equal(store.state.round.cardRerolled,true);equal(store.used.size,1);equal(response.body.quota.remaining,0,'reroll remains available after its category draw quota was consumed');equal(store.state.stats,preReroll.stats);equal(store.outbox.length,0);equal(store.calls.filter(call=>call.name==='desir_commit').at(-1).args.p_consume_ticket,false);secretCard=store.state.round.cardId;
const rerollResponse=clone(response.body),rerollRevision=store.revision,rerollRng=rngCalls.length;
response=await request({op:'action',requestId:uuid(52),action:{type:'REROLL_CARD',roundId:'onde-1'}});equal(response.status,200);equal(response.body,rerollResponse,'same request replays the exact replacement card and D6');equal(store.revision,rerollRevision);equal(rngCalls.length,rerollRng,'replay never draws another random face');equal(store.used.size,1);
response=await request({op:'action',requestId:uuid(53),action:{type:'REROLL_CARD',roundId:'onde-1'}});equal(response.status,409,'a fresh request cannot obtain a second reroll');equal(store.revision,rerollRevision);equal(rngCalls.length,rerollRng);
response=await request({op:'action',requestId:uuid(54),action:{type:'CHALLENGE_DRAFT',roundId:'onde-1'}});equal(response.status,409,'initiator cannot recover D20 after reroll');
response=await request({op:'state'},tokenB);equal(response.body.state.round.cardId,null);equal(response.body.state.round.cardRerolled,false);ok(!JSON.stringify(response.body).includes(secretCard));ok(!JSON.stringify(response.body).includes(preReroll.round.cardId));
response=await request({op:'action',requestId:uuid(6),action:{type:'SEND',roundId:'onde-1'}});equal(response.status,200);equal(store.outbox.length,1);equal(store.outbox[0],{actor:'b',kind:'invitation'});
response=await request({op:'action',requestId:uuid(6),action:{type:'SEND',roundId:'onde-1'}});equal(response.status,200);equal(store.outbox.length,1,'no duplicate outbox event');
response=await request({op:'state'},tokenB);equal(response.body.state.round.cardId,secretCard);ok(G.validateState(response.body.state));
response=await request({op:'action',requestId:uuid(55),action:{type:'REROLL_CARD',roundId:'onde-1'}});equal(response.status,409,'sent invitation cannot be rerolled');
response=await request({op:'action',requestId:uuid(56),action:{type:'CHALLENGE',roundId:'onde-1'}},tokenB);equal(response.status,200);equal(response.body.state.phase,'challenge','recipient D20 remains available through HTTP');
response=await request({op:'action',requestId:uuid(7),action:{type:'ACCEPT',roundId:'onde-1'}},tokenB);equal(response.status,200);equal(response.body.state.tasks.length,1);equal(response.body.state.tasks[0].createdAt,at);equal(response.body.state.tasks[0].expiresAt,'2026-11-02T21:00:00.000Z');equal(store.outbox.length,1,'no unsolicited ready notification');
now='2026-11-02T21:00:00.000Z';response=await request({op:'state'});equal(response.status,200);equal(response.body.state.tasks.length,0);equal(response.body.state.round.status,'expired');equal(response.body.state.stats.totalCompleted,0);
response=await request({op:'action',requestId:uuid(8),action:{type:'TOGGLE_TASK_CHECK',roundId:'onde-1',taskId:'onde-1',checked:true}},tokenB);equal(response.status,409);equal(response.body.state.stats.totalCompleted,0,'expiry cannot be bypassed by a late checkbox');
response=await request({op:'state'},tokenA,{Origin:'https://unrelated.example'});equal(response.status,403);equal(response.headers.get('Access-Control-Allow-Origin'),null);
const badHandler=createHandler({G,store:{rpc:async()=>{throw new Error('SECRET-DATABASE-ERROR');}},rateSecret:'test'});const bad=await badHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json'},body:JSON.stringify({op:'state'})}));equal(bad.status,503);ok(!(await bad.text()).includes('SECRET-DATABASE-ERROR'));
const cronCalls=[];const cronHandler=createHandler({G,store,rateSecret:'test',push:{isPushCronAuthorized:async(_store,header)=>header==='test-only-cron-secret',enqueueScheduled:async()=>{cronCalls.push('enqueue');},flushPushOutbox:async()=>{cronCalls.push('flush');}}});
let cron=await cronHandler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"drain_push"}'}));equal(cron.status,401);equal(cronCalls,[],'cron is never public');
cron=await cronHandler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json','x-desir-cron':'test-only-cron-secret'},body:'{"op":"drain_push"}'}));equal(cron.status,202);equal(cronCalls,['enqueue','flush']);ok(!(await cron.text()).includes('test-only-cron-secret'));
let canceled=false;const oversized=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(7000));},cancel(){canceled=true;}});
const tooLarge=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenA},body:oversized,duplex:'half'}));equal(tooLarge.status,413);equal(canceled,true,'oversized stream is stopped before buffering the whole body');
const preflight=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:'https://cgiy.github.io'}}));equal(preflight.status,204);equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://cgiy.github.io');
console.log(`Dés·ir backend: ${checks} privacy/auth/RNG/CAS/idempotency/quota/expiry assertions passed.`);
