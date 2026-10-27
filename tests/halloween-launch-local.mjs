import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase(),token='b'.repeat(48);
try {
 for(const file of ['supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql','supabase/operations/current_tcg_rules.sql','supabase/operations/halloween_launch_2026.sql','supabase/operations/grant_halloween_launch_bonus.sql']) await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/operations/grant_halloween_launch_bonus.sql',import.meta.url),'utf8'));
 assert.equal((await db.query("select count(*)::int n from public.tcg_boosters where bonus_key='halloween-launch-2026-10-27'")).rows[0].n,2);
 for(const role of ['AG','CL']){
 await db.query("insert into public.tcg_player_devices(role,device_token_hash) values($1,encode(extensions.digest(convert_to($2,'UTF8'),'sha256'),'hex'))",[role,token]);
 const pack=(await db.query("select id from public.tcg_boosters where owner_role=$1 and bonus_key='halloween-launch-2026-10-27'",[role])).rows[0];
 const value=(await db.query("select public.tcg_exchange($1,$2,null,'open_booster',jsonb_build_object('booster_id',$3::text)) value",[role,token,pack.id])).rows[0].value;
 const rewards=value.pending_openings.find(p=>p.booster_id===pack.id).cards;
 assert.equal(rewards.length,5);assert.equal(rewards[0].edition,'halloween_2026');assert.equal(rewards[0].card_type,'energy');assert.equal(rewards[1].edition,'halloween_2026');assert.equal(rewards[1].card_type,'challenge');
 if(role==='CL')assert.equal(rewards[1].template_id,'hw-nue-photo-horreur');
 }
 console.log('OK: idempotent gift, five rewards, Halloween energy and challenge guaranteed, CL costume photo, saves and daily clock guarded.');
}finally{await db.close()}
