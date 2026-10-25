-- Draw test-only boosters through the real API and roll the transaction back.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare ag text:=encode(extensions.gen_random_bytes(24),'hex');cl text:=encode(extensions.gen_random_bytes(24),'hex');
  pack uuid; response jsonb; snapshot jsonb; card_ids uuid[]; first_card uuid; game_before text; game_after text;
begin
  insert into public.tcg_player_devices(role,device_token_hash) values
    ('AG',encode(extensions.digest(ag,'sha256'),'hex')),('CL',encode(extensions.digest(cl,'sha256'),'hex'));
  insert into public.tcg_boosters(owner_role,bonus_key,available_at,expires_at)
    values('AG','qa-rollback-opening-receipt',now(),now()+interval '48 hours') returning id into pack;
  response:=public.tcg_exchange('AG',ag,null,'sync');
  if exists(select 1 from jsonb_array_elements(response->'pending_openings') r where r->>'booster_id'=pack::text) then raise exception 'Unopened booster has a receipt'; end if;
  response:=public.tcg_exchange('AG',ag,null,'open_booster',jsonb_build_object('booster_id',pack));
  select cards into snapshot from public.tcg_opening_receipts where booster_id=pack;
  if jsonb_array_length(snapshot)<>3 then raise exception 'Receipt needs three cards'; end if;
  select array_agg(id order by id) into card_ids from public.tcg_cards where booster_id=pack;
  perform public.tcg_exchange('AG',ag,null,'open_booster',jsonb_build_object('booster_id',pack));
  if (select array_agg(id order by id) from public.tcg_cards where booster_id=pack)<>card_ids
    or (select cards from public.tcg_opening_receipts where booster_id=pack)<>snapshot then raise exception 'Retry redrew or changed cards'; end if;
  game_before:=(select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(c) order by id) from public.tcg_cards c),
    (select jsonb_agg(to_jsonb(b) order by id) from public.tcg_boosters b),
    (select jsonb_agg(to_jsonb(d) order by role,template_id) from public.tcg_discoveries d),
    (select jsonb_agg(to_jsonb(t) order by id) from public.tcg_trades t))::text));
  response:=public.tcg_exchange('AG',ag,null,'opening_progress',jsonb_build_object('booster_id',pack,'index',2));
  if response->>'opening_saved'<>'true' or response ? 'my_cards' then raise exception 'Progress must return a lightweight acknowledgment'; end if;
  begin
    perform public.tcg_exchange('CL',cl,null,'opening_progress',jsonb_build_object('booster_id',pack,'index',1));
    raise exception 'Foreign progress accepted';
  exception when raise_exception then if sqlerrm<>'booster_unavailable' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',ag,null,'opening_progress',jsonb_build_object('booster_id',pack,'index',3));
    raise exception 'Invalid cursor accepted';
  exception when raise_exception then if sqlerrm<>'invalid_request' then raise; end if; end;
  game_after:=(select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(c) order by id) from public.tcg_cards c),
    (select jsonb_agg(to_jsonb(b) order by id) from public.tcg_boosters b),
    (select jsonb_agg(to_jsonb(d) order by role,template_id) from public.tcg_discoveries d),
    (select jsonb_agg(to_jsonb(t) order by id) from public.tcg_trades t))::text));
  if game_before<>game_after then raise exception 'Progress modified gameplay'; end if;
  response:=public.tcg_exchange('AG',ag,null,'sync');
  if not exists(select 1 from jsonb_array_elements(response->'pending_openings') r where r->>'booster_id'=pack::text and r->>'index'='2' and r->'cards'=snapshot) then raise exception 'Resume data missing'; end if;
  response:=public.tcg_exchange('CL',cl,null,'sync');
  if exists(select 1 from jsonb_array_elements(response->'pending_openings') r where r->>'booster_id'=pack::text) then raise exception 'Other profile receipt exposed'; end if;
  first_card:=card_ids[1];
  perform public.tcg_exchange('AG',ag,null,'give_card',jsonb_build_object('card_id',first_card));
  if (select cards from public.tcg_opening_receipts where booster_id=pack)<>snapshot then raise exception 'Gift changed drawn snapshot'; end if;
  perform public.tcg_exchange('AG',ag,null,'finish_opening',jsonb_build_object('booster_id',pack));
  perform public.tcg_exchange('AG',ag,null,'finish_opening',jsonb_build_object('booster_id',pack));
  perform public.tcg_exchange('AG',ag,null,'opening_progress',jsonb_build_object('booster_id',pack,'index',0));
  if (select reveal_index from public.tcg_opening_receipts where booster_id=pack)<>2 then raise exception 'Late progress reopened a finished receipt'; end if;
  response:=public.tcg_exchange('AG',ag,null,'sync');
  if exists(select 1 from jsonb_array_elements(response->'pending_openings') r where r->>'booster_id'=pack::text) then raise exception 'Completed receipt still offered'; end if;
  if (select count(*) from public.tcg_cards where booster_id=pack)<>3 then raise exception 'Finishing changed inventory'; end if;
  begin
    perform public.tcg_exchange('AG',ag,null,'open_booster',jsonb_build_object('booster_id',pack));
    raise exception 'Completed booster redrawn';
  exception when raise_exception then if sqlerrm<>'booster_unavailable' then raise; end if; end;
  if has_table_privilege('anon','public.tcg_opening_receipts','select') or has_table_privilege('authenticated','public.tcg_opening_receipts','update') then raise exception 'Direct receipt access exposed'; end if;
end;
$$;
select 'OK: exact three-card snapshot, idempotent opening, saved cursor, role privacy, lightweight progress, unchanged game data, gifts preserve snapshot, explicit finish and late writes. Rolled back.' as checks;
rollback;
