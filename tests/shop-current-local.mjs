import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase(),token='a'.repeat(48);
const api=async(action,payload={})=>(await db.query("select public.tcg_exchange('AG',$1,null,$2,$3::jsonb) value",[token,action,JSON.stringify(payload)])).rows[0].value;
try{
  await db.exec(await readFile(new URL('../supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/operations/current_tcg_rules.sql',import.meta.url),'utf8'));
  await db.query("insert into public.tcg_player_devices(role,device_token_hash) values('AG',encode(extensions.digest(convert_to($1,'UTF8'),'sha256'),'hex'))",[token]);
  const initial=await api('sync');
  await db.exec("update public.tcg_economy_wallets set balance=120 where role='AG'");
  for(const kind of ['magician','pleasure','relax']){
    const bought=await api('buy_booster',{kind});const pack=bought.boosters.find(b=>b.booster_kind===kind);assert(pack);
    const opened=await api('open_booster',{booster_id:pack.id});const rewards=opened.pending_openings.find(x=>x.booster_id===pack.id).cards;
    assert.equal(rewards.length,5);assert(rewards.filter(c=>c.reward_type!=='shards').length>=3);
    if(kind==='magician')assert(rewards.some(c=>c.card_type==='spell'));
    if(kind==='pleasure')assert(rewards.some(c=>c.category==='MISE À NUE'));
    if(kind==='relax')assert(rewards.some(c=>/MASSAGE|SOIN/.test(c.title||'')));
  }
  const final=await api('sync');assert.equal(final.economy.weekly_boosters_bought,3);
  await assert.rejects(()=>api('buy_booster',{kind:'classic'}),/weekly_booster_used/);
  assert(initial.boosters.every(old=>final.boosters.some(current=>current.id===old.id)),'Purchased packs never remove daily packs');
  console.log('OK: three themed purchases, five exact rewards each, guaranteed theme, shared weekly cap and preserved daily packs.');
}finally{await db.close();}
