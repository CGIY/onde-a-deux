-- Non-destructive checks: all generated cards, devices and boosters roll back.
begin;
do $$
declare
  base_ids text[];
  sample public.tcg_card_templates%rowtype;
  v_at timestamptz;
  n integer;
begin
  if (select count(*) from public.tcg_card_templates where not demo and edition = 'edition_01') <> 80 then raise exception 'Base catalogue changed'; end if;
  if (select count(*) from public.tcg_card_templates where edition = 'halloween_2026') <> 10 then raise exception 'Expected ten seasonal cards'; end if;
  if (select count(*) from public.tcg_card_templates where edition = 'halloween_2026' and finish_tier = 'standard') <> 7 then raise exception 'Common finish changed'; end if;
  if (select count(*) from public.tcg_card_templates where edition = 'halloween_2026' and finish_tier = 'full_art') <> 1 then raise exception 'Full art finish changed'; end if;
  if (select count(*) from public.tcg_card_templates where edition = 'halloween_2026' and finish_tier = 'foil') <> 2 then raise exception 'Foil finish changed'; end if;
  select array_agg(id) into base_ids from public.tcg_card_templates where edition = 'edition_01';
  foreach v_at in array array[timestamptz '2026-10-28 23:59:59 Europe/Paris', timestamptz '2026-11-02 00:00:00 Europe/Paris'] loop
    select count(*) into n from public.tcg_pick_template('AG','challenge','standard',base_ids,v_at);
    if n <> 0 then raise exception 'Seasonal draw outside its window'; end if;
    select count(*) into n from public.tcg_pick_template('AG','energy','standard',base_ids,v_at);
    if n <> 0 then raise exception 'Seasonal energy outside its window'; end if;
  end loop;
  foreach v_at in array array[timestamptz '2026-10-29 00:00:00 Europe/Paris', timestamptz '2026-11-01 23:59:59 Europe/Paris'] loop
    select * into sample from public.tcg_pick_template('AG','challenge','standard',base_ids,v_at);
    if sample.edition is distinct from 'halloween_2026' then raise exception 'Missing seasonal challenge'; end if;
    select * into sample from public.tcg_pick_template('CL','energy','standard',base_ids,v_at);
    if sample.edition is distinct from 'halloween_2026' then raise exception 'Missing seasonal energy'; end if;
  end loop;
  if has_function_privilege('anon','public.tcg_pick_template(text,text,text,text[],timestamptz)','execute') then raise exception 'Internal picker exposed'; end if;
  if has_table_privilege('anon','public.tcg_card_templates','select') then raise exception 'Unknown catalogue exposed'; end if;
end;
$$;
-- RPC login/open/activation checks use a temporary device and booster. The
-- caller supplies the existing AG code via a transaction-local setting.
do $$
declare
  token text := encode(extensions.gen_random_bytes(24),'hex');
  data jsonb;
  opened jsonb;
  v_booster_id uuid;
  challenge_id uuid;
  slot jsonb;
  v_card record;
begin
  data := public.tcg_exchange('AG',token,current_setting('tcg.test_access_code'),'login','{}');
  if (data->>'catalogue_total')::integer <> 90 or jsonb_array_length(data->'catalogue_slots') <> 90 then raise exception 'Wrong album size'; end if;
  if (data->'rules'->>'collection_days')::integer <> 7 then raise exception 'Wrong retention rule'; end if;
  for slot in select value from jsonb_array_elements(data->'catalogue_slots') loop
    if (select count(*) from jsonb_object_keys(slot)) <> 3 then raise exception 'Slot metadata leak'; end if;
    if slot->>'template_id' is not null and not exists(select 1 from jsonb_array_elements(data->'known_cards') k where k->>'template_id' = slot->>'template_id') then raise exception 'Unknown card exposed'; end if;
  end loop;
  insert into public.tcg_boosters(owner_role,release_date,available_at,expires_at)
  values('AG','2099-10-31',now(),now()+interval '48 hours') returning id into v_booster_id;
  opened := public.tcg_exchange('AG',token,null,'open_booster',jsonb_build_object('booster_id',v_booster_id));
  if (select count(*) from public.tcg_cards c where c.booster_id = v_booster_id) <> 3 then raise exception 'Not three cards'; end if;
  if (select count(*) from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=v_booster_id and t.card_type='energy') <> 1 then raise exception 'Energy slot missing'; end if;
  for v_card in select * from public.tcg_cards c where c.booster_id = v_booster_id loop
    if v_card.expires_at <> v_card.acquired_at + interval '7 days' then raise exception 'Not seven days'; end if;
    if now() < timestamptz '2026-10-29 00:00:00 Europe/Paris' and v_card.template_id like 'hw-%' then raise exception 'Early seasonal drop'; end if;
  end loop;
  begin
    perform public.tcg_exchange('AG',token,null,'open_booster',jsonb_build_object('booster_id',v_booster_id));
    raise exception 'Booster could be reopened';
  exception when others then
    if sqlerrm not like '%booster_unavailable%' then raise; end if;
  end;
  select c.id into challenge_id from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=v_booster_id and t.card_type='challenge' limit 1;
  perform public.tcg_exchange('AG',token,null,'activate_card',jsonb_build_object('card_id',challenge_id));
  if not exists(select 1 from public.tcg_cards where id=challenge_id and active_until=activated_at+interval '24 hours') then raise exception 'Activation is not 24 hours'; end if;
end;
$$;
select 'Catalogue 80+10, finitions, limites de saison, confidentialité, booster de 3 cartes, réouverture bloquée, durée 7j et activation 24h : OK' as checks;
rollback;
