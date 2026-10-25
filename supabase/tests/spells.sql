-- Real API, temporary fixtures, no writes survive this transaction.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare ag text:=encode(extensions.gen_random_bytes(24),'hex');cl text:=encode(extensions.gen_random_bytes(24),'hex');
  target_one uuid;target_two uuid;private_card uuid;trade_card uuid;expired_card uuid;own_card uuid;
  red uuid;pre uuid;ada uuid;aug uuid;des uuid;extra uuid;pack uuid;response jsonb;chosen public.tcg_card_templates%rowtype;
  deadline timestamptz:=now()+interval '7 days';excluded text[];i integer;
begin
  insert into public.tcg_player_devices(role,device_token_hash) values
    ('AG',encode(extensions.digest(ag,'sha256'),'hex')),('CL',encode(extensions.digest(cl,'sha256'),'hex'));
  update public.tcg_card_templates set active=true where id in ('spell-reducto','spell-presto','spell-adagio','spell-augmento','spell-destructo','legend-couple','legend-other','legend-nude','legend-foodies','legend-todo');
  insert into public.tcg_card_templates(id,category,title,challenge,palette,demo) values
    ('qa-spell-target','EN COUPLE','Rituel fictif','Fixture temporaire.','couple',true),
    ('qa-spell-secret','EN COUPLE','Cible secrète fictive','Fixture temporaire.','couple',true);
  insert into public.tcg_cards(template_id,owner_role,status,wear_seed,expires_at,activated_at,active_until)
    values('qa-spell-target','CL','activated',1,deadline,now(),now()+interval '10 hours') returning id into target_one;
  insert into public.tcg_cards(template_id,owner_role,status,wear_seed,expires_at,activated_at,active_until)
    values('qa-spell-target','CL','activated',2,deadline,now(),now()+interval '10 hours') returning id into target_two;
  insert into public.tcg_cards(template_id,owner_role,status,wear_seed,expires_at,activated_at,active_until)
    values('qa-spell-target','AG','activated',3,deadline,now(),now()+interval '10 hours') returning id into own_card;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-reducto','AG',1,deadline) returning id into red;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-presto','AG',1,deadline) returning id into pre;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-adagio','AG',1,deadline) returning id into ada;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-augmento','AG',1,deadline) returning id into aug;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-destructo','AG',1,deadline) returning id into des;

  begin
    perform public.tcg_exchange('AG',ag,null,'activate_card',jsonb_build_object('card_id',red));raise exception 'Spell activated as a challenge';
  exception when raise_exception then if sqlerrm<>'spell_requires_target' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',red,'target_card_id',own_card));raise exception 'Own target accepted';
  exception when raise_exception then if sqlerrm<>'spell_unavailable' then raise; end if; end;
  response:=public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',red,'target_card_id',target_one));
  if not exists(select 1 from public.tcg_cards where id=red and status='used')
    or not exists(select 1 from public.tcg_cards where id=target_one and effect_modifier='reducto' and status='activated')
    or not exists(select 1 from jsonb_array_elements(response->'active_cards') c where c->>'id'=target_one::text and c->>'effect_modifier'='reducto') then raise exception 'REDUCTO failed'; end if;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',red,'target_card_id',target_two));raise exception 'Used spell replayed';
  exception when raise_exception then if sqlerrm<>'spell_unavailable' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',aug,'target_card_id',target_one));raise exception 'Second effect modification accepted';
  exception when raise_exception then if sqlerrm<>'effect_already_modified' then raise; end if; end;
  if not exists(select 1 from public.tcg_cards where id=aug and status='available') then raise exception 'Rejected spell consumed'; end if;
  perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',pre,'target_card_id',target_one));
  if not exists(select 1 from public.tcg_cards where id=target_one and effect_modifier='reducto' and time_modifier='presto' and active_until=now()+interval '5 hours') then raise exception 'PRESTO remaining-time or combined effect failed'; end if;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',ada,'target_card_id',target_one));raise exception 'Second duration modification accepted';
  exception when raise_exception then if sqlerrm<>'time_already_modified' then raise; end if; end;
  perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',aug,'target_card_id',target_two));
  perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',ada,'target_card_id',target_two));
  if not exists(select 1 from public.tcg_cards where id=target_two and effect_modifier='augmento' and time_modifier='adagio' and active_until=now()+interval '20 hours') then raise exception 'AUGMENTO/ADAGIO failed'; end if;

  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('qa-spell-secret','CL',5,deadline) returning id into private_card;
  insert into public.tcg_discoveries(role,template_id) values('CL','qa-spell-secret');
  response:=public.tcg_exchange('AG',ag,null,'sync');
  if exists(select 1 from jsonb_array_elements(response->'partner_cards') c where c->>'id'=private_card::text) then raise exception 'Unknown card exposed'; end if;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',des,'target_card_id',private_card));raise exception 'Unknown DESTRUCTO target accepted';
  exception when raise_exception then if sqlerrm<>'spell_unavailable' then raise; end if; end;
  insert into public.tcg_discoveries(role,template_id) values('AG','qa-spell-secret');
  perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',des,'target_card_id',private_card));
  if not exists(select 1 from public.tcg_cards where id=private_card and status='destroyed')
    or (select count(*) from public.tcg_discoveries where template_id='qa-spell-secret')<>2 then raise exception 'DESTRUCTO removed discovery or physical record'; end if;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at) values('spell-destructo','AG',6,deadline) returning id into extra;
  insert into public.tcg_cards(template_id,owner_role,status,wear_seed,expires_at) values('qa-spell-secret','CL','trading',6,deadline) returning id into trade_card;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',extra,'target_card_id',trade_card));raise exception 'Trading target destroyed';
  exception when raise_exception then if sqlerrm<>'spell_unavailable' then raise; end if; end;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,acquired_at,expires_at) values('qa-spell-secret','CL',7,now()-interval '7 days 1 minute',now()-interval '1 minute') returning id into expired_card;
  begin
    perform public.tcg_exchange('AG',ag,null,'use_spell',jsonb_build_object('spell_card_id',extra,'target_card_id',expired_card));raise exception 'Expired target destroyed';
  exception when raise_exception then if sqlerrm<>'spell_unavailable' then raise; end if; end;
  response:=public.tcg_exchange('CL',cl,null,'sync');
  if (select count(*) from public.tcg_card_events where target_card_id in (target_one,target_two,private_card))<>5
     or not exists(select 1 from jsonb_array_elements(response->'card_events') e where e->>'event_type'='spell_cast' and e->>'target_title'='Rituel fictif') then raise exception 'Spell history failed'; end if;

  -- Force the eligible pool to verify inclusion and finish without random flakiness.
  select array_agg(id) into excluded from public.tcg_card_templates where id not in ('spell-augmento','spell-destructo');
  select * into chosen from public.tcg_pick_template('AG','challenge_or_spell','full_art_foil',excluded);
  if chosen.id is null or chosen.card_type<>'spell' or chosen.finish_tier<>'full_art_foil' then raise exception 'Rare spell pool failed'; end if;
  select * into chosen from public.tcg_pick_template('AG','challenge','full_art_foil',excluded);
  if chosen.id is not null then raise exception 'Guaranteed challenge slot admitted a spell'; end if;
  for i in 1..6 loop
    insert into public.tcg_boosters(owner_role,bonus_key,available_at,expires_at) values('AG','qa-spell-pack-'||i,now(),now()+interval '48 hours') returning id into pack;
    perform public.tcg_exchange('AG',ag,null,'open_booster',jsonb_build_object('booster_id',pack));
    if (select count(*) from public.tcg_cards where booster_id=pack)<>3
      or (select count(*) from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=pack and t.card_type='energy')<>1
      or not exists(select 1 from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=pack and t.card_type='challenge') then raise exception 'Three-card/energy/challenge guarantee failed'; end if;
  end loop;
  if (select count(*) from public.tcg_card_templates where not demo)<>100 then raise exception 'Catalogue total must be 100'; end if;
  if has_table_privilege('anon','public.tcg_cards','update') then raise exception 'Direct write access exposed'; end if;
end;
$$;
select 'OK: all five spells, remaining-time math, one modifier per type, no consumption on denial, own/replay/unknown/trading/expired targets rejected, discoveries/history, rare pool and 3-card guarantees. Rolled back.' as checks;
rollback;
