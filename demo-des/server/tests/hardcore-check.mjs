import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHandler} from '../functions/desir-game/server.mjs';
import {createHardcore,parseHardcoreAction,reduceHardcore,normalizeHardcore,projectHardcore,handleHardcore} from '../functions/desir-game/hardcore.mjs';
import {sha256,HttpError} from '../functions/desir-game/model.mjs';
const require=createRequire(import.meta.url),G=require('../../dev/src/onde-app-core.js');
let checks=0;const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);},ok=(a,message)=>{checks++;assert.ok(a,message);},bad=(fn,code)=>{checks++;assert.throws(fn,error=>error instanceof HttpError&&(!code||error.code===code));};
const uuid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');let ids=1000,randomCalls=0;
const at=Date.parse('2026-11-05T14:00:00.000Z'),options={uuid:()=>uuid(++ids),randomInt:()=>{randomCalls++;return 12;}},clone=structuredClone;
function action(session,actor,type,fields={},now=at){return reduceHardcore(session,actor,{type,...(type==='CREATE'?{}:{sessionId:session.id}),...fields},now,options);}
function ready(){let s=createHardcore(at,uuid(1));s=action(s,'a','OPT_IN',{enabled:true});return action(s,'b','OPT_IN',{enabled:true});}
function hold(s,actor,id,sequence=1,now=at){return action(s,actor,'PRESS',{pressId:uuid(id),sequence,held:true},now);}
function release(s,actor,id,sequence=2,now=at){return action(s,actor,'PRESS',{pressId:uuid(id),sequence,held:false},now);}
function schedule(s=ready(),now=at){s=hold(s,'a',2,1,now);s=hold(s,'b',3,1,now);const preparationId=s.preparationId;s=action(s,'a','ACK',{preparationId,pressId:uuid(2)},now);return action(s,'b','ACK',{preparationId,pressId:uuid(3)},now);}
for(const type of ['CREATE','OPT_IN','PRESS','ACK','ATTACK','CANCEL'])for(const extra of ['actor','value','roomId','damage','gameVersion','at'])bad(()=>parseHardcoreAction({type,sessionId:uuid(1),[extra]:1}),'invalid_action');
for(const input of [false,[],{},'PRESS',{type:'PRESS',sessionId:uuid(1),pressId:uuid(2),sequence:0,held:true},{type:'ATTACK',sessionId:uuid(1),slot:3}])bad(()=>parseHardcoreAction(input),'invalid_action');
eq(parseHardcoreAction(null),null);eq(parseHardcoreAction({type:'CREATE'}),{type:'CREATE'});
{
 let s=createHardcore(at,uuid(1));bad(()=>hold(s,'a',2),'not_ready');s=action(s,'a','OPT_IN',{enabled:true});bad(()=>hold(s,'a',2),'not_ready');
 s=action(s,'b','OPT_IN',{enabled:true});s=hold(s,'a',2);eq(s.status,'waiting','one actor never starts');eq(s.actionRoll,null);eq(s.boss.damageTotal,0);
 s=release(s,'a',2);s=hold(s,'b',3);eq(s.status,'waiting','nonoverlapping holds never prepare');
 s=hold(s,'a',4);eq(s.status,'preparing');const prep=s.preparationId;bad(()=>action(s,'a','ACK',{preparationId:prep,pressId:uuid(2)}),'stale_preparation');
 s=action(s,'a','ACK',{preparationId:prep,pressId:uuid(4)});eq(s.status,'preparing','one ACK never schedules');eq(s.actionRoll,null);
 s=release(s,'b',3);eq(s.status,'waiting');bad(()=>action(s,'b','ACK',{preparationId:prep,pressId:uuid(3)}),'stale_preparation');
}
{
 let s=ready();s=release(s,'a',2);s=hold(s,'a',2);eq(s.presses.a,null,'release arriving before first press tombstones its ID');
 s=hold(s,'a',4,3);s=release(s,'a',4,2);eq(s.presses.a.held,true,'older sequence cannot close newer state');s=release(s,'a',4,4);s=hold(s,'a',4,5);eq(s.presses.a.held,false,'new sequence cannot reopen a closed ID');
 const before=clone(s);s=hold(s,'a',5);eq(before.presses.a.held,false,'reducers do not mutate source');
 s=hold(s,'a',5,1,at+100);eq(s.presses.a.expiresAt,new Date(at+2000).toISOString(),'same-sequence retry does not extend lease');
 s=hold(s,'a',5,2,at+100);eq(s.presses.a.expiresAt,new Date(at+2100).toISOString());
 s=normalizeHardcore(s,at+2101);eq(s.presses.a.held,false);s=hold(s,'a',5,3,at+2102);eq(s.presses.a.held,false,'expired press ID cannot be renewed');
}
{
 randomCalls=0;let s=schedule();eq(randomCalls,1);eq(s.status,'scheduled');eq(s.actionRoll.value,12);eq(s.actionRoll.startAt,new Date(at+1100).toISOString());
 eq(projectHardcore(s,at).actionRoll.value,12,'committed face is delivered before its future start for synchronized animation');eq(projectHardcore(s,at).actionRoll.actionId,'hardcore-12');eq(projectHardcore(s,at)._selected,undefined);eq(projectHardcore(s,at)._closed,undefined);
 const first=s.actionRoll.id;s=release(s,'a',2,2,at+100);eq(s.status,'waiting');eq(s.actionRoll,null);
 s=hold(s,'a',4,1,at+200);const prep=s.preparationId;s=action(s,'a','ACK',{preparationId:prep,pressId:uuid(4)},at+200);s=action(s,'b','ACK',{preparationId:prep,pressId:uuid(3)},at+200);eq(randomCalls,1,'rescheduling cannot reroll');eq(s.actionRoll.id,first);eq(s.actionRoll.value,12);
 s=release(s,'a',4,2,at+1300);eq(s.status,'scheduled','release after start permits committed roll to finish');eq(projectHardcore(s,at+1300).actionRoll.value,12);
 bad(()=>action(s,'a','ATTACK',{slot:1},at+1400),'invalid_phase');s=normalizeHardcore(s,at+3500);eq(s.status,'combat');eq(s.boss.damageTotal,0,'action selector never counts damage');
}
{
 let s=schedule();s=normalizeHardcore(s,at+600);s=normalizeHardcore(s,at+2100);eq(s.status,'scheduled','lease expiry after committed start cannot erase the roll');eq(projectHardcore(s,at+3400).status,'combat');
 // A late second ACK must still renew both leases beyond scheduled start.
 s=ready();s=hold(s,'a',2);s=hold(s,'b',3,1,at+1000);const prep=s.preparationId;s=action(s,'a','ACK',{preparationId:prep,pressId:uuid(2)},at+1500);s=action(s,'b','ACK',{preparationId:prep,pressId:uuid(3)},at+1500);s=normalizeHardcore(s,at+2001);eq(s.status,'waiting','lease that expires before start cancels schedule');
 s=schedule();s=action(s,'a','OPT_IN',{enabled:false},at+100);eq(s.status,'cancelled');eq(s.optedIn,{a:false,b:false});bad(()=>hold(s,'b',8),'invalid_phase');
 eq(normalizeHardcore(schedule(),at+1800001).status,'expired');
}
{
 let s=schedule();s=normalizeHardcore(s,at+3400);const attackAt=at+4000,values=[20,20,20,1];let index=0;const rng={...options,randomInt:()=>values[index++]};
 for(const [actor,slot] of [['a',1],['b',1],['a',2]])s=reduceHardcore(s,actor,{type:'ATTACK',sessionId:s.id,slot},attackAt,rng);
 s=normalizeHardcore(s,attackAt+3400);eq(s.boss.damageTotal,60);eq(s.boss.hpRemaining,0);eq(s.boss.outcome,'won');eq(s.status,'combat','early win preserves fourth slot');eq(s.boss.attacksUsed,{a:2,b:1});
 const before=clone(s);s=reduceHardcore(s,'a',{type:'ATTACK',sessionId:s.id,slot:2},attackAt+3400,rng);eq(s.attackLedger,before.attackLedger,'same slot is never drawn twice under new request IDs');eq(index,3);
 s=reduceHardcore(s,'b',{type:'ATTACK',sessionId:s.id,slot:2},attackAt+3400,rng);eq(s.attackLedger.length,4);eq(s.boss.damageTotal,60,'queued fourth damage waits for common impact');s=normalizeHardcore(s,attackAt+6800);eq(s.status,'won');eq(s.boss.damageTotal,61);eq(s.boss.hpRemaining,0);bad(()=>action(s,'a','ATTACK',{slot:1},attackAt+6801),'invalid_phase');
 const next=action(s,'a','CREATE',{},attackAt+7000);ok(next.id!==s.id);eq(next.optedIn,{a:false,b:false});eq(next.attackLedger,[]);
}
for(const values of [[20,20,7,1],[20,20,6,1],[20,20,20,20]]){
 let s=schedule(),i=0;for(const [actor,slot]of [['a',1],['b',1],['a',2],['b',2]])s=reduceHardcore(s,actor,{type:'ATTACK',sessionId:s.id,slot},at+4000,{...options,randomInt:()=>values[i++]});
 s=normalizeHardcore(s,at+7400);eq(s.boss.damageTotal,values.reduce((a,b)=>a+b));eq(s.status,values.reduce((a,b)=>a+b)>=48?'won':'lost');
}
// Flooding unknown release IDs cannot grow the operational state indefinitely;
// releasing the actually held button remains possible at the capacity boundary.
{
 let s=hold(ready(),'a',9999);s._closed.a=Array.from({length:512},(_,i)=>uuid(i+20000));
 bad(()=>release(s,'a',9998),'session_press_limit');s=release(s,'a',9999);eq(s.presses.a.held,false);eq(s._closed.a.length,513);
}
// Exact distribution, no Monte Carlo approximation.
let wins48=0,wins49=0;for(let a=1;a<=20;a++)for(let b=1;b<=20;b++)for(let c=1;c<=20;c++)for(let d=1;d<=20;d++){if(a+b+c+d>=48)wins48++;if(a+b+c+d>=49)wins49++;}eq(wins48,51625);eq(wins49,46900);

const roomId=uuid(100),tokenA=Buffer.alloc(32,1).toString('base64url'),tokenB=Buffer.alloc(32,2).toString('base64url');
class MemoryStore{
 constructor(){this.state=null;this.revision=0;this.receipts=new Map();this.members=new Map();this.enabled=true;this.calls=[];this.race=false;}
 async rpc(name,p){this.calls.push(name);
  if(name==='desir_rate_limit')return true;
  if(name==='desir_hardcore_auth')return this.members.get(p.p_token_hash)||null;
  if(name==='desir_hardcore_get')return {enabled:this.enabled,state:clone(this.state),revision:this.revision};
  if(name==='desir_hardcore_receipt'){const old=this.receipts.get(p.p_actor+p.p_request_id);return {kind:old?old===p.p_payload_hash?'replayed':'mismatch':'missing'};}
  if(name==='desir_hardcore_commit'){
   const key=p.p_actor+p.p_request_id,old=this.receipts.get(key);if(old)return {kind:old===p.p_payload_hash?'replayed':'mismatch',state:clone(this.state),revision:this.revision};
   if(!this.enabled)return {kind:'disabled'};
   if(this.race){this.race=false;this.revision++;return {kind:'conflict'};}
   if(p.p_expected_revision!==this.revision)return {kind:'conflict'};
   this.state=clone(p.p_next_state);this.revision++;this.receipts.set(key,p.p_payload_hash);return {kind:'applied',state:clone(this.state),revision:this.revision};
  }throw Error('Unexpected normal RPC '+name);
 }
}
const store=new MemoryStore();store.members.set(await sha256('device:'+tokenA),{roomId,actor:'a'});store.members.set(await sha256('device:'+tokenB),{roomId,actor:'b'});
let now=at;const handler=createHandler({G,store,rateSecret:'test-only',clock:()=>new Date(now)});
async function deliver(action=null,actor='a',id=++ids,extra={}){
 const response=await handler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+(actor==='a'?tokenA:tokenB),'Content-Type':'application/json',Origin:'https://cgiy.github.io'},body:JSON.stringify({op:'hardcore',gameVersion:4,action,...(action?{requestId:uuid(id)}:{}),...extra})}));
 return {status:response.status,body:await response.json()};
}
eq((await deliver()).body.session,null);const created=await deliver({type:'CREATE'},'a',500);eq(created.status,200);const sessionId=created.body.session.id;eq(created.body.actor,'a');
const replay=await deliver({type:'CREATE'},'a',500);eq(replay.body.session.id,sessionId);eq(replay.body.revision,created.body.revision,'receipt replay creates no new revision');eq((await deliver({type:'CANCEL',sessionId},'a',500)).status,409,'same request ID cannot change payload');
for(const actor of ['a','b'])eq((await deliver({type:'OPT_IN',sessionId,enabled:true},actor)).status,200);
await deliver({type:'PRESS',sessionId,pressId:uuid(2),sequence:1,held:true},'a');eq((await deliver()).body.session.status,'waiting');
await deliver({type:'PRESS',sessionId,pressId:uuid(3),sequence:1,held:true},'b');let prep=(await deliver()).body.session.preparationId;
await deliver({type:'ACK',sessionId,preparationId:prep,pressId:uuid(2)},'a');const scheduled=await deliver({type:'ACK',sessionId,preparationId:prep,pressId:uuid(3)},'b');eq(scheduled.body.session.status,'scheduled');ok(Number.isInteger(scheduled.body.session.actionRoll.value)&&scheduled.body.session.actionRoll.value>=1&&scheduled.body.session.actionRoll.value<=20,'committed outcome is available before scheduled start');
now=at+3400;const views=await Promise.all([deliver(null,'a'),deliver(null,'b')]);eq(views[0].body.session,views[1].body.session,'both phones receive identical authoritative outcome and boss');
store.race=true;let result=await deliver({type:'ATTACK',sessionId,slot:1},'a',700);eq(result.status,200,'CAS retries a concurrent revision');eq(result.body.session.attackLedger.length,1);result=await deliver({type:'ATTACK',sessionId,slot:1},'a',700);eq(result.body.session.attackLedger.length,1,'lost response replay does not add damage');
await Promise.all([deliver({type:'ATTACK',sessionId,slot:2},'a'),deliver({type:'ATTACK',sessionId,slot:1},'b')]);result=await deliver({type:'ATTACK',sessionId,slot:2},'b');eq(result.body.session.attackLedger.length,4,'racing different slots both survive CAS');
now=at+7000;result=await deliver();eq(result.body.session.boss.attacksUsed,{a:2,b:2});eq(result.body.session.boss.damageTotal,result.body.session.attackLedger.reduce((s,h)=>s+h.value,0));eq((await deliver({type:'ATTACK',sessionId,slot:3})).status,400);
const oldRevision=result.body.revision;const replaced=await deliver({type:'CREATE'});ok(replaced.body.revision>oldRevision);ok(replaced.body.session.id!==sessionId);eq((await deliver({type:'ATTACK',sessionId,slot:1})).status,409,'old session cannot mutate replacement');
eq((await deliver(null,'a',10,{actor:'b'})).status,400,'identity overrides rejected');store.enabled=false;eq((await deliver()).status,404,'server feature switch checked for reads');store.enabled=true;store.members.delete(await sha256('device:'+tokenA));eq((await deliver()).status,401,'revoked token immediately denied');
ok(!store.calls.some(name=>['desir_get_session','desir_commit','desir_expire_room','desir_quota_status'].includes(name)),'live traffic leaves normal game and quota state untouched');
// Exercise the complete HTTP handler: a reset between CREATE's read and commit
// must not be undone by its CAS retry, including an originally empty live row.
for(const initial of [null,createHardcore(at,uuid(900)),{...createHardcore(at,uuid(901)),status:'cancelled'}]){
 const resetRace=new MemoryStore();resetRace.state=clone(initial);resetRace.revision=initial?17:0;
 resetRace.members.set(await sha256('device:'+tokenA),{roomId,actor:'a'});
 const original=resetRace.rpc.bind(resetRace);let commits=0;
 resetRace.rpc=async(name,p)=>{
  if(name==='desir_hardcore_commit'&&++commits===1){
   resetRace.state=null;resetRace.revision++;resetRace.receipts.clear();return {kind:'conflict'};
  }
  return original(name,p);
 };
 const resetHandler=createHandler({G,store:resetRace,rateSecret:'test-only',clock:()=>new Date(at)});
 const create=async(id)=>{
  const response=await resetHandler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'application/json',Origin:'https://cgiy.github.io'},body:JSON.stringify({op:'hardcore',gameVersion:4,action:{type:'CREATE'},requestId:uuid(id)})}));
  return {status:response.status,body:await response.json()};
 };
 const stale=await create(902);
 eq(stale.status,409,'pre-reset CREATE is rejected by the full handler');eq(stale.body.error.code,'stale_session');
 eq(resetRace.state,null,'retry cannot recreate a cleared live session');eq(resetRace.revision,initial?18:1,'reset revision is not overwritten');
 eq(commits,1,'CREATE does not attempt a second commit after seeing the reset tombstone');eq(resetRace.receipts.size,0);
 const fresh=await create(903);
 eq(fresh.status,200,'a new request starting after reset may create a session');eq(fresh.body.session.status,'waiting');
 eq(fresh.body.revision,initial?19:2);eq(resetRace.receipts.size,1);
 const repeated=await create(903);eq(repeated.body,fresh.body,'post-reset CREATE still replays idempotently');eq(commits,2);
}
// Two ordinary CREATE requests race from the same empty revision. The losing
// request must still retry against the winner's nonempty session, not reject it.
{
 const concurrent=new MemoryStore();
 for(const [token,actor] of [[tokenA,'a'],[tokenB,'b']])concurrent.members.set(await sha256('device:'+token),{roomId,actor});
 const original=concurrent.rpc.bind(concurrent);let reads=0,release;
 const barrier=new Promise(resolve=>{release=resolve;});
 concurrent.rpc=async(name,p)=>{
  const result=await original(name,p);
  if(name==='desir_hardcore_get'&&reads<2){if(++reads===2)release();await barrier;}
  return result;
 };
 const concurrentHandler=createHandler({G,store:concurrent,rateSecret:'test-only',clock:()=>new Date(at)});
 const results=await Promise.all([[tokenA,910],[tokenB,911]].map(async([token,id])=>{
  const response=await concurrentHandler(new Request('https://example.supabase.co/functions/v1/desir-game',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://cgiy.github.io'},body:JSON.stringify({op:'hardcore',gameVersion:4,action:{type:'CREATE'},requestId:uuid(id)})}));
  return {status:response.status,body:await response.json()};
 }));
 eq(results.map(result=>result.status),[200,200],'ordinary concurrent CREATE requests both succeed');
 eq(results[0].body.session.id,results[1].body.session.id,'ordinary CREATE retry keeps the winning session');
 eq(concurrent.revision,2);eq(concurrent.receipts.size,2);eq(concurrent.state.status,'waiting');
}
// Server-side latency must be included in lease/start validation, including a
// CAS retry. Capturing the arrival timestamp before the database awaits is unsafe.
{
 const delayed=new MemoryStore();let clockAt=at+100;
 let s=ready();s=hold(s,'a',2);s=hold(s,'b',3);const preparationId=s.preparationId;s=action(s,'a','ACK',{preparationId,pressId:uuid(2)},at+100);delayed.state=s;
 const original=delayed.rpc.bind(delayed);delayed.rpc=async(name,p)=>{const result=await original(name,p);if(name==='desir_hardcore_get')clockAt=at+2100;return result;};
 checks++;await assert.rejects(()=>handleHardcore({store:delayed,context:{roomId,actor:'b'},action:{type:'ACK',sessionId:s.id,preparationId,pressId:uuid(3)},requestId:uuid(800),now:()=>clockAt,randomInt:()=>1}),error=>error.code==='stale_preparation');eq(delayed.state.actionRoll,null,'expired ACK rejected after a slow DB read');
 const racing=new MemoryStore();racing.state=s;clockAt=at+100;racing.race=true;const orig=racing.rpc.bind(racing);racing.rpc=async(name,p)=>{const result=await orig(name,p);if(name==='desir_hardcore_commit')clockAt=at+2100;return result;};
 checks++;await assert.rejects(()=>handleHardcore({store:racing,context:{roomId,actor:'b'},action:{type:'ACK',sessionId:s.id,preparationId,pressId:uuid(3)},requestId:uuid(801),now:()=>clockAt,randomInt:()=>1}),error=>error.code==='stale_preparation');eq(racing.state.actionRoll,null,'CAS retry rechecks current lease time');
}
console.log('Dés·ir HARDCORE: '+checks+' simultaneous-hold, expiry, tombstone, privacy, attack, CAS, receipt, HTTP and probability assertions passed.');
