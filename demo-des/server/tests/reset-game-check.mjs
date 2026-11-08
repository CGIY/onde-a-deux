import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {applyAction,HttpError} from '../functions/desir-game/model.mjs';
import {createHardcore} from '../functions/desir-game/hardcore.mjs';
const packageDir=process.env.DESIR_PGLITE_DIR;
if(!packageDir)throw Error('Set DESIR_PGLITE_DIR to pinned PGlite 0.5.14 package directory.');
const {PGlite}=await import(pathToFileURL(path.join(packageDir,'dist/index.js')));
const {pgcrypto}=await import(pathToFileURL(path.join(packageDir,'dist/contrib/pgcrypto.js')));
const G=createRequire(import.meta.url)('../../dev/src/onde-app-core.js');
const db=new PGlite({extensions:{pgcrypto}}),roomId='10000000-0000-4000-8000-000000000100',otherId='10000000-0000-4000-8000-000000000200';
const uuid=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const copy=x=>structuredClone(x),json=x=>JSON.stringify(x);
let checks=0;
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
async function scalar(sql,args=[]){return (await db.query(sql,args)).rows[0].result;}
async function data(){return await scalar(`select jsonb_build_object(
 'rooms',(select jsonb_agg(to_jsonb(r) order by id) from public.desir_rooms r),
 'requests',(select jsonb_agg(to_jsonb(r) order by room_id,actor,request_id) from public.desir_requests r),
 'usage',(select jsonb_agg(to_jsonb(r) order by room_id,actor,window_key) from public.desir_draw_usage r),
 'live',(select jsonb_agg(to_jsonb(r) order by room_id) from public.desir_hardcore_sessions r),
 'liveRequests',(select jsonb_agg(to_jsonb(r) order by room_id,actor,request_id) from public.desir_hardcore_requests r),
 'outbox',(select jsonb_agg(to_jsonb(r) order by id) from public.desir_push_outbox r)
 ) as result`);}
async function preserved(){return await scalar(`select jsonb_build_object(
 'accounts',(select jsonb_agg(to_jsonb(r) order by actor) from public.desir_accounts r),
 'devices',(select jsonb_agg(to_jsonb(r) order by token_hash) from public.desir_devices r),
 'subscriptions',(select jsonb_agg(to_jsonb(r) order by endpoint_hash) from public.desir_push_subscriptions r),
 'deliveries',(select jsonb_agg(to_jsonb(r) order by event_id,endpoint_hash) from public.desir_push_deliveries r),
 'pushConfig',(select jsonb_agg(to_jsonb(r)) from public.desir_push_config r),
 'scheduler',(select jsonb_agg(to_jsonb(r)) from public.desir_push_scheduler_config r),
 'settings',(select jsonb_agg(to_jsonb(r)) from public.desir_hardcore_settings r),
 'rateLimits',(select jsonb_agg(to_jsonb(r) order by bucket) from public.desir_rate_limits r)
 ) as result`);}
const resetSql=await fs.readFile(new URL('../reset-game.sql',import.meta.url),'utf8');
async function reset(target=roomId,revision=55){
 await db.exec('begin');
 try{
  await db.query("select set_config('desir.reset_room',$1,true),set_config('desir.reset_revision',$2,true)",[target,revision===null?'':String(revision)]);
  await db.exec(resetSql);
  await db.exec('commit');
 }catch(error){await db.exec('rollback');throw error;}
}
async function rejected(target,revision,pattern){
 const before=await data();
 checks++;await assert.rejects(()=>reset(target,revision),pattern);
 eq(await data(),before,'failed reset has no effects');
}
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const name of ['schema.sql','push-schema.sql','hardcore-schema.sql'])await db.exec(await fs.readFile(new URL('../'+name,import.meta.url),'utf8'));
 const scheduler=await fs.readFile(new URL('../push-scheduler.sql',import.meta.url),'utf8');
 // Use the canonical scheduling SQL; only pg_cron/pg_net provisioning is omitted
 // because this isolated database never contacts the hosted application.
 await db.exec(scheduler.slice(scheduler.indexOf('create table if not exists public.desir_push_scheduler_config'),scheduler.indexOf('-- This sole privileged routine')));
 const at=await scalar("select to_char(now() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as result");
 let before=G.createRoom({at});
 function action(type,actor='a',extra={}){
  before=G.reduceRoom(before,{type,actor,roundId:before.lanes[actor].round.id,at,...extra});
  assert.ok(G.validateRoom(before),'valid reset fixture after '+type);
 }
 function draft(actor='a'){
  action('ROLL_CATEGORY',actor,{catalogueVersion:2,value:1,hand:G.drawHand(G.roomView(before,actor),1,2)});
  action('ROLL_CARD',actor,{value:1});action('ROLL_VARIANT',actor,{value:1});
 }
 draft();action('SEND','a',{directQueue:true});
 const completedId=before.tasks[0].id;
 action('TOGGLE_TASK_CHECK','a',{taskId:completedId,checked:true});action('TOGGLE_TASK_CHECK','b',{taskId:completedId,checked:true});
 draft();action('SEND','a',{directQueue:true});
 const taskId=before.tasks[0].id;
 draft('b');action('SEND','b'); // outstanding invitation from the archived flow
 before.players=[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}];
 before.prefs={reducedMotion:true,sound:true,discreet:false,reminder:false};
 before.favorites=[G.cards[0].id];
 before.joker={weekKey:'2026-W45',usedBy:'a'};
 before.dailyReroll={dateKey:G.parisDateKey(at),used:['a','b']};
 // Older persisted daily-card shapes are irrelevant to the reset; build a valid
 // populated one with the archived generator, which current API code never calls.
 before.daily=null;
 before.daily=G.drawDaily(before,at,()=>1);
 ok(G.validateRoom(before),'fixture validates before reset');
 ok(before.stats.totalCompleted>0&&before.tasks.length>0&&before.pendingRounds.length>0&&before.history.length>0,'fixture has counters and both task types');
 const old=copy(before),other={...G.createRoom({at}),sequence:99};
 await db.query('insert into public.desir_rooms(id,state,revision) values($1,$2,55),($3,$4,90)',[roomId,json(old),otherId,json(other)]);
 await db.query("insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash) values('a',$1,'alpha','Alpha',extensions.crypt('fixture-only',extensions.gen_salt('bf',4))),('b',$1,'bravo','Bravo',extensions.crypt('fixture-only',extensions.gen_salt('bf',4)))",[roomId]);
 await db.query("insert into public.desir_devices(token_hash,room_id,actor) values($1,$2,'a'),($3,$2,'b')",['a'.repeat(64),roomId,'b'.repeat(64)]);
 await db.query("insert into public.desir_push_subscriptions(endpoint_hash,token_hash,room_id,actor,endpoint,subscription) values($1,$2,$3,'a','https://fixture.invalid/push','{}')",['c'.repeat(64),'a'.repeat(64),roomId]);
 await db.query("insert into public.desir_push_config(public_key,private_key,subject) values($1,$2,'https://fixture.invalid')",['a'.repeat(87),'b'.repeat(43)]);
 await db.query("insert into public.desir_push_scheduler_config(endpoint_url,cron_token,publishable_key) values('https://fixture.supabase.co/functions/v1/desir-game',$1,'sb_publishable_fixture')",['c'.repeat(43)]);
 await db.exec("insert into public.desir_rate_limits(bucket,count,resets_at) values('fixture-security-limit',5,now()+interval '10 minutes')");
 const quota=await scalar('select public.desir_quota_window() as result');
 for(const [id,actor,num] of [[roomId,'a',1],[roomId,'b',2],[otherId,'a',3]]){
  await db.query('insert into public.desir_draw_usage(room_id,actor,window_key,draw_count) values($1,$2,$3,3)',[id,actor,quota.window]);
  await db.query("insert into public.desir_requests(room_id,actor,request_id,payload_hash,response) values($1,$2,$3,$4,'{\"old\":true}')",[id,actor,uuid(num),'d'.repeat(64)]);
  await db.query('insert into public.desir_hardcore_requests(room_id,actor,request_id,payload_hash) values($1,$2,$3,$4)',[id,actor,uuid(num),'e'.repeat(64)]);
 }
 const live=createHardcore(Date.parse(at),uuid(100));
 await db.query('insert into public.desir_hardcore_sessions(room_id,state,revision) values($1,$2,17),($3,$2,41)',[roomId,json(live),otherId]);
 for(const [num,kind,actor] of [[10,'invitation','b'],[11,'confirmation','a'],[12,'task-reminder','a'],[13,'draw-available','a']]){
  await db.query("insert into public.desir_push_outbox(id,room_id,round_id,target_actor,kind,revision,lease_until,dedupe_key,window_key,task_id,expires_at) values($1,$2,$3,$4,$5,55,now()+interval '1 minute',$6,$7,$8,now()+interval '4 hours')",[uuid(num),roomId,taskId,actor,kind,kind==='draw-available'?'window:'+quota.window:kind==='task-reminder'?'task:'+taskId:null,kind==='draw-available'?quota.window:null,kind==='task-reminder'?taskId:null]);
 }
 await db.query("insert into public.desir_push_outbox(id,room_id,target_actor,kind,revision) values($1,$2,'a','invitation',90)",[uuid(14),otherId]);
 await db.query('insert into public.desir_push_deliveries(event_id,endpoint_hash) values($1,$2)',[uuid(10),'f'.repeat(64)]);
 const preservedBefore=await preserved(),allBefore=await data();
 await rejected('',55,/verified room/);
 await rejected(roomId,null,/verified room/);
 await rejected(uuid(999),55,/does not exist/);
 await rejected(roomId,54,/revision changed/);
 // Force a late failure after state writes and deletes to verify rollback of the
 // whole operator block, rather than only its early preconditions.
 await db.exec("create function public.fixture_fail_reset() returns trigger language plpgsql as $$ begin raise exception 'fixture late failure';end $$; create trigger fixture_fail_reset before insert on public.desir_push_outbox for each row execute function public.fixture_fail_reset();");
 await rejected(roomId,55,/fixture late failure/);
 eq(await preserved(),preservedBefore,'late failure preserves account and configuration data');
 await db.exec('drop trigger fixture_fail_reset on public.desir_push_outbox;drop function public.fixture_fail_reset();');
 await reset();
 const room=await scalar('select to_jsonb(r) as result from public.desir_rooms r where id=$1',[roomId]);
 const expected=G.resetRoom(old,{at:room.state.lanes.a.round.createdAt,keepPrefs:true});
 ok(G.validateRoom(room.state),'reset state is core-valid');
 eq(room.state,expected,'SQL reset exactly matches the canonical core reset');
 eq(room.revision,56,'normal revision increases once');
 eq(room.state.sequence,old.sequence+2,'sequence strictly increases');
 eq(room.state.lanes.a.round.id,'onde-'+(old.sequence+1));
 eq(room.state.lanes.b.round.id,'onde-'+(old.sequence+2));
 eq(room.created_at,allBefore.rooms.find(r=>r.id===roomId).created_at,'room creation time preserved');
 eq(await preserved(),preservedBefore,'accounts, devices, subscriptions, secrets, settings and security limits unchanged');
 for(const name of ['desir_draw_usage','desir_requests','desir_hardcore_requests'])eq(await scalar('select count(*)::int as result from public.'+name+' where room_id=$1',[roomId]),0,name+' cleared for selected room');
 eq((await scalar('select public.desir_quota_status($1,$2) as result',[roomId,'a'])).remaining,3,'full daily quota restored');
 const nextLive=await scalar('select public.desir_hardcore_get($1) as result',[roomId]);
 eq(nextLive,{enabled:true,state:null,revision:18},'live session cleared with monotone revision');
 const allAfter=await data();
 for(const name of ['rooms','requests','usage','live','liveRequests','outbox']){
  const key=name==='rooms'?'id':'room_id';
  eq((allAfter[name]||[]).filter(r=>r[key]===otherId),(allBefore[name]||[]).filter(r=>r[key]===otherId),'unrelated room '+name+' preserved');
 }
 eq(await scalar('select count(*)::int as result from public.desir_push_outbox where room_id=$1 and delivered_at is null',[roomId]),0,'pending and claimed notifications cancelled');
 eq(await scalar("select count(*)::int as result from public.desir_push_outbox where room_id=$1 and kind='draw-available' and window_key=$2 and delivered_at is not null",[roomId,quota.window]),2,'both current-window dedupe entries retained or suppressed');
 await db.query('select public.desir_finish_push_event($1,false,60)',[uuid(10)]);
 eq(await scalar('select delivered_at is not null and lease_until is null as result from public.desir_push_outbox where id=$1',[uuid(10)]),true,'old worker cannot revive a cancelled event');
 eq(await scalar('select public.desir_enqueue_scheduled_push() as result'),{drawAvailable:0,taskReminders:0},'reset causes no current-window reminder');
 eq((await db.query('select * from public.desir_claim_push_outbox($1,10)',[roomId])).rows,[],'reset has nothing to deliver');
 const stale=await scalar('select public.desir_commit($1,$2,$3,$4,$5,$6,$7,true,null) as result',[roomId,'a',uuid(1),'d'.repeat(64),55,json(old),'{}']);
 eq(stale.kind,'conflict','old in-flight normal commit cannot restore pre-reset state');
 const staleLive=await scalar('select public.desir_hardcore_commit($1,$2,$3,$4,$5,$6) as result',[roomId,'a',uuid(1),'e'.repeat(64),17,json(live)]);
 eq(staleLive.kind,'conflict','old in-flight live commit cannot restore session');
 eq((await scalar('select public.desir_hardcore_get($1) as result',[roomId])).revision,18);
 for(const actor of ['a','b']){
  checks++;assert.throws(()=>applyAction(G,room.state,actor,{type:'ROLL_CATEGORY',roundId:old.lanes[actor].round.id},uuid(200),at,()=>1,5),error=>error instanceof HttpError&&error.code==='stale_round','old round request rejected by its identity');
 }
 checks++;assert.throws(()=>applyAction(G,room.state,'b',{type:'REFUSE_TASK',roundId:room.state.lanes.b.round.id,taskId},uuid(201),at,()=>1,5),error=>error instanceof HttpError&&error.code==='invalid_phase','removed task cannot be replayed');
 await rejected(roomId,55,/revision changed/);
 // Room with no earlier live row still gets a monotone tombstone, preventing
 // an in-flight expected revision 0 CREATE from committing over the reset.
 await db.query('delete from public.desir_hardcore_sessions where room_id=$1',[otherId]);
 await reset(otherId,90);
 eq((await scalar('select public.desir_hardcore_get($1) as result',[otherId])).revision,1);
 eq((await scalar('select public.desir_hardcore_commit($1,$2,$3,$4,0,$5) as result',[otherId,'a',uuid(300),'a'.repeat(64),json(live)])).kind,'conflict');
 eq(await preserved(),preservedBefore,'second room reset also preserves protected data');
 console.log('Dés·ir atomic reset: '+checks+' real PostgreSQL and core assertions passed (scope, rollback, revisions, stale actions, receipts, quotas, sessions, preferences and notification suppression).');
}finally{await db.close();}
