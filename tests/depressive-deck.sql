-- Run inside a transaction after the migration; ALWAYS ROLLBACK.
-- Refuse to touch a pre-existing live event. Device fixtures and all rewards roll back.
do $test$
declare
  tok text:=encode(extensions.gen_random_bytes(24),'hex');
  s jsonb;
  g public.tcg_deck_games%rowtype;
  old_board integer[];
  old_templates text[];
  before_cards bigint;
  before_discoveries text;
  i integer;
  step integer;
  r text;
  a integer;
  b integer;
  total bigint;
begin
  perform pg_advisory_xact_lock(hashtext('tcg:main'));
  if exists(select 1 from public.tcg_deck_games) then raise exception 'live_event_present_tests_refuse_to_run'; end if;
  if public.tcg_deck_window(timestamptz '2026-10-26 23:59 Europe/Paris') is not true
    or public.tcg_deck_window(timestamptz '2026-10-27 04:59:59 Europe/Paris') is not true
    or public.tcg_deck_window(timestamptz '2026-10-27 05:00 Europe/Paris') is not false
    or public.tcg_deck_window(timestamptz '2027-10-26 20:00 Europe/Paris') is not false then raise exception 'event_boundary_failed'; end if;
  select count(*) into total from generate_series(0,99999) x
    where public.tcg_deck_finish((x+.5)/100000.0)='legendary';
  if total<>500 then raise exception 'rarity_distribution_failed'; end if;
  foreach r in array array['AG','CL'] loop
    insert into public.tcg_player_devices(role,device_token_hash)
      values(r,encode(extensions.digest(convert_to(tok,'UTF8'),'sha256'),'hex'));
  end loop;
  begin
    perform public.tcg_exchange('AG',repeat('0',48),null,'deck_start','{}');
    raise exception 'unauthorized_device_accepted';
  exception when others then if sqlerrm<>'pairing_required' then raise; end if; end;
  select count(*) into before_cards from public.tcg_cards;
  select md5(coalesce(jsonb_agg(to_jsonb(d) order by role,template_id)::text,'')) into before_discoveries from public.tcg_discoveries d;
  s:=public.tcg_exchange('AG',tok,null,'deck_start','{}');
  if (s#>>'{depressive_deck,started}')::boolean is not true then raise exception 'start_failed'; end if;
  if exists(select 1 from jsonb_array_elements(s#>'{depressive_deck,tiles}') t where t->'motif'<>'null'::jsonb)
    or (s#>'{depressive_deck,rewards}')<>'[]'::jsonb
    or (s->'depressive_deck') ?| array['board','reward_templates','reward_card_ids'] then raise exception 'hidden_state_leaked'; end if;
  if (select count(*) from public.tcg_cards)<>before_cards
    or (select md5(coalesce(jsonb_agg(to_jsonb(d) order by role,template_id)::text,'')) from public.tcg_discoveries d)<>before_discoveries then raise exception 'early_discovery'; end if;
  select board,reward_templates into old_board,old_templates from public.tcg_deck_games where owner_role='AG';
  perform public.tcg_exchange('AG',tok,null,'deck_start','{}');
  if not exists(select 1 from public.tcg_deck_games where owner_role='AG' and board=old_board and reward_templates=old_templates) then raise exception 'draw_rerolled'; end if;
  -- Deterministic board only in this rollback fixture. Rewards remain real catalogue draws.
  update public.tcg_deck_games set board=array[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9] where owner_role='AG';
  for i in 0..9 loop
    s:=public.tcg_deck_snapshot('AG');
    s:=public.tcg_exchange('AG',tok,null,'deck_flip',jsonb_build_object('revision',s->>'revision','index',i*2));
    if (s#>>'{depressive_deck,turns}')::integer<>i then raise exception 'first_flip_cost_attempt'; end if;
    -- A second device cannot reuse a stale revision for a different flip.
    if i=0 then
      begin
        perform public.tcg_exchange('AG',tok,null,'deck_flip',jsonb_build_object('revision',1,'index',2));
        raise exception 'stale_revision_accepted';
      exception when others then if sqlerrm<>'deck_state_changed' then raise; end if; end;
    end if;
    s:=public.tcg_exchange('AG',tok,null,'deck_flip',jsonb_build_object('revision',s#>>'{depressive_deck,revision}','index',i*2+1));
    if (s#>>'{depressive_deck,turns}')::integer<>i+1 then raise exception 'attempt_not_charged'; end if;
    if (select count(*) from public.tcg_cards)<>before_cards+i then raise exception 'reward_before_resolution'; end if;
    if i=0 then
      begin
        perform public.tcg_exchange('AG',tok,null,'deck_flip',jsonb_build_object('revision',s#>>'{depressive_deck,revision}','index',4));
        raise exception 'third_flip_accepted';
      exception when others then if sqlerrm<>'deck_pending' then raise; end if; end;
    end if;
    s:=public.tcg_exchange('AG',tok,null,'deck_resolve',jsonb_build_object('revision',s#>>'{depressive_deck,revision}'));
    if (select count(*) from public.tcg_cards)<>before_cards+i+1 then raise exception 'reward_not_unique'; end if;
    s:=public.tcg_exchange('AG',tok,null,'deck_resolve',jsonb_build_object('revision',s#>>'{depressive_deck,revision}'));
    if (select count(*) from public.tcg_cards)<>before_cards+i+1 then raise exception 'resolve_duplicated_reward'; end if;
    s:=public.tcg_exchange('AG',tok,null,'deck_continue',jsonb_build_object('revision',s#>>'{depressive_deck,revision}'));
  end loop;
  if (s#>>'{depressive_deck,done}')::boolean is not true or jsonb_array_length(s#>'{depressive_deck,rewards}')<>10 then raise exception 'perfect_game_failed'; end if;
  perform public.tcg_exchange('AG',tok,null,'deck_start','{}');
  if (select count(*) from public.tcg_cards)<>before_cards+10 then raise exception 'completed_game_restarted'; end if;

  -- All misses: ten physical Energies, no hidden reward discovered.
  perform public.tcg_exchange('CL',tok,null,'deck_start','{}');
  update public.tcg_deck_games set board=array[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9] where owner_role='CL';
  select count(*) into before_cards from public.tcg_cards;
  select md5(coalesce(jsonb_agg(to_jsonb(d) order by template_id)::text,'')) into before_discoveries
    from public.tcg_discoveries d where role='CL' and template_id<>'energy-bisou';
  for i in 1..20 loop
    s:=public.tcg_deck_snapshot('CL');
    s:=public.tcg_exchange('CL',tok,null,'deck_flip',jsonb_build_object('revision',s->>'revision','index',0));
    s:=public.tcg_exchange('CL',tok,null,'deck_flip',jsonb_build_object('revision',s#>>'{depressive_deck,revision}','index',2));
    s:=public.tcg_exchange('CL',tok,null,'deck_resolve',jsonb_build_object('revision',s#>>'{depressive_deck,revision}'));
    if i<20 and (select count(*) from public.tcg_cards)<>before_cards then raise exception 'consolation_too_early'; end if;
  end loop;
  if (select count(*) from public.tcg_cards)<>before_cards+10
    or (s#>>'{depressive_deck,found}')::integer<>0
    or exists(select 1 from jsonb_array_elements(s#>'{depressive_deck,rewards}') c where c->>'template_id'<>'energy-bisou')
    or (select md5(coalesce(jsonb_agg(to_jsonb(d) order by template_id)::text,'')) from public.tcg_discoveries d where role='CL' and template_id<>'energy-bisou')<>before_discoveries then raise exception 'energy_only_loss_failed'; end if;

  -- Fresh rollback-only fixtures for a partial win and a final-turn win.
  for step in 1..2 loop
    delete from public.tcg_deck_games where owner_role='AG';
    perform public.tcg_deck_action('AG','deck_start','{}',timestamptz '2026-10-26 20:00 Europe/Paris');
    update public.tcg_deck_games set board=array[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9] where owner_role='AG';
    if step=1 then
      update public.tcg_deck_games set reward_templates[1]=(select id from public.tcg_card_templates where card_type='joker' and active and not demo limit 1),
        reward_templates[2]=(select id from public.tcg_card_templates where card_type='spell' and active and not demo limit 1) where owner_role='AG';
    end if;
    for i in 1..20 loop
      select * into g from public.tcg_deck_games where owner_role='AG';
      if step=1 then a:=case when i<=7 then (i-1)*2 else 14 end;b:=case when i<=7 then a+1 else 16 end;
      else a:=case when i<=10 then 0 else (i-11)*2 end;b:=case when i<=10 then 2 else a+1 end;end if;
      perform public.tcg_deck_action('AG','deck_flip',jsonb_build_object('revision',g.revision,'index',a),timestamptz '2026-10-29 20:00 Europe/Paris');
      select * into g from public.tcg_deck_games where owner_role='AG';
      perform public.tcg_deck_action('AG','deck_flip',jsonb_build_object('revision',g.revision,'index',b),timestamptz '2026-10-29 20:00 Europe/Paris');
      select * into g from public.tcg_deck_games where owner_role='AG';
      perform public.tcg_deck_action('AG','deck_resolve',jsonb_build_object('revision',g.revision),timestamptz '2026-10-29 20:00 Europe/Paris');
      select * into g from public.tcg_deck_games where owner_role='AG';
      perform public.tcg_deck_action('AG','deck_continue',jsonb_build_object('revision',g.revision),timestamptz '2026-10-29 20:00 Europe/Paris');
    end loop;
    s:=public.tcg_deck_snapshot('AG');
    if (s->>'found')::integer<>(case when step=1 then 7 else 10 end) or jsonb_array_length(s->'rewards')<>10 then raise exception 'partial_or_final_turn_failed'; end if;
    select count(*) into total from jsonb_array_elements(s->'rewards') c where c->>'card_type'='energy';
    if total<>(case when step=1 then 3 else 0 end) then raise exception 'partial_energy_count_failed'; end if;
    if step=1 and (not exists(select 1 from jsonb_array_elements(s->'rewards') c where c->>'card_type'='joker')
      or not exists(select 1 from jsonb_array_elements(s->'rewards') c where c->>'card_type'='spell')) then raise exception 'special_rewards_failed'; end if;
  end loop;
  delete from public.tcg_deck_games where owner_role='AG';
  begin
    perform public.tcg_deck_action('AG','deck_start','{}',timestamptz '2026-10-27 05:00 Europe/Paris');
    raise exception 'deadline_accepted_new_game';
  exception when others then if sqlerrm<>'deck_closed' then raise; end if; end;
  if has_table_privilege('anon','public.tcg_deck_games','SELECT')
    or has_table_privilege('authenticated','public.tcg_deck_games','UPDATE')
    or has_function_privilege('anon','public.tcg_deck_action(text,text,jsonb,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.tcg_deck_snapshot(text,timestamptz)','EXECUTE') then raise exception 'private_helpers_exposed'; end if;
end;
$test$;
