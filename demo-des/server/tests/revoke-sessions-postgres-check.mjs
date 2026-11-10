import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const packageDir=process.env.DESIR_PGLITE_DIR;
if(!packageDir)throw Error('Set DESIR_PGLITE_DIR to the @electric-sql/pglite package directory.');
const {PGlite}=await import(pathToFileURL(path.join(packageDir,'dist/index.js')));
const {pgcrypto}=await import(pathToFileURL(path.join(packageDir,'dist/contrib/pgcrypto.js')));
const db=new PGlite({extensions:{pgcrypto}});
const room='9ee847bf-5462-4dd8-958c-f77a21356f81',a='a'.repeat(64),a2='c'.repeat(64),b='b'.repeat(64);
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const filename of ['schema.sql','push-schema.sql','revoke-sessions.sql'])await db.exec(await fs.readFile(new URL('../'+filename,import.meta.url),'utf8'));
 await db.query('insert into public.desir_rooms(id,state) values($1,$2)',[room,'{}']);
 await db.query("insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash) values('a',$1,'alpha','Alpha',extensions.crypt('password',extensions.gen_salt('bf',4))),('b',$1,'bravo','Bravo',extensions.crypt('password',extensions.gen_salt('bf',4)))",[room]);
 for(const [token,actor] of [[a,'a'],[a2,'a'],[b,'b']]){
  await db.query('insert into public.desir_devices(token_hash,room_id,actor) values($1,$2,$3)',[token,room,actor]);
  await db.query('insert into public.desir_push_subscriptions(endpoint_hash,token_hash,room_id,actor,endpoint,subscription) values($1,$2,$3,$4,$5,$6)',[token,token,room,actor,'https://example.com/'+token,'{}']);
 }
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);let denied=false;
  try{await db.query('select public.desir_revoke_sessions($1,$2)',[a,'others']);}catch{denied=true;}
  assert.equal(denied,true,role+' cannot execute privileged revocation');await db.exec('reset role');
 }
 await db.exec('set role service_role');
 const call=async(token,scope)=>(await db.query('select public.desir_revoke_sessions($1,$2) as value',[token,scope])).rows[0].value;
 assert.equal(await call(a,'invalid'),false);
 assert.equal(await call('d'.repeat(64),'others'),false);
 assert.equal(await call(a,'others'),true);
 const rows=(await db.query('select token_hash,revoked_at from public.desir_devices order by token_hash')).rows;
 assert.equal(rows.find(x=>x.token_hash===a).revoked_at,null,'current device retained');
 assert.notEqual(rows.find(x=>x.token_hash===a2).revoked_at,null,'other device revoked');
 assert.equal(rows.find(x=>x.token_hash===b).revoked_at,null,'partner device retained');
 let subscriptions=(await db.query('select token_hash from public.desir_push_subscriptions order by token_hash')).rows.map(x=>x.token_hash);
 assert.deepEqual(subscriptions,[a,b],'revoked device notifications removed');
 assert.equal(await call(a2,'others'),false,'revoked device cannot revoke a live one');
 let deniedSubscription=false;try{await db.query('select public.desir_save_push_subscription($1,$2)',[a2,JSON.stringify({endpoint:'https://example.com/new'})]);}catch{deniedSubscription=true;}assert.equal(deniedSubscription,true,'revoked device cannot re-register notifications');
 assert.equal(await call(a,'current'),true);
 assert.equal(await call(a,'current'),false,'repeat cannot authenticate with a revoked token');
 subscriptions=(await db.query('select token_hash from public.desir_push_subscriptions')).rows.map(x=>x.token_hash);
 assert.deepEqual(subscriptions,[b],'current notification removed, partner unaffected');
 assert.equal(await call(b,'others'),true,'partner remains authenticated');
 console.log('Device revocation PostgreSQL: isolation, invalid tokens, service-only ACL and push cleanup PASS.');
}finally{await db.close();}
