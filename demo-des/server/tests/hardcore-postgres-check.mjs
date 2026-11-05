import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHardcore} from '../functions/desir-game/hardcore.mjs';
const packageDir=process.env.DESIR_PGLITE_DIR;if(!packageDir)throw Error('Set DESIR_PGLITE_DIR to pinned PGlite 0.5.14 package directory.');
const {PGlite}=await import(pathToFileURL(path.join(packageDir,'dist/index.js'))),{pgcrypto}=await import(pathToFileURL(path.join(packageDir,'dist/contrib/pgcrypto.js')));
const db=new PGlite({extensions:{pgcrypto}}),roomId='10000000-0000-4000-8000-000000000100',sessionId='10000000-0000-4000-8000-000000000001',requestId='10000000-0000-4000-8000-000000000002';
let checks=0;const eq=(a,b,msg)=>{checks++;assert.deepEqual(a,b,msg);};
async function scalar(sql,args=[]){return (await db.query(sql,args)).rows[0].result;}
async function denied(sql){let failed=false;try{await db.exec(sql);}catch{failed=true;}eq(failed,true,'public browser role denied '+sql);}
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../hardcore-schema.sql',import.meta.url),'utf8'));
 await db.query('insert into public.desir_rooms(id,state) values($1,$2)',[roomId,JSON.stringify({players:[],sentinel:'normal-game-untouched'})]);
 await db.query("insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash) values('a',$1,'alpha','Alpha',extensions.crypt('test-only-password',extensions.gen_salt('bf',12))),('b',$1,'bravo','Bravo',extensions.crypt('test-only-password',extensions.gen_salt('bf',12)))",[roomId]);
 await db.query("insert into public.desir_devices(token_hash,room_id,actor) values($1,$2,'a'),($3,$2,'b')",['a'.repeat(64),roomId,'b'.repeat(64)]);
 const before=await scalar('select to_jsonb(r) as result from public.desir_rooms r where id=$1',[roomId]);
 await db.exec('set role service_role');
 eq(await scalar('select public.desir_hardcore_auth($1) as result',['a'.repeat(64)]),{roomId,actor:'a'});
 eq(await scalar('select public.desir_hardcore_auth($1) as result',['b'.repeat(64)]),{roomId,actor:'b'});
 eq(await scalar('select public.desir_hardcore_auth($1) as result',['c'.repeat(64)]),null);
 eq(await scalar('select public.desir_hardcore_get($1) as result',[roomId]),{enabled:true,state:null,revision:0});
 const session=createHardcore(Date.now(),sessionId),params=[roomId,'a',requestId,'a'.repeat(64),0,JSON.stringify(session)];
 const commit=()=>scalar('select public.desir_hardcore_commit($1,$2,$3,$4,$5,$6) as result',params);
 let result=await commit();eq(result.kind,'applied');eq(result.revision,1);eq(result.state,session);
 result=await commit();eq(result.kind,'replayed');eq(result.revision,1);
 eq((await scalar('select public.desir_hardcore_commit($1,$2,$3,$4,$5,$6) as result',[roomId,'a',requestId,'b'.repeat(64),0,JSON.stringify(session)])).kind,'mismatch');
 eq((await scalar('select public.desir_hardcore_commit($1,$2,$3,$4,$5,$6) as result',[roomId,'b',requestId,'a'.repeat(64),0,JSON.stringify(session)])).kind,'conflict','stale expected revision cannot overwrite');
 eq((await scalar('select public.desir_hardcore_commit($1,$2,$3,$4,$5,$6) as result',[roomId,'b',requestId,'a'.repeat(64),1,JSON.stringify(session)])).kind,'applied','same UUID receipt independent per actor');
 eq((await scalar('select public.desir_hardcore_get($1) as result',[roomId])).revision,2);
 eq(await scalar('select public.desir_hardcore_receipt($1,$2,$3,$4) as result',[roomId,'a',requestId,'a'.repeat(64)]),{kind:'replayed'});
 eq(await scalar('select public.desir_hardcore_receipt($1,$2,$3,$4) as result',[roomId,'a',requestId,'b'.repeat(64)]),{kind:'mismatch'});
 await db.exec('update public.desir_hardcore_settings set enabled=false');eq((await commit()).kind,'disabled');await db.exec('update public.desir_hardcore_settings set enabled=true');
 await db.query("update public.desir_devices set revoked_at=now() where actor='a'");eq(await scalar('select public.desir_hardcore_auth($1) as result',['a'.repeat(64)]),null);await db.query("update public.desir_devices set revoked_at=null where actor='a'");
 await db.query("update public.desir_accounts set disabled_at=now() where actor='b'");eq(await scalar('select public.desir_hardcore_auth($1) as result',['a'.repeat(64)]),null,'both active accounts required');await db.query("update public.desir_accounts set disabled_at=null where actor='b'");
 eq(await scalar('select to_jsonb(r) as result from public.desir_rooms r where id=$1',[roomId]),before,'normal room unchanged');
 eq(await scalar('select count(*)::int as result from public.desir_draw_usage'),0,'no normal draw tickets consumed');
 eq(await scalar('select count(*)::int as result from public.desir_push_outbox'),0,'no notifications enqueued');
 await db.exec('reset role');
 eq((await db.query("select relname,relrowsecurity from pg_class where relname in ('desir_hardcore_settings','desir_hardcore_sessions','desir_hardcore_requests') order by relname")).rows.map(r=>r.relrowsecurity),[true,true,true]);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  for(const table of ['desir_hardcore_settings','desir_hardcore_sessions','desir_hardcore_requests'])await denied('select * from public.'+table);
  await denied("select public.desir_hardcore_auth('"+'a'.repeat(64)+"')");await denied("select public.desir_hardcore_get('"+roomId+"')");
  await denied("select public.desir_hardcore_receipt('"+roomId+"','a','"+requestId+"','"+'a'.repeat(64)+"')");
  await denied("select public.desir_hardcore_commit('"+roomId+"','a','"+requestId+"','"+'a'.repeat(64)+"',2,'{}')");
  await db.exec('reset role');
 }
 console.log('Dés·ir HARDCORE actual PostgreSQL: '+checks+' auth, CAS, independent receipts, feature switch, expiry, RLS/ACL and normal-game isolation assertions passed.');
}finally{await db.close();}
