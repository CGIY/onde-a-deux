import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';

const db=await createDeckDatabase();
const token='a'.repeat(48);
const api=async (role,action,payload={}) => {
  const result=await db.query('select public.tcg_exchange($1,$2,null,$3,$4::jsonb) as value',
    [role,token,action,JSON.stringify(payload)]);
  return result.rows[0].value;
};
const expectError=async (fn,pattern) => assert.rejects(fn,pattern);
try {
  await db.exec(await readFile(new URL('../supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql',import.meta.url),'utf8'));
  await db.query(`insert into public.tcg_player_devices(role,device_token_hash)
    select role,encode(extensions.digest(convert_to($1,'UTF8'),'sha256'),'hex') from public.tcg_players`,[token]);
  const first=await api('AG','sync');
  assert.equal(first.economy.balance,6);
  assert.equal((await api('CL','sync')).economy.balance,6);
  await db.exec(await readFile(new URL('../supabase/operations/ritual_economy_helpers.sql',import.meta.url),'utf8'));
  assert.equal((await api('AG','sync')).economy.balance,6);
  assert.equal((await db.query("select count(*)::integer as n from public.tcg_economy_events where event_type='launch_bonus'")).rows[0].n,2);
  assert.equal(first.rules.booster_cards,5);
  const booster=first.boosters[0];
  const opened=await api('AG','open_booster',{booster_id:booster.id});
  const receipt=opened.pending_openings.find(x=>x.booster_id===booster.id);
  assert.equal(receipt.cards.length,5);
  assert.equal(receipt.cards[0].card_type,'energy');
  assert.equal(receipt.cards[1].card_type,'challenge');
  assert.equal(receipt.cards[2].card_type,'challenge');
  assert(receipt.cards.filter(x=>x.reward_type==='shards').length<=2);
  assert.equal(opened.economy.balance,6+receipt.cards.filter(x=>x.reward_type==='shards').reduce((n,x)=>n+x.amount,0));
  await expectError(()=>api('AG','opening_progress',{booster_id:booster.id,index:5}),/invalid_request/);
  await api('AG','opening_progress',{booster_id:booster.id,index:4});
  const challenge=opened.my_cards.find(x=>x.card_type==='challenge');
  const activated=await api('AG','activate_card',{card_id:challenge.id});
  assert.equal(activated.active_cards.find(x=>x.id===challenge.id).economy_eligible,true);
  const claim=await api('AG','complete_card',{card_id:challenge.id});
  assert.equal(claim.active_cards.find(x=>x.id===challenge.id).ritual_claim_status,'pending');
  assert.equal(claim.economy.balance,opened.economy.balance);
  await expectError(()=>api('AG','ritual_review',{card_id:challenge.id,decision:'approve'}),/ritual_unavailable/);
  const approved=await api('CL','ritual_review',{card_id:challenge.id,decision:'approve'});
  assert(!approved.active_cards.some(x=>x.id===challenge.id));
  assert.equal((await api('AG','sync')).economy.balance,opened.economy.balance+({standard:1,full_art:2,foil:3,full_art_foil:6,legendary:10}[challenge.finish]));
  await expectError(()=>api('CL','ritual_review',{card_id:challenge.id,decision:'approve'}),/ritual_unavailable/);

  const template=(await db.query("select id from public.tcg_card_templates where card_type='challenge' and finish_tier='legendary' limit 1")).rows[0].id;
  const expiry=await db.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,status,acquired_at,activated_at,active_until,expires_at,economy_eligible)
    values($1,'AG','legendary',1,'activated',now()-interval '2 days',now()-interval '25 hours',now()-interval '1 hour',now()+interval '5 days',true) returning id`,[template]);
  const beforeExpiry=(await db.query("select balance from public.tcg_economy_wallets where role='AG'")).rows[0].balance;
  assert.equal((await api('AG','sync')).economy.balance,Math.max(-12,beforeExpiry-10));
  assert.equal((await db.query('select status from public.tcg_ritual_claims where card_id=$1',[expiry.rows[0].id])).rows[0].status,'expired');

  const saleTemplate=(await db.query("select id from public.tcg_card_templates where card_type='challenge' and finish_tier='full_art_foil' and active and not demo limit 1")).rows[0].id;
  const sale=await db.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,acquired_at,expires_at)
    values($1,'AG','full_art_foil',2,now()-interval '1 day',now()+interval '6 days') returning id`,[saleTemplate]);
  const beforeSale=(await api('AG','sync')).economy.balance;
  const sold=await api('AG','sell_card',{card_id:sale.rows[0].id});
  assert.equal(sold.economy.balance,beforeSale+4);
  await expectError(()=>api('AG','sell_card',{card_id:sale.rows[0].id}),/card_unavailable/);
  await db.query("select public.tcg_economy_apply('AG',20,'fixture')");
  const bought=await api('AG','buy_booster');
  assert(bought.boosters.some(x=>x.is_economy));
  await expectError(()=>api('AG','buy_booster'),/weekly_booster_used/);

  const energies=await db.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,expires_at)
    select 'energy-bisou','CL','standard',i,now()+interval '7 days' from generate_series(1,5) i returning id`);
  const bank=await api('CL','bank_exchange',{recipe:'draw',card_ids:energies.rows.map(x=>x.id)});
  assert.equal(bank.economy.bank_used_today,true);
  assert(bank.economy.last_bank_trade.reward_card_id);
  assert(bank.my_cards.some(x=>x.id===bank.economy.last_bank_trade.reward_card_id));
  await expectError(()=>api('CL','bank_exchange',{recipe:'draw',card_ids:energies.rows.map(x=>x.id)}),/bank_used_today/);
  assert.equal((await db.query("select status from public.tcg_cards where id=$1",[energies.rows[0].id])).rows[0].status,'destroyed');
  const runRecipe=async (recipe,ingredientFinishes,expectedFinish) => {
    await db.exec("delete from public.tcg_bank_trades where owner_role='CL'");
    const ids=[];
    for(const finish of ingredientFinishes){
      const templateId=finish==='energy'?'energy-bisou':(await db.query("select id from public.tcg_card_templates where card_type='challenge' and finish_tier=$1 and active and not demo limit 1",[finish])).rows[0].id;
      const card=await db.query("insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,expires_at) values($1,'CL',$2,4,now()+interval '7 days') returning id",[templateId,finish==='energy'?'standard':finish]);
      ids.push(card.rows[0].id);
    }
    const result=await api('CL','bank_exchange',{recipe,card_ids:ids});
    const reward=result.my_cards.find(c=>c.id===result.economy.last_bank_trade.reward_card_id);
    assert.equal(reward.finish,expectedFinish);
    assert.equal((await db.query("select count(*)::integer as n from public.tcg_cards where id=any($1::uuid[]) and status='destroyed'",[ids])).rows[0].n,ids.length);
  };
  await runRecipe('reforge',['energy','energy','energy','standard'],'standard');
  await runRecipe('common_to_art',[...Array(5).fill('standard'),...Array(3).fill('energy')],'full_art');
  await runRecipe('art_to_foil',[...Array(3).fill('full_art'),...Array(3).fill('energy')],'foil');
  await runRecipe('foil_to_artfoil',[...Array(3).fill('foil'),...Array(3).fill('energy')],'full_art_foil');
  await runRecipe('legendary',[...Array(5).fill('full_art'),...Array(5).fill('foil'),...Array(5).fill('energy')],'legendary');
  const oldActiveTemplate=(await db.query("select id from public.tcg_card_templates where card_type='challenge' and category<>'MISE À NUE' and finish_tier='standard' limit 1")).rows[0].id;
  const oldActive=(await db.query("insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,status,activated_at,active_until,expires_at) values($1,'CL','standard',8,'activated',now()-interval '1 hour',now()+interval '23 hours',now()+interval '7 days') returning id",[oldActiveTemplate])).rows[0].id;
  const beforePass=(await api('CL','sync')).economy.balance;
  assert.equal((await api('CL','ritual_pass',{card_id:oldActive})).economy.balance,beforePass);
  assert.equal((await db.query("select public.tcg_economy_apply('CL',-100,'fixture') as balance")).rows[0].balance,-12);
  assert.equal((await db.query("select public.tcg_economy_apply('CL',-10,'fixture') as balance")).rows[0].balance,-12);
  const priv=await db.query("select has_table_privilege('anon','public.tcg_economy_wallets','SELECT') as wallet,has_function_privilege('anon','public.tcg_economy_action(text,text,jsonb)','EXECUTE') as action");
  assert.equal(priv.rows[0].wallet,false);assert.equal(priv.rows[0].action,false);
  console.log('OK: five rewards, shards, resume bounds, partner validation, no duplicate reward, expiry, sale, weekly purchase, bank draw, private tables.');
} finally {await db.close();}
