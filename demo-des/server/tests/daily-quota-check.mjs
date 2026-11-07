import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// The real PostgreSQL engine runs entirely in memory, without hosted accounts.
const packageDir=process.env.DESIR_PGLITE_DIR;
if(!packageDir)throw new Error('Set DESIR_PGLITE_DIR to @electric-sql/pglite 0.5.14 package directory.');
const {PGlite}=await import(pathToFileURL(path.join(packageDir,'dist/index.js')));
const {pgcrypto}=await import(pathToFileURL(path.join(packageDir,'dist/contrib/pgcrypto.js')));
const db=new PGlite({extensions:{pgcrypto}});
const read=name=>fs.readFile(new URL('../'+name,import.meta.url),'utf8');
let checks=0;
const equal=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const value=async(sql,args=[])=>(await db.query(sql,args)).rows[0].result;
const roomId='6dbd1329-1c31-4e4d-98c5-5485cf2fa2eb';
const firstId=crypto.randomUUID(),pendingId=crypto.randomUUID();
const state={fixture:'private-state-must-survive'},payloadHash='a'.repeat(64);
const commit=({actor='b',requestId=crypto.randomUUID(),revision,nextState=state,response={},consume=true,hash=payloadHash,notification=null}={})=>value(
 'select public.desir_commit($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',
 [roomId,actor,requestId,hash,revision,JSON.stringify(nextState),JSON.stringify(response),consume,notification===null?null:JSON.stringify(notification)]);
const quota=actor=>value('select public.desir_quota_status($1,$2) as result',[roomId,actor]);
const counts=()=>value(`select jsonb_build_object(
 'revision',(select revision from public.desir_rooms where id=$1),
 'draws',coalesce((select sum(draw_count) from public.desir_draw_usage where room_id=$1 and window_key=public.desir_quota_window(now())->>'window'),0),
 'receipts',(select count(*) from public.desir_requests where room_id=$1),
 'notifications',(select count(*) from public.desir_push_outbox where room_id=$1)) as result`,[roomId]);

try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 // Replay immutable deployed migrations, including the faulty daily pool.
 for(const file of ['20261102155212_desir_connected_game.sql','20261105105858_desir_parallel_rounds.sql','20261107104120_desir_hourly_quota.sql','20261107131541_desir_daily_draw_pool.sql']){
  await db.exec(await read('migrations/'+file));
 }
 await db.query('insert into public.desir_rooms(id,state) values($1,$2)',[roomId,JSON.stringify(state)]);
 await db.query(`insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash)
  values('a',$1,'fixture-a','Fixture A',$2),('b',$1,'fixture-b','Fixture B',$2)`,[roomId,'$2b$12$'+'.'.repeat(53)]);
 await db.query(`insert into public.desir_devices(token_hash,room_id,actor,created_at,last_seen_at,expires_at)
  values($1,$2,'b',now()-interval '1 day',now()-interval '1 hour',now()+interval '89 days')`,['b'.repeat(64),roomId]);
 const window=await value("select public.desir_quota_window(now())->>'window' as result");
 await db.query(`insert into public.desir_draw_usage(room_id,actor,window_key,used_at)
  values($1,'b',$2,now()-interval '1 day')`,[roomId,window+'T11:00']);
 const first=await commit({requestId:firstId,revision:0,response:{fixture:'first'},notification:{actor:'a',kind:'invitation',roundId:'onde-1'}});
 equal(first.kind,'applied');equal(first.response.quota.remaining,2);
 checks++;
 await assert.rejects(commit({requestId:pendingId,revision:1}),error=>error.code==='23505'&&error.constraint==='desir_draw_usage_pkey','historical second-draw failure must reproduce');
 const before=await value(`select jsonb_build_object(
  'rooms',(select jsonb_agg(to_jsonb(t)) from public.desir_rooms t),
  'accounts',(select jsonb_agg(to_jsonb(t) order by actor) from public.desir_accounts t),
  'devices',(select jsonb_agg(to_jsonb(t)) from public.desir_devices t),
  'receipts',(select jsonb_agg(to_jsonb(t)) from public.desir_requests t),
  'notifications',(select jsonb_agg(to_jsonb(t)) from public.desir_push_outbox t)) as result`);
 const oldUsage=(await db.query('select * from public.desir_draw_usage order by window_key')).rows;
 const migration=await read('migrations/20261107222844_desir_daily_draw_counter.sql');
 await db.exec('begin;'+migration+'commit;');
 const after=await value(`select jsonb_build_object(
  'rooms',(select jsonb_agg(to_jsonb(t)) from public.desir_rooms t),
  'accounts',(select jsonb_agg(to_jsonb(t) order by actor) from public.desir_accounts t),
  'devices',(select jsonb_agg(to_jsonb(t)) from public.desir_devices t),
  'receipts',(select jsonb_agg(to_jsonb(t)) from public.desir_requests t),
  'notifications',(select jsonb_agg(to_jsonb(t)) from public.desir_push_outbox t)) as result`);
 equal(after,before,'migration preserves game, accounts, sessions, receipts and notifications exactly');
 const newUsage=(await db.query('select * from public.desir_draw_usage order by window_key')).rows;
 equal(newUsage.map(({draw_count,...row})=>row),oldUsage,'migration preserves existing usage rows and timestamps');
 equal(newUsage.map(row=>row.draw_count),[1,1],'existing hourly and daily rows each consumed exactly one draw');
 equal((await quota('b')).remaining,2,'historical hourly keys do not consume the new daily pool');
 equal((await quota('a')).remaining,3,'each actor has a separate pool');

 // This is the same UUID the client retained after its failed second draw.
 const second=await commit({requestId:pendingId,revision:1});
 equal(second.kind,'applied');equal(second.response.quota.remaining,1);
 const third=await commit({revision:2});
 equal(third.kind,'applied');equal(third.response.quota.remaining,0);
 const exhaustedCounts=await counts();
 equal(exhaustedCounts,{revision:3,draws:3,receipts:3,notifications:1});
 equal((await commit({revision:3})).kind,'quota_exhausted','fourth draw is a quota result, never a SQL error');
 equal(await counts(),exhaustedCounts,'exhaustion changes no game state, receipt or notification');
 const replay=await commit({requestId:firstId,revision:0,response:{fixture:'wrong'},notification:{actor:'a',kind:'invitation',roundId:'onde-1'}});
 equal(replay.kind,'replayed');equal(replay.response,first.response,'historical receipt is returned unchanged');
 equal(await counts(),exhaustedCounts,'replay does not spend another draw');
 equal((await commit({requestId:firstId,revision:3,hash:'c'.repeat(64)})).kind,'mismatch');
 equal((await commit({actor:'a',revision:0})).kind,'conflict','stale revision is rejected before consuming a draw');
 equal((await quota('a')).remaining,3);
 equal((await quota('b')).remaining,0);

 // A failure after the counter increment rolls back the entire transaction.
 checks++;
 await assert.rejects(commit({actor:'a',revision:3,nextState:[]}),error=>error.code==='23514');
 equal(await counts(),exhaustedCounts,'constraint failure rolls back counter, room and receipt');
 equal((await quota('a')).remaining,3);
 const contender=crypto.randomUUID();
 // PGlite queues calls on one connection: exercise stale-CAS and duplicate-
 // request interleavings without claiming a multi-connection load benchmark.
 const queued=await Promise.all([
  commit({actor:'a',requestId:contender,revision:3}),
  commit({actor:'a',requestId:contender,revision:3}),
  commit({actor:'a',revision:3})
 ]);
 equal(queued.map(result=>result.kind),['applied','replayed','conflict']);
 equal((await quota('a')).remaining,2);equal((await quota('b')).remaining,0);
 equal((await counts()).draws,4,'only the winning request consumes an additional draw');
 const firstUsed=oldUsage.find(row=>row.window_key===window).used_at;
 equal(await value('select used_at as result from public.desir_draw_usage where room_id=$1 and actor=$2 and window_key=$3',[roomId,'b',window]),firstUsed,'later draws preserve first-use time');
 checks++;await assert.rejects(db.query('update public.desir_draw_usage set draw_count=4 where room_id=$1',[roomId]),error=>error.code==='23514');
 checks++;await assert.rejects(db.query('update public.desir_draw_usage set draw_count=0 where room_id=$1',[roomId]),error=>error.code==='23514');

 const boundary=await value(`select jsonb_build_object(
  'rls',(select relrowsecurity from pg_class where oid='public.desir_draw_usage'::regclass),
  'pk',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.desir_draw_usage'::regclass and contype='p'),
  'anon_table',has_table_privilege('anon','public.desir_draw_usage','select'),
  'authenticated_table',has_table_privilege('authenticated','public.desir_draw_usage','select'),
  'anon_rpc',has_function_privilege('anon','public.desir_quota_status(uuid,text)','execute'),
  'authenticated_rpc',has_function_privilege('authenticated','public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb)','execute'),
  'server_rpc',has_function_privilege('service_role','public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb)','execute'),
  'definer',(select bool_or(prosecdef) from pg_proc where oid in ('public.desir_quota_status(uuid,text)'::regprocedure,'public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb)'::regprocedure))) as result`);
 equal(boundary,{rls:true,pk:'PRIMARY KEY (room_id, actor, window_key)',anon_table:false,authenticated_table:false,anon_rpc:false,authenticated_rpc:false,server_rpc:true,definer:false});
 await db.exec('set role service_role');
 equal((await quota('b')).remaining,0,'server role can read the migrated counter');
 equal((await commit({actor:'a',revision:4,consume:false})).kind,'applied','server role retains the commit permission');
 await db.exec('reset role');
 // Run the common SQL checks against the migrated installation as well as the
 // clean schema exercised by postgres-check.mjs: three draws, CAS, DST and ACL.
 await db.exec(await fs.readFile(new URL('./database-check.sql',import.meta.url),'utf8'));
 console.log(`Dés·ir daily quota: ${checks} checks passed; old 23505 reproduced, migrated data preserved, pending retry recovered, 3 draws bounded, replay/CAS/rollback and private ACL verified.`);
}finally{await db.close();}
