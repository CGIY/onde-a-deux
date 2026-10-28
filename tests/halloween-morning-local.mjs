import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase(),read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
try{
 await db.exec(await read('supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql'));
 await db.exec(await read('supabase/operations/current_tcg_rules.sql'));
 await db.exec(await read('supabase/operations/halloween_launch_2026.sql'));
 await db.exec(await read('supabase/operations/halloween_morning_v28.sql'));
 await db.exec(await read('supabase/operations/grant_halloween_morning_v28.sql'));
 await db.exec(await read('supabase/operations/grant_halloween_morning_v28.sql'));
 assert.equal((await db.query("select count(*)::int n from public.tcg_boosters where bonus_key='halloween-morning-2026-10-28'")).rows[0].n,2);
 const count=(await db.query("select count(*) filter(where (x).edition='halloween_2026')::int n from (select public.tcg_halloween_morning_pick('AG',(select t from public.tcg_card_templates t where id='couple-film'),array[]::text[]) x from generate_series(1,400)) draws")).rows[0].n;
 assert(count>140&&count<260,`Expected approximately half seasonal, got ${count}/400`);
 for(const finish of ['standard','full_art','foil','full_art_foil','legendary']){
  const bad=(await db.query("select count(*)::int n from (select public.tcg_halloween_morning_pick('AG',(select t from public.tcg_card_templates t where finish_tier=$1 and edition='edition_01' and active and not demo and card_type='challenge' and (eligible_role is null or eligible_role='AG') limit 1),array[]::text[]) x from generate_series(1,30)) draws where (x).finish_tier<>$1",[finish])).rows[0].n;assert.equal(bad,0);
 }
 for(const [role,token] of [['AG','a'.repeat(48)],['CL','b'.repeat(48)]]){
 await db.query("insert into public.tcg_player_devices(role,device_token_hash) values($1,encode(extensions.digest(convert_to($2,'UTF8'),'sha256'),'hex'))",[role,token]);
 const api=async(action,payload={})=>(await db.query('select public.tcg_exchange($1,$2,null,$3,$4::jsonb) value',[role,token,action,JSON.stringify(payload)])).rows[0].value;
 const synced=await api('sync');const giftId=(await db.query("select id from public.tcg_boosters where owner_role=$1 and bonus_key='halloween-morning-2026-10-28'",[role])).rows[0].id;const gift=synced.boosters.find(b=>b.id===giftId);assert(gift?.is_halloween_morning);
 assert.equal((await db.query("select count(*)::int n from public.tcg_boosters where owner_role=$1 and release_date=date '2026-10-28'",[role])).rows[0].n,1);
 const opened=await api('open_booster',{booster_id:gift.id});const rewards=opened.pending_openings.find(p=>p.booster_id===gift.id).cards;assert.equal(rewards.length,5);
 const again=await api('open_booster',{booster_id:gift.id});assert.deepEqual(again.pending_openings.find(p=>p.booster_id===gift.id).cards,rewards);
 }
 console.log(`OK: one extra gift per profile, no duplicate grants, daily release preserved, ${count}/400 Halloween replacements, unchanged finish tiers, five rewards and immutable reopened receipt.`);
}finally{await db.close()}
