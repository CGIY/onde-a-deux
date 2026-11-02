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
function draft(from='a'){
 let s=G.createState();if(from==='b')s=act(s,'SWITCH_PLAYER',{player:'b'});
 const hand=G.cards.filter(c=>c.categoryId==='detente').slice(-4).map(c=>c.id);
 s=act(s,'ROLL_CATEGORY',{value:2,hand});return act(s,'ROLL_CARD',{value:1});
}
for(const from of ['a','b']){
 const to=G.otherPlayer(from),s=draft(from),p=projectState(G,s,to);
 ok(G.validateState(p),'private projection remains core-valid');
 equal(p.phase,'category');equal(p.round.categoryId,null);equal(p.round.cardId,null);equal(p.round.hp,null);equal(p.round.hand,[]);equal(p.seen,{});equal(p.round.from,from);
 ok(!JSON.stringify(p).includes(s.round.cardId),'private card ID is never delivered');
 const publicState=act(s,'SEND'),published=projectState(G,publicState,to);
 ok(G.validateState(published));equal(published.round.cardId,s.round.cardId);equal(published.round.hand[published.round.cardRoll-1],s.round.cardId);
 ok(published.round.hand.filter(id=>id!==s.round.cardId).every(id=>!s.round.hand.includes(id)),'unselected hand IDs are replaced, never delivered');
 const changedHand=clone(publicState);const alternatives=G.cards.filter(c=>c.categoryId===changedHand.round.categoryId&&c.id!==changedHand.round.cardId).slice(0,3).map(c=>c.id);let k=0;changedHand.round.hand=Array.from({length:4},(_,i)=>i===changedHand.round.cardRoll-1?changedHand.round.cardId:alternatives[k++]);
 ok(G.validateState(changedHand));equal(projectState(G,changedHand,to),published,'changing unrevealed IDs cannot change the recipient projection');
 const privateDefense=act(act(act(s,'CHALLENGE_DRAFT'),'ROLL_DRAFT_DEFENSE',{value:20,token:'p1'}),'ROLL_DRAFT_DEFENSE',{value:20,token:'p2'});
 const hidden=projectState(G,privateDefense,to);equal(hidden.history,[]);equal(hidden.round.cardId,null);
 const own=projectState(G,privateDefense,from);equal(own.round.cardId,s.round.cardId);equal(own.history.length,1);
 equal(s,clone(s),'projection is pure');
}
equal(normalizeUsername(' ÉLÈVE '),'eleve','accented account alias');equal(normalizeUsername('A\u0301LPHA'),'alpha','decomposed accent alias');
equal(validDeviceToken(tokenA),true);equal(validDeviceToken('short'),false);equal(validDeviceToken('a'.repeat(43)),false,'noncanonical base64 discarded');
equal((await sha256('device:'+tokenA)).length,64);ok(!(await privateBucket('test-secret','192.0.2.1')).includes('192.0.2.1'));
for(const forbidden of ['actor','value','hand','at','token','player','__proto__']){
 const action=JSON.parse(JSON.stringify({type:'ROLL_CATEGORY',roundId:'onde-1'}));Object.defineProperty(action,forbidden,{value:1,enumerable:true});
 checks++;assert.throws(()=>parseAction(action),HttpError,'reject client '+forbidden);
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
const store=new MemoryStore();let now=at;
const handler=createHandler({G,store,rateSecret:'test-rate-secret',clock:()=>new Date(now),push:{ensurePushConfig:async()=>({publicKey:'test-vapid-public'}),saveSubscription:async()=>({subscribed:true}),flushPushOutbox:async()=>({})}});
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
response=await request({op:'action',requestId:uuid(1),action:{type:'ROLL_CATEGORY',roundId:'onde-1',value:6}});equal(response.status,400,'caller cannot choose the D6');
response=await request({op:'action',requestId:uuid(2),action:{type:'RESET',roundId:'onde-1'}});equal(response.status,400,'caller cannot reset the shared room');
store.forceRace=true;response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body.roll.kind,6);ok(response.body.roll.value>=1&&response.body.roll.value<=6);equal(store.used.size,1);equal(response.body.quota.remaining,0);const originalResponse=clone(response.body),afterRevision=store.revision;
response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body,originalResponse,'request retry replays identical authoritative RNG/result');equal(store.revision,afterRevision);equal(store.used.size,1);
now='2026-11-02T15:00:10.000Z';response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}});equal(response.status,200);equal(response.body.serverTime,now,'receipt uses fresh server clock');equal(response.body.roll,originalResponse.roll,'receipt retains exact random outcome');equal(response.body.state,originalResponse.state,'receipt retains exact action snapshot');now=at;
response=await request({op:'action',requestId:uuid(3),action:{type:'ROLL_CARD',roundId:'onde-1'}});equal(response.status,409,'request ID cannot be reused for a different operation');
response=await request({op:'state'},tokenB);equal(response.status,200);equal(response.body.state.phase,'category');equal(response.body.state.round.hand,[]);equal(response.body.state.round.categoryId,null);equal(response.body.state.seen,{});
response=await request({op:'action',requestId:uuid(4),action:{type:'ROLL_CARD',roundId:'onde-1'}},tokenB);equal(response.status,409);equal(response.body.state.round.cardId,null,'rejected wrong actor never receives private state');
response=await request({op:'action',requestId:uuid(5),action:{type:'ROLL_CARD',roundId:'onde-1'}});equal(response.status,200);equal(response.body.roll.kind,4);const secretCard=store.state.round.cardId;
response=await request({op:'state'},tokenB);ok(!JSON.stringify(response.body).includes(secretCard));
response=await request({op:'action',requestId:uuid(6),action:{type:'SEND',roundId:'onde-1'}});equal(response.status,200);equal(store.outbox.length,1);equal(store.outbox[0],{actor:'b',kind:'invitation'});
response=await request({op:'action',requestId:uuid(6),action:{type:'SEND',roundId:'onde-1'}});equal(response.status,200);equal(store.outbox.length,1,'no duplicate outbox event');
response=await request({op:'state'},tokenB);equal(response.body.state.round.cardId,secretCard);ok(G.validateState(response.body.state));
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
