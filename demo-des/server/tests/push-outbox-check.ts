import * as webpush from 'npm:web-push@3.6.7';
import {ensurePushConfig,flushPushOutbox,isPushCronAuthorized,enqueueScheduled,saveSubscription} from '../functions/desir-game/push.ts';
import '../functions/desir-game/core.js';
import {createHandler} from '../functions/desir-game/server.mjs';
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const keyPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const b64=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const publicKey=b64(await crypto.subtle.exportKey('raw',keyPair.publicKey));
const auth=b64(crypto.getRandomValues(new Uint8Array(16)).buffer),vapid=webpush.generateVAPIDKeys();
const config={public_key:vapid.publicKey,private_key:vapid.privateKey,subject:'https://cgiy.github.io/desir/demo-des/'};
const event:any={id:'c4c8ba63-2aae-4a58-85a7-979cf3d877c6',room_id:'9e30a8d6-70fa-44c1-8d48-6d706fc3d021',target_actor:'b' as const,kind:'invitation',revision:7,attempts:1};
let state:any={phase:'pending',round:{awaiting:'b'}},subscriptions=[1,2].map(n=>({endpoint_hash:String(n).repeat(64),subscription:{endpoint:'https://web.push.apple.com/Qfixture'+n,keys:{p256dh:publicKey,auth}}}));
const cronToken='a'.repeat(43);
let drawReady=true,enqueueCount=0,ttls:number[]=[],cancelled=false,cancelDuringConfig=false;
const delivered=new Set<string>(),finishes:boolean[]=[],calls:string[]=[];
const store={
 async rpc(name:string,args:Record<string,unknown>):Promise<any>{
  if(name==='desir_claim_push_outbox')return [{...event}];
  if(name==='desir_record_push_delivery'){delivered.add(String(args.p_endpoint_hash));return null;}
  if(name==='desir_finish_push_event'){finishes.push(args.p_delivered as boolean);return null;}
  if(name==='desir_push_draw_ready')return drawReady;
  if(name==='desir_enqueue_scheduled_push'){assert(Object.keys(args).length===0,'Scheduling caller supplied a timestamp');enqueueCount++;return {drawAvailable:1,taskReminders:0};}
  throw Error('Unexpected RPC '+name);
 },
 async request(path:string,options?:{method?:string;body?:unknown}):Promise<any>{
  if(path.startsWith('desir_push_outbox?'))return cancelled?[]:[{expires_at:event.expires_at,desir_rooms:{state}}];
  if(path.startsWith('desir_push_config?')){if(cancelDuringConfig)cancelled=true;return [config];}
  if(path.startsWith('desir_push_scheduler_config?'))return [{cron_token:cronToken}];
  if(path.startsWith('desir_push_deliveries?'))return Array.from(delivered,endpoint_hash=>({endpoint_hash}));
  if(path.startsWith('desir_push_subscriptions?')&&options?.method==='DELETE'){subscriptions=subscriptions.filter(record=>!path.endsWith(record.endpoint_hash));return null;}
  if(path.startsWith('desir_push_subscriptions?'))return subscriptions;
  throw Error('Unexpected request '+path);
 }
};
const exposed=await ensurePushConfig(store);
assert(Object.keys(exposed).join(',')==='publicKey','VAPID private key exposed');
assert(await isPushCronAuthorized(store,cronToken),'Configured scheduler rejected');
for(const invalid of [undefined,null,'',cronToken+'x','b'.repeat(43),'a'.repeat(129)])assert(!await isPushCronAuthorized(store,invalid),'Invalid cron token accepted');
await enqueueScheduled(store);assert(enqueueCount===1,'Scheduler RPC missing');
const G=(globalThis as any).OndeGame,handlerStore={
 async rpc(name:string):Promise<any>{
  if(name==='desir_rate_limit')return true;
  if(name==='desir_get_session')return {member:{token_hash:'f'.repeat(64),room_id:event.room_id,actor:'b'},room:{id:event.room_id,state:G.createRoom(),revision:0},paired:true,quota:{remaining:1}};
  throw Error('Invalid subscription reached database RPC '+name);
 }
};
const handler=createHandler({G,store:handlerStore,push:{saveSubscription},rateSecret:'test-rate-secret',waitUntil:undefined});
const invalidResponse=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+b64(new Uint8Array(32).fill(1).buffer)},body:JSON.stringify({op:'subscribe',gameVersion:4,subscription:{endpoint:'https://127.0.0.1/private',keys:{p256dh:publicKey,auth}}})}));
assert(invalidResponse.status===400,'Unsafe push subscription was not a client error');
assert((await invalidResponse.json()).error.code==='invalid_subscription','Subscription error code was lost');
const previousFetch=globalThis.fetch;
let failSecond=true,removed=false;
globalThis.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
 const url=String(input);calls.push(url);
 assert(init?.redirect==='error','Push redirect could escape vendor allowlist');
 assert(init?.signal instanceof AbortSignal,'No push deadline');
 assert(init?.body instanceof Uint8Array,'Payload not encrypted binary');
 ttls.push(Number(new Headers(init?.headers).get('TTL')));
 if(removed)return Promise.resolve(new Response(null,{status:410}));
 if(url.endsWith('2')&&failSecond)return Promise.resolve(new Response(null,{status:503}));
 return Promise.resolve(new Response(null,{status:201}));
}) as typeof fetch;
try{
 const first=await flushPushOutbox(store,event.room_id);
 assert(first.sent===1&&first.failed===1&&finishes.at(-1)===false,'Partial failure incorrectly completed');
 failSecond=false;event.attempts=2;
 const second=await flushPushOutbox(store,event.room_id);
 assert(second.sent===1&&second.failed===0&&finishes.at(-1)===true,'Retry did not complete');
 assert(calls.length===3&&calls.filter(value=>value.endsWith('1')).length===1,'Successful endpoint sent twice');
 state={phase:'accepted',round:{awaiting:null as any}};
 const before=calls.length;
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===before&&finishes.at(-1)===true,'Obsolete invitation was sent');
 state={phase:'pending',round:{awaiting:'b',id:'onde-10'}};event.round_id='onde-9';
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===before,'Older round invitation leaked into current round');
 delete event.round_id;
 event.kind='draw-available';event.window_key='2026-11-02T18:00';event.expires_at=new Date(Date.now()+3600000).toISOString();
 drawReady=false;
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===before,'Blocked or spent draw was announced');
 drawReady=true;delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===before+2&&ttls.at(-1)!>0&&ttls.at(-1)!<=3600,'Ready draw missing or TTL exceeds window');
 event.kind='task-reminder';event.task_id='onde-4';event.expires_at=new Date(Date.now()+90*60000).toISOString();
 state={phase:'category',round:{from:'a'},tasks:[{id:'onde-4',checks:{a:false,b:true},expiresAt:event.expires_at}]};
 const beforeReminder=calls.length;
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeReminder,'Checked task triggered a reminder');
 state.tasks[0].checks.b=false;delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeReminder+2&&ttls.at(-1)!<=5400,'Due reminder missing or exceeded action deadline');
 event.expires_at=new Date(Date.now()-1000).toISOString();delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeReminder+2,'Expired reminder was sent');
 event.kind='invitation';delete event.expires_at;event.round_id='onde-9';
 state={version:2,lanes:{a:{phase:'pending',round:{id:'onde-9',awaiting:'b'}},b:{phase:'draft',round:{id:'onde-10',awaiting:null}}},tasks:[]};
 const beforeParallel=calls.length;delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeParallel+2,'Parallel invitation was discarded');
 state.lanes.a.phase='accepted';event.kind='confirmation';delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeParallel+4,'Parallel confirmation was discarded');
 state.lanes.a.round.id='onde-11';delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeParallel+4,'Obsolete parallel round was sent');
 // Protocol 4 sends notify the recipient only while this exact shared task exists.
 event.kind='invitation';event.round_id='onde-20';delete event.expires_at;
 state={version:2,lanes:{a:{phase:'category',round:{id:'onde-21'}},b:{phase:'category',round:{id:'onde-22'}}},pendingRounds:[],tasks:[{id:'onde-20',to:'b',expiresAt:new Date(Date.now()+3600000).toISOString()}]};
 delivered.clear();const beforeTask=calls.length;
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeTask+2,'Immediately queued task was not announced');
 state.tasks=[];delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeTask+2,'A refused/reset task was announced');
 state.tasks=[{id:'onde-20',to:'b',expiresAt:new Date(Date.now()+3600000).toISOString()}];
 cancelled=true;delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeTask+2,'An already claimed event cancelled by reset was sent');
 cancelled=false;cancelDuringConfig=true;delivered.clear();
 await flushPushOutbox(store,event.room_id);
 assert(calls.length===beforeTask+2,'Cancellation during subscription/configuration reads was ignored');
 cancelled=false;cancelDuringConfig=false;
 delete event.round_id;
 event.kind='invitation';delete event.expires_at;
 state={phase:'pending',round:{awaiting:'b'}};delivered.clear();subscriptions=subscriptions.slice(0,1);removed=true;
 const gone=await flushPushOutbox(store,event.room_id);
 assert(gone.removed===1&&gone.failed===0&&subscriptions.length===0,'Expired subscription not removed');
 console.log('Dés·ir push outbox: cron authorization, due scheduling, public-only VAPID config, partial retry without duplicate, stale rounds, draw readiness, task checks/deadlines and encrypted fetch pass. No device contacted.');
}finally{globalThis.fetch=previousFetch;}
