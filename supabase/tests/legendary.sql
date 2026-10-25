-- Temporary fixtures exercise the real API. All changes are rolled back.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare token text:=encode(extensions.gen_random_bytes(24),'hex');card uuid;pack uuid;response jsonb;options jsonb;choice text;i integer;v_category text;
begin
  insert into public.tcg_player_devices(role,device_token_hash) values('AG',encode(extensions.digest(token,'sha256'),'hex'));
  update public.tcg_card_templates set active=true where id like 'legend-%' or card_type='spell';
  if (select count(*) from public.tcg_card_templates where not demo)<>100 or
     (select count(*) from public.tcg_card_templates where not demo and edition='edition_01')<>90 then raise exception 'Expected 90 + 10 catalogue'; end if;
  if exists(select 1 from public.tcg_card_templates where id in ('fafoil-foodies-journee','fafoil-todo-travaux') and (active or not demo)) then raise exception 'Choice-only definitions leaked into catalogue'; end if;
  foreach v_category in array array['EN COUPLE','POUR L''AUTRE','MISE À NUE','LES FOODIES','TO DO'] loop
    options:=public.tcg_legendary_options('AG',v_category);
    if jsonb_array_length(options)=0 then raise exception 'Missing category choices: %',v_category;end if;
    if exists(select 1 from jsonb_array_elements(options) o join public.tcg_card_templates t on t.id=o->>'id' where t.category<>v_category or (t.eligible_role is not null and t.eligible_role<>'AG') or t.finish_tier<>'full_art_foil') then raise exception 'Choice category/role/finish leaked';end if;
  end loop;
  if public.tcg_legendary_options('AG','LES FOODIES')->0->>'title'<>'on mange TOUT ce que je veux, toute la journée' then raise exception 'Foodies wording changed';end if;
  insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,expires_at) values('legend-foodies','AG','legendary',1,now()+interval '7 days') returning id into card;
  insert into public.tcg_discoveries(role,template_id) values('AG','legend-foodies');
  begin
    perform public.tcg_exchange('AG',token,null,'activate_card',jsonb_build_object('card_id',card));raise exception 'Legendary activated without choice';
  exception when raise_exception then if sqlerrm<>'invalid_legendary_choice' then raise;end if;end;
  begin
    perform public.tcg_exchange('AG',token,null,'activate_card',jsonb_build_object('card_id',card,'choice_template_id','fafoil-todo-travaux'));raise exception 'Wrong category choice accepted';
  exception when raise_exception then if sqlerrm<>'invalid_legendary_choice' then raise;end if;end;
  if not exists(select 1 from public.tcg_cards where id=card and status='available' and selected_template_id is null) then raise exception 'Rejected choice consumed the card';end if;
  response:=public.tcg_exchange('AG',token,null,'activate_card',jsonb_build_object('card_id',card,'choice_template_id','fafoil-foodies-journee'));
  if not exists(select 1 from public.tcg_cards where id=card and status='activated' and selected_template_id='fafoil-foodies-journee' and active_until=now()+interval '24 hours') then raise exception 'Chosen challenge not persisted';end if;
  if not exists(select 1 from jsonb_array_elements(response->'active_cards') c where c->>'id'=card::text and c->>'title'='on mange TOUT ce que je veux, toute la journée' and c->>'finish'='legendary') then raise exception 'Active legendary did not show chosen effect';end if;
  if exists(select 1 from public.tcg_discoveries where role='AG' and template_id='fafoil-foodies-journee') then raise exception 'Choice effect counted as a separate collectible';end if;
  insert into public.tcg_boosters(owner_role,bonus_key,available_at,expires_at) values('AG','spells-legends-test-2026-10-25',now(),now()+interval '48 hours') returning id into pack;
  response:=public.tcg_exchange('AG',token,null,'open_booster',jsonb_build_object('booster_id',pack));
  if (select count(*) from public.tcg_cards where booster_id=pack)<>3 or exists(select 1 from public.tcg_cards where booster_id=pack and finish='legendary') then raise exception 'Gift size or no-legendary guarantee failed';end if;
  foreach v_category in array array['energy','challenge','spell'] loop
    if (select count(*) from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=pack and t.card_type=v_category)<>1 then raise exception 'Gift missing exactly one %',v_category;end if;
  end loop;
  perform public.tcg_exchange('AG',token,null,'open_booster',jsonb_build_object('booster_id',pack));
  if (select count(*) from public.tcg_cards where booster_id=pack)<>3 then raise exception 'Gift receipt retry redrew cards';end if;
  if has_function_privilege('anon','public.tcg_legendary_options(text,text)','execute') then raise exception 'Internal choice helper is public';end if;
end;$$;
select 'OK: 90+10 catalogue, category/role/finish choices, no-choice/wrong-category rejected without consuming, selected effect persisted, no extra discovery, guaranteed Energy+challenge+spell gift without legendary, idempotent opening. Rolled back.' as checks;
rollback;
