-- Real API exercise against temporary fixtures only; every write is rolled back.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare
  token_ag text := encode(extensions.gen_random_bytes(24),'hex');
  token_cl text := encode(extensions.gen_random_bytes(24),'hex');
  template text; card uuid; copy uuid; blocked uuid; result jsonb;
  deadline timestamptz := now()+interval '7 days'; initial_seen integer;
begin
  insert into public.tcg_player_devices(role,device_token_hash)
  values ('AG',encode(extensions.digest(token_ag,'sha256'),'hex')),
         ('CL',encode(extensions.digest(token_cl,'sha256'),'hex'));
  insert into public.tcg_card_templates(id,category,title,challenge,palette,demo)
  values ('qa-card-management-rollback','EN COUPLE','Démonstration','Fixture de test uniquement.','couple',true);
  template := 'qa-card-management-rollback';
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at)
  values (template,'AG',1,deadline) returning id into card;
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at)
  values (template,'AG',2,deadline) returning id into copy;
  insert into public.tcg_discoveries(role,template_id) values ('AG',template);

  -- Invalid credentials, missing IDs and someone else's card cannot be managed.
  begin
    perform public.tcg_exchange('AG',repeat('0',48),null,'destroy_card',jsonb_build_object('card_id',card));
    raise exception 'Invalid token accepted';
  exception when raise_exception then if sqlerrm <> 'pairing_required' then raise; end if; end;
  begin
    perform public.tcg_exchange('CL',token_cl,null,'give_card',jsonb_build_object('card_id',card));
    raise exception 'Foreign owner accepted';
  exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',token_ag,null,'destroy_card','{}');
    raise exception 'Missing ID accepted';
  exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;

  result := public.tcg_exchange('AG',token_ag,null,'give_card',jsonb_build_object('card_id',card));
  if exists(select 1 from jsonb_array_elements(result->'my_cards') c where c->>'id'=card::text)
     or not exists(select 1 from public.tcg_cards where id=card and owner_role='CL' and expires_at=deadline and status='available')
     or not exists(select 1 from public.tcg_discoveries where role='AG' and template_id=template)
     or not exists(select 1 from public.tcg_discoveries where role='CL' and template_id=template) then
    raise exception 'Gift or discovery preservation failed';
  end if;
  begin
    perform public.tcg_exchange('AG',token_ag,null,'give_card',jsonb_build_object('card_id',card));
    raise exception 'Duplicate gift accepted';
  exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;
  -- The recipient can give it back; no new physical copy or lifetime is created.
  perform public.tcg_exchange('CL',token_cl,null,'give_card',jsonb_build_object('card_id',card));
  result := public.tcg_exchange('AG',token_ag,null,'destroy_card',jsonb_build_object('card_id',card));
  if not exists(select 1 from public.tcg_cards where id=card and status='destroyed' and consumed_at is not null)
     or not exists(select 1 from public.tcg_cards where id=copy and status='available')
     or not exists(select 1 from jsonb_array_elements(result->'known_cards') c where c->>'template_id'=template and (c->>'owned_count')::integer=1)
     or exists(select 1 from jsonb_array_elements(result->'my_cards') c where c->>'id'=card::text) then
    raise exception 'Destruction must preserve discovery and other copies';
  end if;
  begin
    perform public.tcg_exchange('AG',token_ag,null,'destroy_card',jsonb_build_object('card_id',card));
    raise exception 'Repeated destruction accepted';
  exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;

  foreach template in array array['trading','activated','used','expired'] loop
    insert into public.tcg_cards(template_id,owner_role,status,wear_seed,acquired_at,expires_at,activated_at,active_until)
    values ('qa-card-management-rollback','AG',template,3,
      case when template='expired' then now()-interval '8 days' else now() end,
      case when template='expired' then now()-interval '1 day' else deadline end,
      case when template='activated' then now() end,case when template='activated' then now()+interval '24 hours' end)
    returning id into blocked;
    begin
      perform public.tcg_exchange('AG',token_ag,null,'give_card',jsonb_build_object('card_id',blocked));
      raise exception 'Unavailable gift accepted';
    exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;
    begin
      perform public.tcg_exchange('AG',token_ag,null,'destroy_card',jsonb_build_object('card_id',blocked));
      raise exception 'Unavailable destruction accepted';
    exception when raise_exception then if sqlerrm <> 'card_unavailable' then raise; end if; end;
  end loop;
  if (select count(*) from public.tcg_card_events where card_id=card) <> 3 then raise exception 'Audit count failed'; end if;
  if has_table_privilege('anon','public.tcg_card_events','select')
     or has_table_privilege('authenticated','public.tcg_card_events','insert') then raise exception 'Audit exposed'; end if;
end;
$$;
select 'OK: gift, return, expiry preserved, destruction, discovery, duplicates, denied ownership/status/token, audit. All test writes rolled back.' as checks;
rollback;
