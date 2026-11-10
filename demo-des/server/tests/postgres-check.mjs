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
 await db.exec(await fs.readFile(new URL('../portraits-schema.sql',import.meta.url),'utf8'));
 const originalScheduler=await fs.readFile(new URL('../migrations/20261102155223_desir_push_scheduler.sql',import.meta.url),'utf8');
 // Use the scheduler SQL without the cron and networking extensions.
 await db.exec(originalScheduler.slice(originalScheduler.indexOf('create schema'),originalScheduler.indexOf('-- This sole privileged routine')));
 await db.exec(await fs.readFile(new URL('../migrations/20261106101558_desir_task_reminder_three_hours.sql',import.meta.url),'utf8'));
 const scheduler=await fs.readFile(new URL('../push-scheduler.sql',import.meta.url),'utf8');
 const readyStart=scheduler.indexOf('create or replace function public.desir_draw_ready_for_state');
 const readyEnd=scheduler.indexOf('create or replace function public.desir_due_task_reminders',readyStart);
 await db.exec(scheduler.slice(readyStart,readyEnd));
 let personal=G.createRoom({at:'2026-11-05T11:00:00.000Z'});
 async function assertReady(actor,expected){
  const result=await db.query('select public.desir_draw_ready_for_state($1,$2) as ready',[JSON.stringify(personal),actor]);
  if(result.rows[0].ready!==expected)throw Error('Personal draw readiness mismatch for '+actor);
 }
 await assertReady('a',true);await assertReady('b',true);
 const own=G.roomView(personal,'a');
 personal=G.reduceRoom(personal,{type:'ROLL_CATEGORY',catalogueVersion:2,value:1,hand:G.drawHand(own,1,2),actor:'a',roundId:own.round.id,at:'2026-11-05T11:00:00.000Z'});
 await assertReady('a',false);await assertReady('b',true);
 await db.exec(await fs.readFile(new URL('./database-check.sql',import.meta.url),'utf8'));
 const room='9ee847bf-5462-4dd8-958c-f77a21356f81';
 await db.query('insert into public.desir_rooms(id,state) values($1,$2)',[room,JSON.stringify(G.createState())]);
 await db.query("insert into public.desir_room_portraits values($1,'a','/9j/2Q==')",[room]);
 await db.query("insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash) values('a',$1,'alpha','Alpha',extensions.crypt('test-only-password',extensions.gen_salt('bf',12))),('b',$1,'bravo','Bravo',extensions.crypt('test-only-password',extensions.gen_salt('bf',12)))",[room]);
 const reminderAt='2030-01-01T12:00:00Z';
 async function enqueueReminder(expiresAt,at,expected){
  const task={id:'onde-1',expiresAt,checks:{a:true,b:false}};
  await db.query("update public.desir_rooms set state=jsonb_set(state,'{tasks}',$2::jsonb) where id=$1",[room,JSON.stringify([task])]);
  const {rows:[{result}]}=await db.query('select public.desir_enqueue_scheduled_push($1) as result',[at]);
  if(result.taskReminders!==expected)throw Error('Wrong number of reminders for '+expiresAt);
  return result;
 }
 const originalDeadline='2030-01-01T14:00:00Z',extendedDeadline='2030-01-02T14:00:00Z';
 await enqueueReminder(originalDeadline,reminderAt,1);
 await db.exec(await fs.readFile(new URL('../migrations/20261110215418_desir_task_reminder_deadline.sql',import.meta.url),'utf8'));
 await enqueueReminder(originalDeadline,reminderAt,0);
 await enqueueReminder(extendedDeadline,reminderAt,0);
 await enqueueReminder(extendedDeadline,'2030-01-02T12:00:00Z',1);
 const repeated=await enqueueReminder(extendedDeadline,'2030-01-02T12:01:00Z',0);
 if(repeated.drawAvailable!==0)throw Error('Duplicate scheduled draw after reminder migration');
 await db.query('update public.desir_rooms set state=$2 where id=$1',[room,JSON.stringify(G.createState())]);
 await db.exec('set role service_role');
 const bad=await db.query('select public.desir_login($1,$2,$3) as result',['alpha','wrong-fixture-password','a'.repeat(64)]);if(bad.rows[0].result!==null)throw Error('Bad password accepted');
 const good=await db.query('select public.desir_login($1,$2,$3) as result',['alpha','test-only-password','a'.repeat(64)]);if(good.rows[0].result.actor!=='a')throw Error('Valid login rejected');
 const ctx=await db.query('select public.desir_get_session($1) as result',['a'.repeat(64)]);if(ctx.rows[0].result.member.actor!=='a'||ctx.rows[0].result.room.state.players[1].name!=='Bravo')throw Error('Bad session context');
 const collision=await db.query('select public.desir_login($1,$2,$3) as result',['bravo','test-only-password','a'.repeat(64)]);if(collision.rows[0].result.error!=='session_conflict')throw Error('Token reassigned to another account');
 const portrait=await db.query('select jpeg_base64 from public.desir_room_portraits where room_id=$1',[room]);if(portrait.rows[0].jpeg_base64!=='/9j/2Q==')throw Error('Service cannot read the room portrait');
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role);
  let denied=false;try{await db.query('select * from public.desir_room_portraits');}catch{denied=true;}
  if(!denied)throw Error('Private portrait read allowed for '+role);
 }
 await db.exec('reset role;set role anon');let denied=false;try{await db.query('select * from public.desir_accounts');}catch{denied=true;}if(!denied)throw Error('Anonymous account read allowed');
 console.log('Dés·ir actual PostgreSQL (PGlite 0.5.14 + pgcrypto): schema, personal draw readiness, quota/DST/CAS/receipt/ACL SQL suite, bcrypt login, service role session, token collision and anonymous denial PASS.');
}finally{await db.close();}
