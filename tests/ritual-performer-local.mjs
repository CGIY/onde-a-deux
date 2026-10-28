import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase(),read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
try {
 await db.exec(await read('supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql'));
 await db.exec(await read('supabase/operations/current_tcg_rules.sql'));
 await db.exec("create table public.push_test_log(role text,body text); create or replace function public.tcg_push_notify(text,text,text,text) returns void language sql as $$ insert into public.push_test_log(role,body) values($1,$3); $$;");
 await db.exec(await read('supabase/operations/ritual_performer_v27.sql'));
 await db.exec("create trigger ritual_push_test after insert or update on public.tcg_ritual_claims for each row execute function public.tcg_push_on_ritual();");
 const tokens={AG:'a'.repeat(48),CL:'b'.repeat(48)};
 for(const role of ['AG','CL'])await db.query("insert into public.tcg_player_devices(role,device_token_hash) values($1,encode(extensions.digest(convert_to($2,'UTF8'),'sha256'),'hex'))",[role,tokens[role]]);
 const api=async(role,action,payload={})=>(await db.query('select public.tcg_exchange($1,$2,null,$3,$4::jsonb) value',[role,tokens[role],action,JSON.stringify(payload)])).rows[0].value;
 const balances=async()=>Object.fromEntries((await db.query('select role,balance from public.tcg_economy_wallets')).rows.map(x=>[x.role,x.balance]));
 const card=async(owner,finish='full_art_foil',expired=false)=>(await db.query("insert into public.tcg_cards(owner_role,template_id,finish,wear_seed,status,acquired_at,expires_at,activated_at,active_until,economy_eligible) values($1,'couple-film',$2,1,'activated',now()-interval '2 days',now()+interval '5 days',now()-interval '26 hours',case when $3 then now()-interval '1 hour' else now()+interval '1 hour' end,true) returning id",[owner,finish,expired])).rows[0].id;
 for(const owner of ['AG','CL']){
 const actor=owner==='AG'?'CL':'AG';await db.exec('update public.tcg_economy_wallets set balance=0');
 const id=await card(owner);await assert.rejects(()=>api(owner,'complete_card',{card_id:id}),/card_unavailable/);
 await api(actor,'complete_card',{card_id:id});assert.equal((await db.query('select role from public.push_test_log order by ctid desc limit 1')).rows[0].role,owner);await assert.rejects(()=>api(actor,'ritual_review',{card_id:id,decision:'approve'}),/ritual_unavailable/);
 await api(owner,'ritual_review',{card_id:id,decision:'approve'});assert.deepEqual(await balances(),{[owner]:0,[actor]:6});assert.equal((await db.query('select role from public.push_test_log order by ctid desc limit 1')).rows[0].role,actor);
 await assert.rejects(()=>api(owner,'ritual_review',{card_id:id,decision:'approve'}),/ritual_unavailable/);assert.equal((await balances())[actor],6);
 const rejected=await card(owner);await api(actor,'complete_card',{card_id:rejected});await api(owner,'ritual_review',{card_id:rejected,decision:'reject'});assert.equal((await balances())[actor],0);
 const passed=await card(owner);await api(actor,'ritual_pass',{card_id:passed});assert.equal((await balances())[actor],-6);assert.equal((await balances())[owner],0);
 const expired=await card(owner,'full_art_foil',true);await api(owner,'sync');assert.equal((await balances())[actor],-12);await api(owner,'sync');assert.equal((await balances())[actor],-12);
 // Existing pending claims use the card's poser/performer relationship, even with legacy owner_role.
 const legacy=await card(owner);await db.query("insert into public.tcg_ritual_claims(card_id,owner_role,status) values($1,$2,'pending')",[legacy,owner]);
 await db.query("update public.tcg_cards set active_until=now()-interval '1 minute' where id=$1",[legacy]);
 const sync=await api(owner,'sync');assert(sync.active_cards.some(c=>c.id===legacy),'Pending request remains visible beyond ritual timer');
 await api(owner,'ritual_review',{card_id:legacy,decision:'approve'});assert.equal((await balances())[actor],-6);assert.equal((await balances())[owner],0);
 }
 await db.exec('set role anon');await assert.rejects(()=>db.query("select public.tcg_economy_action('AG','complete_card','{}')"),/permission denied/);await db.exec('reset role');
 console.log('OK: both roles, performer requests and earns/pays, poser reviews, no self-confirmation, expiry floor, replay safety, legacy pending and extended validation visibility, anon denial.');
}finally{await db.close()}
