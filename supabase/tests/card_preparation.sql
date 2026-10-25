-- Exercise the real token-validated API using fixtures; roll every write back.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare
  ag text:=encode(extensions.gen_random_bytes(24),'hex');
  cl text:=encode(extensions.gen_random_bytes(24),'hex');
  card uuid; active_card uuid; private_card uuid; response jsonb;
  deadline timestamptz:=now()+interval '7 days';
begin
  insert into public.tcg_player_devices(role,device_token_hash) values
    ('AG',encode(extensions.digest(ag,'sha256'),'hex')),('CL',encode(extensions.digest(cl,'sha256'),'hex'));
  insert into public.tcg_card_templates(id,category,title,challenge,palette,demo) values
    ('qa-preparation-visible','EN COUPLE','Test visible','Fixture temporaire.','couple',true),
    ('qa-preparation-private','EN COUPLE','Titre secret de test','Fixture temporaire.','couple',true);
  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at)
    values('qa-preparation-visible','AG',1,deadline) returning id into card;
  insert into public.tcg_discoveries(role,template_id) values('AG','qa-preparation-visible');
  response:=public.tcg_exchange('AG',ag,null,'pin_card',jsonb_build_object('card_id',card,'is_pinned',true));
  perform public.tcg_exchange('AG',ag,null,'pin_card',jsonb_build_object('card_id',card,'is_pinned',true));
  if not exists(select 1 from public.tcg_cards where id=card and is_pinned and expires_at=deadline)
    or not exists(select 1 from jsonb_array_elements(response->'my_cards') c where c->>'id'=card::text and (c->>'is_pinned')::boolean)
    then raise exception 'Pin persistence, API or idempotency failed'; end if;
  begin
    perform public.tcg_exchange('CL',cl,null,'pin_card',jsonb_build_object('card_id',card,'is_pinned',false));
    raise exception 'Foreign pin accepted';
  exception when raise_exception then if sqlerrm<>'card_unavailable' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',ag,null,'pin_card',jsonb_build_object('card_id',card,'is_pinned','true'));
    raise exception 'Non-boolean pin accepted';
  exception when raise_exception then if sqlerrm<>'invalid_request' then raise; end if; end;
  begin
    perform public.tcg_exchange('AG',ag,null,'complete_card',jsonb_build_object('card_id',card));
    raise exception 'Unplayed card completed';
  exception when raise_exception then if sqlerrm<>'card_unavailable' then raise; end if; end;
  perform public.tcg_exchange('AG',ag,null,'give_card',jsonb_build_object('card_id',card));
  if exists(select 1 from public.tcg_cards where id=card and is_pinned) then raise exception 'Gift carried another player pin'; end if;
  response:=public.tcg_exchange('CL',cl,null,'sync');
  if not exists(select 1 from jsonb_array_elements(response->'card_events') e where e->>'card_id'=card::text and e->>'event_type'='give_card') then raise exception 'Recipient gift history missing'; end if;

  -- An activated card may outlive its collection deadline; its active timer wins.
  insert into public.tcg_cards(template_id,owner_role,status,wear_seed,acquired_at,expires_at,activated_at,active_until)
    values('qa-preparation-visible','AG','activated',2,now()-interval '7 days 1 minute',now()-interval '1 minute',now()-interval '1 hour',now()+interval '23 hours') returning id into active_card;
  begin
    perform public.tcg_exchange('CL',cl,null,'complete_card',jsonb_build_object('card_id',active_card));
    raise exception 'Other owner completion accepted';
  exception when raise_exception then if sqlerrm<>'card_unavailable' then raise; end if; end;
  response:=public.tcg_exchange('AG',ag,null,'complete_card',jsonb_build_object('card_id',active_card));
  if not exists(select 1 from public.tcg_cards where id=active_card and status='used' and active_until=now() and consumed_at=now())
    or exists(select 1 from jsonb_array_elements(response->'active_cards') c where c->>'id'=active_card::text)
    or not exists(select 1 from jsonb_array_elements(response->'known_cards') c where c->>'template_id'='qa-preparation-visible')
    or not exists(select 1 from jsonb_array_elements(response->'card_events') e where e->>'card_id'=active_card::text and e->>'event_type'='complete_card') then raise exception 'Completion state, discovery or history failed'; end if;
  begin
    perform public.tcg_exchange('AG',ag,null,'complete_card',jsonb_build_object('card_id',active_card));
    raise exception 'Repeated completion accepted';
  exception when raise_exception then if sqlerrm<>'card_unavailable' then raise; end if; end;
  if (select count(*) from public.tcg_card_events where card_id=active_card)<>1 then raise exception 'Duplicate completion event'; end if;

  insert into public.tcg_cards(template_id,owner_role,wear_seed,expires_at)
    values('qa-preparation-private','CL',3,deadline) returning id into private_card;
  perform public.tcg_exchange('CL',cl,null,'destroy_card',jsonb_build_object('card_id',private_card));
  response:=public.tcg_exchange('AG',ag,null,'sync');
  if exists(select 1 from jsonb_array_elements(response->'card_events') e where e->>'card_id'=private_card::text)
     or response->'card_events' @> '[{"title":"Titre secret de test"}]'::jsonb then raise exception 'History leaked private destruction'; end if;
  if has_table_privilege('anon','public.tcg_cards','update') or has_table_privilege('anon','public.tcg_card_events','select') then raise exception 'Direct access exposed'; end if;
end;
$$;
select 'OK: persistent/idempotent pins, unchanged expiry, personal pins on gifts, owner-only active completion, discoveries, history visibility, replay and private titles. Rolled back.' as checks;
rollback;
