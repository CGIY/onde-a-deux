import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
// Temporary test dependency only: install the pinned package outside the repo.
const packageDir=process.env.DESIR_PGLITE_DIR;
if(!packageDir)throw new Error('Set DESIR_PGLITE_DIR to @electric-sql/pglite 0.5.14 package directory.');
const {PGlite}=await import(pathToFileURL(path.join(packageDir,'dist/index.js')));
const {pgcrypto}=await import(pathToFileURL(path.join(packageDir,'dist/contrib/pgcrypto.js')));
const require=createRequire(import.meta.url),G=require('../../dev/src/onde-app-core.js');
const db=new PGlite({extensions:{pgcrypto}});
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('./database-check.sql',import.meta.url),'utf8'));
 const room='9ee847bf-5462-4dd8-958c-f77a21356f81';
 await db.query('insert into public.desir_rooms(id,state) values($1,$2)',[room,JSON.stringify(G.createState())]);
 await db.query("insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash) values('a',$1,'alpha','Alpha',extensions.crypt('test-only-password',extensions.gen_salt('bf',12))),('b',$1,'bravo','Bravo',extensions.crypt('test-only-password',extensions.gen_salt('bf',12)))",[room]);
 await db.exec('set role service_role');
 const bad=await db.query('select public.desir_login($1,$2,$3) as result',['alpha','wrong-fixture-password','a'.repeat(64)]);if(bad.rows[0].result!==null)throw Error('Bad password accepted');
 const good=await db.query('select public.desir_login($1,$2,$3) as result',['alpha','test-only-password','a'.repeat(64)]);if(good.rows[0].result.actor!=='a')throw Error('Valid login rejected');
 const ctx=await db.query('select public.desir_get_session($1) as result',['a'.repeat(64)]);if(ctx.rows[0].result.member.actor!=='a'||ctx.rows[0].result.room.state.players[1].name!=='Bravo')throw Error('Bad session context');
 const collision=await db.query('select public.desir_login($1,$2,$3) as result',['bravo','test-only-password','a'.repeat(64)]);if(collision.rows[0].result.error!=='session_conflict')throw Error('Token reassigned to another account');
 await db.exec('reset role;set role anon');let denied=false;try{await db.query('select * from public.desir_accounts');}catch{denied=true;}if(!denied)throw Error('Anonymous account read allowed');
 console.log('Dés·ir actual PostgreSQL (PGlite 0.5.14 + pgcrypto): schema, quota/DST/CAS/receipt/ACL SQL suite, bcrypt login, service role session, token collision and anonymous denial PASS.');
}finally{await db.close();}
