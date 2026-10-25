select pg_advisory_xact_lock(hashtext('tcg:main'));
select set_config('tcg.legends_before',(select md5(jsonb_build_array(
(select jsonb_agg(to_jsonb(c)-'selected_template_id' order by id) from public.tcg_cards c),
(select jsonb_agg(to_jsonb(b) order by id) from public.tcg_boosters b),
(select jsonb_agg(to_jsonb(d) order by role,template_id) from public.tcg_discoveries d),
(select jsonb_agg(to_jsonb(t) order by id) from public.tcg_trades t),
(select jsonb_agg(to_jsonb(e) order by id) from public.tcg_card_events e),
(select jsonb_agg(to_jsonb(r) order by booster_id) from public.tcg_opening_receipts r),
(select jsonb_agg(to_jsonb(t) order by id) from public.tcg_card_templates t where id not like 'legend-%' and id not in ('fafoil-foodies-journee','fafoil-todo-travaux'))
)::text)),true);
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_finish_tier_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_finish_tier_check
  check (finish_tier in ('standard','foil','full_art','full_art_foil','legendary'));
alter table public.tcg_cards drop constraint if exists tcg_cards_finish_check;
alter table public.tcg_cards add constraint tcg_cards_finish_check
  check (finish in ('standard','foil','full_art','full_art_foil','legendary'));
alter table public.tcg_cards add column if not exists selected_template_id text references public.tcg_card_templates(id);
create index if not exists tcg_cards_selected_template_idx on public.tcg_cards(selected_template_id);
alter table public.tcg_cards drop constraint if exists tcg_cards_selected_check;
alter table public.tcg_cards add constraint tcg_cards_selected_check check (selected_template_id is null or finish='legendary');


do $$ begin
if exists(select 1 from public.tcg_cards where template_id in ('fafoil-foodies-journee','fafoil-todo-travaux')) or exists(select 1 from public.tcg_discoveries where template_id in ('fafoil-foodies-journee','fafoil-todo-travaux')) then raise exception 'Effect definitions already collected'; end if;
end; $$;
update public.tcg_card_templates set active=false,demo=true where id in ('fafoil-foodies-journee','fafoil-todo-travaux');

insert into public.tcg_card_templates(id,category,title,challenge,symbol,palette,card_type,finish_tier,rarity,active,demo,edition) values
('legend-couple','EN COUPLE','EN COUPLE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','couple','challenge','legendary','légendaire',false,false,'edition_01'),
('legend-other','POUR L''AUTRE','POUR L’AUTRE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','other','challenge','legendary','légendaire',false,false,'edition_01'),
('legend-nude','MISE À NUE','MISE À NUE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','nude','challenge','legendary','légendaire',false,false,'edition_01'),
('legend-foodies','LES FOODIES','LES FOODIES · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','foodies','challenge','legendary','légendaire',false,false,'edition_01'),
('legend-todo','TO DO','TO DO · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','todo','challenge','legendary','légendaire',false,false,'edition_01')
on conflict(id) do update set title=excluded.title,challenge=excluded.challenge,category=excluded.category,
  symbol=excluded.symbol,palette=excluded.palette,card_type=excluded.card_type,finish_tier=excluded.finish_tier,
  rarity=excluded.rarity,active=excluded.active,demo=excluded.demo,edition=excluded.edition;


create or replace function public.tcg_legendary_options(p_role text,p_category text) returns jsonb
language sql stable set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'challenge',t.challenge) order by t.id),'[]'::jsonb)
  from public.tcg_card_templates t where t.category=p_category and t.card_type='challenge' and t.finish_tier='full_art_foil'
    and (t.eligible_role is null or t.eligible_role=p_role)
    and ((t.active and not t.demo) or t.id in ('fafoil-foodies-journee','fafoil-todo-travaux'));
$$;
revoke all on function public.tcg_legendary_options(text,text) from public,anon,authenticated;


create or replace function public.tcg_exchange(
  p_role text,
  p_token text,
  p_access_code text default null,
  p_action text default 'sync',
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  player public.tcg_players%rowtype;
  booster public.tcg_boosters%rowtype;
  receipt public.tcg_opening_receipts%rowtype;
  choice_row public.tcg_card_templates%rowtype;
  offered public.tcg_cards%rowtype;
  requested public.tcg_cards%rowtype;
  trade_row public.tcg_trades%rowtype;
  template_row public.tcg_card_templates%rowtype;
  v_role text := upper(coalesce(p_role, ''));
  v_other text;
  v_token_hash text;
  v_access_hash text;
  v_device_known boolean;
  v_local_now timestamp;
  v_release_date date;
  v_available_at timestamptz;
  v_roll double precision;
  v_finish text;
  v_draw_index integer;
  v_draw_type text;
  v_desired_finish text;
  v_pool_type text;
  v_drawn_template_ids text[] := array[]::text[];
  v_boosters jsonb;
  v_my_cards jsonb;
  v_partner_cards jsonb;
  v_active_cards jsonb;
  v_known jsonb;
  v_trades jsonb;
begin
  if v_role not in ('AG', 'CL')
     or coalesce(p_token, '') !~ '^[a-f0-9]{48}$'
     or coalesce(p_action, '') not in ('login', 'sync', 'open_booster', 'activate_card', 'use_joker', 'trade_propose', 'trade_respond', 'trade_cancel', 'release_device', 'give_card', 'destroy_card', 'pin_card', 'complete_card', 'opening_progress', 'finish_opening', 'use_spell')
     or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or length(coalesce(p_payload, '{}'::jsonb)::text) > 12000 then
    raise exception 'invalid_request';
  end if;

  v_other := case when v_role = 'AG' then 'CL' else 'AG' end;
  v_token_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtext('tcg:main'));

  select * into player from public.tcg_players where role = v_role for update;
  if not found then raise exception 'unknown_profile'; end if;

  select exists(
    select 1 from public.tcg_player_devices
    where role = v_role and device_token_hash = v_token_hash
  ) into v_device_known;

  if not v_device_known then
    if p_action <> 'login' then raise exception 'pairing_required'; end if;
    if regexp_replace(upper(coalesce(p_access_code, '')), '[[:space:]-]', '', 'g') !~ '^[A-Z0-9]{10,16}$' then raise exception 'invalid_access_code'; end if;
    v_access_hash := encode(extensions.digest(convert_to(regexp_replace(upper(p_access_code), '[[:space:]-]', '', 'g'), 'UTF8'), 'sha256'), 'hex');
    if v_access_hash <> player.access_code_hash then raise exception 'invalid_access_code'; end if;
    insert into public.tcg_player_devices(role, device_token_hash)
    values (v_role, v_token_hash)
    on conflict (role, device_token_hash) do update set last_seen = now();
  end if;
  update public.tcg_player_devices set last_seen = now()
  where role = v_role and device_token_hash = v_token_hash;
  update public.tcg_players set device_token_hash = null, last_seen = now() where role = v_role;

  -- Receipt writes never run timed game transitions or create a daily booster.
  if p_action in ('opening_progress','finish_opening') then
    begin
      select * into receipt from public.tcg_opening_receipts
      where booster_id=(p_payload->>'booster_id')::uuid and owner_role=v_role for update;
    exception when invalid_text_representation then raise exception 'booster_unavailable'; end;
    if receipt.booster_id is null then raise exception 'booster_unavailable'; end if;
    if p_action='finish_opening' then
      update public.tcg_opening_receipts set completed_at=coalesce(completed_at,now()) where booster_id=receipt.booster_id;
    else
      if coalesce(p_payload->>'index','') !~ '^[0-2]$' then raise exception 'invalid_request'; end if;
      update public.tcg_opening_receipts set reveal_index=(p_payload->>'index')::integer, progress_at=now()
      where booster_id=receipt.booster_id and completed_at is null;
    end if;
    return jsonb_build_object('opening_saved',true,'server_now',now());
  end if;

  -- Timed transitions are server-authoritative.
  update public.tcg_cards
  set status = 'used', consumed_at = coalesce(consumed_at, active_until)
  where status = 'activated' and active_until <= now();

  for trade_row in
    select t.*
    from public.tcg_trades t
    join public.tcg_cards a on a.id = t.offered_card_id
    join public.tcg_cards b on b.id = t.requested_card_id
    where t.status = 'pending'
      and (t.expires_at <= now() or a.expires_at <= now() or b.expires_at <= now())
    for update of t
  loop
    update public.tcg_cards
    set status = case when expires_at <= now() then 'expired' else 'available' end
    where id in (trade_row.offered_card_id, trade_row.requested_card_id) and status = 'trading';
    update public.tcg_trades set status = 'expired', responded_at = now() where id = trade_row.id;
  end loop;

  update public.tcg_cards
  set status = 'expired'
  where status = 'available' and expires_at <= now();

  v_local_now := timezone('Europe/Paris', now());
  v_release_date := (v_local_now - interval '5 hours')::date;
  v_available_at := make_timestamptz(
    extract(year from v_release_date)::integer,
    extract(month from v_release_date)::integer,
    extract(day from v_release_date)::integer,
    5, 0, 0, 'Europe/Paris'
  );

  insert into public.tcg_boosters(owner_role, release_date, available_at, expires_at)
  select role, v_release_date, v_available_at, v_available_at + interval '48 hours'
  from public.tcg_players
  on conflict (owner_role, release_date) do nothing;

  if p_action = 'open_booster' then
    begin
      select * into booster
      from public.tcg_boosters
      where id = (p_payload->>'booster_id')::uuid
        and owner_role = v_role
      for update;
    exception when invalid_text_representation then
      raise exception 'invalid_booster';
    end;
    if not found then raise exception 'booster_unavailable'; end if;
    if booster.opened_at is null and (booster.available_at > now() or booster.expires_at <= now()) then
      raise exception 'booster_unavailable';
    end if;

    if booster.opened_at is null then
    -- Three cards: Energy, guaranteed challenge, then challenge/spell/Joker.
    -- Challenge finish split: 69.5 / 20 / 8 / 2 / 0.5 percent.
    -- The one-off test campaign guarantees a spell and excludes legendaries.
    for v_draw_index in 1..3 loop
      v_draw_type := case
        when v_draw_index = 1 then 'energy'
        when booster.bonus_key='spells-legends-test-2026-10-25' and v_draw_index=3 then 'spell'
        when v_draw_index = 3 and random() < 0.10 then 'joker'
        else 'challenge'
      end;

      if v_draw_type = 'joker' then
        select * into template_row from public.tcg_pick_template(v_role, 'joker', 'standard', v_drawn_template_ids);
        if not found then v_draw_type := 'challenge'; end if;
      end if;

      if v_draw_type = 'challenge' then
        v_pool_type := case when v_draw_index=3 then 'challenge_or_spell' else 'challenge' end;
        v_roll := random();
        v_desired_finish := case
          when v_roll < 0.005 and booster.bonus_key is distinct from 'spells-legends-test-2026-10-25' then 'legendary'
          when v_roll < (0.005+0.02) then 'full_art_foil'
          when v_roll < (0.005+0.10) then 'foil'
          when v_roll < (0.005+0.30) then 'full_art'
          else 'standard'
        end;
        select * into template_row from public.tcg_pick_template(v_role, v_pool_type, v_desired_finish, v_drawn_template_ids);
        if not found then
          select * into template_row from public.tcg_pick_template(v_role, v_pool_type, 'standard', v_drawn_template_ids);
        end if;
      elsif v_draw_type = 'spell' then
        select * into template_row from public.tcg_pick_template(v_role, 'spell', 'standard', v_drawn_template_ids);
      elsif v_draw_type = 'energy' then
        select * into template_row from public.tcg_pick_template(v_role, 'energy', 'standard', v_drawn_template_ids);
      end if;

      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;
      insert into public.tcg_cards(template_id, owner_role, finish, wear_seed, acquired_at, expires_at, booster_id)
      values (template_row.id, v_role, v_finish, floor(random() * 1000000)::integer, now(), now() + interval '7 days', booster.id);
      v_drawn_template_ids := array_append(v_drawn_template_ids, template_row.id);
      insert into public.tcg_discoveries(role, template_id)
      values (v_role, template_row.id)
      on conflict (role, template_id) do update
        set last_seen_at = now(), times_seen = public.tcg_discoveries.times_seen + 1;
    end loop;
    update public.tcg_boosters set opened_at = now() where id = booster.id;

    insert into public.tcg_opening_receipts(booster_id,owner_role,cards)
    select booster.id,v_role,jsonb_agg(jsonb_build_object(
      'id',c.id,'template_id',t.id,'category',t.category,'title',t.title,'challenge',t.challenge,
      'symbol',t.symbol,'palette',t.palette,'card_type',t.card_type,'spell_code',t.spell_code,'edition',t.edition,
      'finish',c.finish,'wear_seed',c.wear_seed,'status','available',
      'legendary_options',case when c.finish='legendary' then public.tcg_legendary_options(v_role,t.category) else '[]'::jsonb end,
      'acquired_at',c.acquired_at,'expires_at',c.expires_at,'booster_id',c.booster_id
    ) order by case t.card_type when 'energy' then 0 when 'challenge' then 1 else 2 end,c.id)
    from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id where c.booster_id=booster.id;
    elsif not exists(select 1 from public.tcg_opening_receipts where booster_id=booster.id and owner_role=v_role and completed_at is null) then
      raise exception 'booster_unavailable';
    end if;


  elsif p_action = 'activate_card' then
    begin
      select * into offered
      from public.tcg_cards
      where id = (p_payload->>'card_id')::uuid and owner_role = v_role
      for update;
    exception when invalid_text_representation then
      raise exception 'invalid_card';
    end;
    if not found or offered.status <> 'available' or offered.expires_at <= now() then
      raise exception 'card_unavailable';
    end if;
    select * into template_row from public.tcg_card_templates where id = offered.template_id;
    if template_row.card_type = 'joker' then raise exception 'joker_requires_target'; end if;
    if template_row.card_type = 'spell' then raise exception 'spell_requires_target'; end if;
    if offered.finish='legendary' then
      select * into choice_row from public.tcg_card_templates t where t.id=p_payload->>'choice_template_id'
        and exists(select 1 from jsonb_array_elements(public.tcg_legendary_options(v_role,template_row.category)) o where o->>'id'=t.id);
      if not found then raise exception 'invalid_legendary_choice'; end if;
    end if;
    update public.tcg_cards
    set status = 'activated', activated_at = now(), active_until = now() + interval '24 hours',
      selected_template_id=case when offered.finish='legendary' then choice_row.id end
    where id = offered.id;

  elsif p_action in ('pin_card', 'complete_card') then
    begin
      select * into offered from public.tcg_cards
      where id=(p_payload->>'card_id')::uuid and owner_role=v_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if offered.id is null then raise exception 'card_unavailable'; end if;
    if p_action='pin_card' then
      if offered.status<>'available' or offered.expires_at<=now() then raise exception 'card_unavailable'; end if;
      if jsonb_typeof(p_payload->'is_pinned') is distinct from 'boolean' then raise exception 'invalid_request'; end if;
      update public.tcg_cards set is_pinned=(p_payload->>'is_pinned')::boolean where id=offered.id;
    else
      if offered.status<>'activated' or offered.active_until<=now() then raise exception 'card_unavailable'; end if;
      update public.tcg_cards set status='used',consumed_at=now(),active_until=now(),is_pinned=false where id=offered.id;
      insert into public.tcg_card_events(card_id,actor_role,event_type) values(offered.id,v_role,'complete_card');
    end if;

  elsif p_action in ('give_card', 'destroy_card') then
    begin
      select * into offered from public.tcg_cards
      where id = (p_payload->>'card_id')::uuid and owner_role = v_role
      for update;
    exception when invalid_text_representation then
      raise exception 'card_unavailable';
    end;
    if offered.id is null or offered.status <> 'available' or offered.expires_at <= now() then
      raise exception 'card_unavailable';
    end if;
    if p_action = 'give_card' then
      update public.tcg_cards set owner_role = v_other, is_pinned = false where id = offered.id;
      insert into public.tcg_discoveries(role, template_id)
      values (v_other, offered.template_id)
      on conflict (role, template_id) do update
        set last_seen_at = now(), times_seen = public.tcg_discoveries.times_seen + 1;
    else
      -- Keep the physical record and every discovery; only this copy leaves the hand.
      update public.tcg_cards set status = 'destroyed', consumed_at = now() where id = offered.id;
    end if;
    insert into public.tcg_card_events(card_id, actor_role, recipient_role, event_type)
    values (offered.id, v_role, case when p_action = 'give_card' then v_other end, p_action);

  elsif p_action='use_spell' then
    begin
      select * into offered from public.tcg_cards where id=(p_payload->>'spell_card_id')::uuid and owner_role=v_role for update;
      select * into requested from public.tcg_cards where id=(p_payload->>'target_card_id')::uuid and owner_role=v_other for update;
    exception when invalid_text_representation then raise exception 'spell_unavailable'; end;
    select * into template_row from public.tcg_card_templates where id=offered.template_id;
    if offered.id is null or requested.id is null or template_row.card_type<>'spell'
      or offered.status<>'available' or offered.expires_at<=now() then raise exception 'spell_unavailable'; end if;
    if template_row.spell_code='destructo' then
      if requested.status<>'available' or requested.expires_at<=now()
        or not exists(select 1 from public.tcg_discoveries where role=v_role and template_id=requested.template_id) then raise exception 'spell_unavailable'; end if;
      update public.tcg_cards set status='destroyed',consumed_at=now(),is_pinned=false where id=requested.id;
    else
      if requested.status<>'activated' or requested.active_until<=now() then raise exception 'spell_unavailable'; end if;
      if template_row.spell_code in ('reducto','augmento') then
        if requested.effect_modifier is not null then raise exception 'effect_already_modified'; end if;
        update public.tcg_cards set effect_modifier=template_row.spell_code where id=requested.id;
      elsif template_row.spell_code in ('presto','adagio') then
        if requested.time_modifier is not null then raise exception 'time_already_modified'; end if;
        update public.tcg_cards set time_modifier=template_row.spell_code,
          active_until=now()+(requested.active_until-now())*case when template_row.spell_code='presto' then 0.5 else 2.0 end
        where id=requested.id;
      else raise exception 'spell_unavailable'; end if;
    end if;
    update public.tcg_cards set status='used',consumed_at=now(),is_pinned=false where id=offered.id;
    insert into public.tcg_card_events(card_id,actor_role,recipient_role,event_type,target_card_id)
      values(offered.id,v_role,v_other,'spell_cast',requested.id);

  elsif p_action = 'use_joker' then
    begin
      select * into offered from public.tcg_cards
      where id = (p_payload->>'joker_card_id')::uuid and owner_role = v_role
      for update;
      select * into requested from public.tcg_cards
      where id = (p_payload->>'target_card_id')::uuid and owner_role = v_other
      for update;
    exception when invalid_text_representation then
      raise exception 'invalid_card';
    end;
    select * into template_row from public.tcg_card_templates where id = offered.template_id;
    if offered.id is null or requested.id is null
       or offered.status <> 'available' or offered.expires_at <= now()
       or template_row.card_type <> 'joker'
       or requested.status <> 'activated' or requested.active_until <= now() then
      raise exception 'joker_unavailable';
    end if;
    update public.tcg_cards
    set status = 'used', consumed_at = now()
    where id = offered.id;
    update public.tcg_cards
    set status = 'used', active_until = now(), consumed_at = now()
    where id = requested.id;

  elsif p_action = 'trade_propose' then
    begin
      select * into offered from public.tcg_cards
      where id = (p_payload->>'offered_card_id')::uuid for update;
      select * into requested from public.tcg_cards
      where id = (p_payload->>'requested_card_id')::uuid for update;
    exception when invalid_text_representation then
      raise exception 'invalid_card';
    end;
    if offered.id is null or requested.id is null
       or offered.owner_role <> v_role or requested.owner_role <> v_other
       or offered.status <> 'available' or requested.status <> 'available'
       or offered.expires_at <= now() or requested.expires_at <= now()
       or not exists(select 1 from public.tcg_discoveries where role = v_role and template_id = requested.template_id) then
      raise exception 'trade_unavailable';
    end if;
    insert into public.tcg_trades(proposed_by, offered_card_id, requested_card_id)
    values (v_role, offered.id, requested.id);
    update public.tcg_cards set status = 'trading' where id in (offered.id, requested.id);

  elsif p_action = 'trade_respond' then
    begin
      select * into trade_row from public.tcg_trades
      where id = (p_payload->>'trade_id')::uuid for update;
    exception when invalid_text_representation then
      raise exception 'invalid_trade';
    end;
    if not found or trade_row.status <> 'pending' or trade_row.proposed_by = v_role or trade_row.expires_at <= now() then
      raise exception 'trade_unavailable';
    end if;
    select * into offered from public.tcg_cards where id = trade_row.offered_card_id for update;
    select * into requested from public.tcg_cards where id = trade_row.requested_card_id for update;
    if p_payload->>'decision' = 'accept' then
      if offered.status <> 'trading' or requested.status <> 'trading'
         or offered.expires_at <= now() or requested.expires_at <= now() then
        raise exception 'trade_unavailable';
      end if;
      update public.tcg_cards set owner_role = v_role, status = 'available', is_pinned = false where id = offered.id;
      update public.tcg_cards set owner_role = trade_row.proposed_by, status = 'available', is_pinned = false where id = requested.id;
      insert into public.tcg_discoveries(role, template_id)
      values (v_role, offered.template_id), (trade_row.proposed_by, requested.template_id)
      on conflict (role, template_id) do update
        set last_seen_at = now(), times_seen = public.tcg_discoveries.times_seen + 1;
      update public.tcg_trades set status = 'accepted', responded_at = now() where id = trade_row.id;
    elsif p_payload->>'decision' = 'reject' then
      update public.tcg_cards set status = 'available' where id in (offered.id, requested.id) and status = 'trading';
      update public.tcg_trades set status = 'rejected', responded_at = now() where id = trade_row.id;
    else
      raise exception 'invalid_trade_decision';
    end if;

  elsif p_action = 'trade_cancel' then
    begin
      select * into trade_row from public.tcg_trades
      where id = (p_payload->>'trade_id')::uuid for update;
    exception when invalid_text_representation then
      raise exception 'invalid_trade';
    end;
    if not found or trade_row.status <> 'pending' or trade_row.proposed_by <> v_role then
      raise exception 'trade_unavailable';
    end if;
    update public.tcg_cards set status = 'available'
    where id in (trade_row.offered_card_id, trade_row.requested_card_id) and status = 'trading';
    update public.tcg_trades set status = 'cancelled', responded_at = now() where id = trade_row.id;

  elsif p_action = 'release_device' then
    delete from public.tcg_player_devices
    where role = v_role and device_token_hash = v_token_hash;
    return jsonb_build_object('released', true, 'role', v_role, 'server_now', now());
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'edition', case when now() >= timestamptz '2026-10-29 00:00:00 Europe/Paris' and now() < timestamptz '2026-11-02 00:00:00 Europe/Paris' then 'halloween_2026' else 'edition_01' end,
    'is_test', b.bonus_key='spells-legends-test-2026-10-25',
    'available_at', b.available_at,
    'expires_at', b.expires_at
  ) order by b.expires_at), '[]'::jsonb)
  into v_boosters
  from public.tcg_boosters b
  where b.owner_role = v_role and b.opened_at is null and b.available_at <= now() and b.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'spell_code', t.spell_code, 'edition', t.edition,
    'rarity', t.rarity, 'demo', t.demo, 'finish', c.finish,
    'wear_seed', c.wear_seed, 'status', c.status, 'is_pinned', c.is_pinned,
    'legendary_options',case when c.finish='legendary' then public.tcg_legendary_options(v_role,t.category) else '[]'::jsonb end,
    'acquired_at', c.acquired_at, 'expires_at', c.expires_at, 'booster_id', c.booster_id
  ) order by c.expires_at), '[]'::jsonb)
  into v_my_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  where c.owner_role = v_role and c.status in ('available', 'trading') and c.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'spell_code', t.spell_code, 'edition', t.edition,
    'rarity', t.rarity, 'demo', t.demo, 'finish', c.finish,
    'wear_seed', c.wear_seed, 'status', c.status,
    'acquired_at', c.acquired_at, 'expires_at', c.expires_at
  ) order by c.expires_at), '[]'::jsonb)
  into v_partner_cards
  from public.tcg_cards c
  join public.tcg_card_templates t on t.id = c.template_id
  join public.tcg_discoveries d on d.template_id = c.template_id and d.role = v_role
  where c.owner_role = v_other and c.status in ('available', 'trading') and c.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'owner_role', c.owner_role, 'template_id', t.id,
    'category', t.category, 'title', coalesce(selected.title,t.title), 'challenge', coalesce(selected.challenge,t.challenge),
    'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'spell_code', t.spell_code, 'rarity', t.rarity, 'edition', t.edition,
    'finish', c.finish, 'wear_seed', c.wear_seed, 'selected_template_id',c.selected_template_id,
    'activated_at', c.activated_at, 'active_until', c.active_until, 'effect_modifier', c.effect_modifier, 'time_modifier', c.time_modifier
  ) order by c.active_until), '[]'::jsonb)
  into v_active_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  left join public.tcg_card_templates selected on selected.id=c.selected_template_id
  where c.status = 'activated' and c.active_until > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'spell_code', t.spell_code, 'edition', t.edition,
    'rarity', t.rarity, 'finish_tier', t.finish_tier, 'demo', t.demo,
    'legendary_options',case when t.finish_tier='legendary' then public.tcg_legendary_options(v_role,t.category) else '[]'::jsonb end, 'first_seen_at', d.first_seen_at,
    'last_seen_at', d.last_seen_at, 'times_seen', d.times_seen,
    'owned_count', (select count(*) from public.tcg_cards c where c.owner_role = v_role and c.template_id = t.id and c.status in ('available','trading'))
  ) order by d.first_seen_at desc), '[]'::jsonb)
  into v_known
  from public.tcg_discoveries d join public.tcg_card_templates t on t.id = d.template_id
  where d.role = v_role;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tr.id, 'proposed_by', tr.proposed_by, 'status', tr.status,
    'created_at', tr.created_at, 'expires_at', tr.expires_at,
    'responded_at', tr.responded_at,
    'offered', jsonb_build_object('id', a.id, 'owner_role', a.owner_role, 'title', ta.title, 'category', ta.category, 'palette', ta.palette, 'card_type', ta.card_type, 'finish', a.finish, 'wear_seed', a.wear_seed),
    'requested', jsonb_build_object('id', b.id, 'owner_role', b.owner_role, 'title', tb.title, 'category', tb.category, 'palette', tb.palette, 'card_type', tb.card_type, 'finish', b.finish, 'wear_seed', b.wear_seed)
  ) order by tr.created_at desc), '[]'::jsonb)
  into v_trades
  from (select * from public.tcg_trades
        where proposed_by in (v_role, v_other)
        order by created_at desc limit 40) tr
  join public.tcg_cards a on a.id = tr.offered_card_id
  join public.tcg_card_templates ta on ta.id = a.template_id
  join public.tcg_cards b on b.id = tr.requested_card_id
  join public.tcg_card_templates tb on tb.id = b.template_id
  where tr.proposed_by = v_role or tr.proposed_by = v_other;

  return jsonb_build_object(
    'role', v_role,
    'partner_role', v_other,
    'display_name', case when v_role = 'AG' then 'Mamamouth' else 'Papapouf' end,
    'partner_name', case when v_other = 'AG' then 'Mamamouth' else 'Papapouf' end,
    'next_booster_at', ((v_release_date + 1) + time '05:00') at time zone 'Europe/Paris',
    'server_now', now(),
    'partner_online', exists(select 1 from public.tcg_players where role = v_other and last_seen > now() - interval '45 seconds'),
    'pending_openings', (
      select coalesce(jsonb_agg(jsonb_build_object('booster_id',r.booster_id,'cards',r.cards,
        'index',r.reveal_index,'progress_at',r.progress_at,'opened_at',r.opened_at) order by r.opened_at),'[]'::jsonb)
      from public.tcg_opening_receipts r where r.owner_role=v_role and r.completed_at is null
    ),
    'boosters', v_boosters,
    'my_cards', v_my_cards,
    'partner_cards', v_partner_cards,
    'active_cards', v_active_cards,
    'known_cards', v_known,
    'catalogue_total', (select count(*) from public.tcg_card_templates where not demo),
    'catalogue_slots', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'number', s.slot_number, 'edition', s.edition,
        'template_id', case when exists(select 1 from public.tcg_discoveries d where d.role = v_role and d.template_id = s.id) then s.id else null end
      ) order by s.edition, s.slot_number), '[]'::jsonb)
      from (select id, edition, row_number() over(partition by edition order by created_at, id) as slot_number
            from public.tcg_card_templates where not demo) s
    ),
    'editions', (
      select jsonb_agg(jsonb_build_object(
        'id', e.edition, 'total', e.total, 'discovered', e.discovered,
        'draw_from', e.draw_from, 'draw_until', e.draw_until
      ) order by e.edition)
      from (select t.edition, count(*) as total,
        count(d.template_id) as discovered, min(t.draw_from) as draw_from, max(t.draw_until) as draw_until
        from public.tcg_card_templates t
        left join public.tcg_discoveries d on d.template_id = t.id and d.role = v_role
        where not t.demo group by t.edition) e
    ),
    'card_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,'card_id',e.card_id,'event_type',e.event_type,'actor_role',e.actor_role,
        'recipient_role',e.recipient_role,'created_at',e.created_at,'title',t.title,'finish',c.finish,
        'edition',t.edition,'target_title',target.title,'spell_code',t.spell_code
      ) order by e.created_at desc,e.id desc),'[]'::jsonb)
      from (select * from public.tcg_card_events where actor_role=v_role or recipient_role=v_role
            order by created_at desc,id desc limit 40) e
      join public.tcg_cards c on c.id=e.card_id
      join public.tcg_card_templates t on t.id=c.template_id
      left join public.tcg_cards target_card on target_card.id=e.target_card_id
      left join public.tcg_card_templates target on target.id=target_card.template_id
    ),
    'trades', v_trades,
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 3, 'active_hours', 24, 'collection_days', 7, 'daily_release_hour', 5, 'joker_slot_chance', 0.10, 'legendary_chance',0.005)
  );
end;
$$;

revoke all on function public.tcg_exchange(text,text,text,text,jsonb) from public;
grant execute on function public.tcg_exchange(text,text,text,text,jsonb) to anon, authenticated;


do $$ begin if current_setting('tcg.legends_before') is distinct from (select md5(jsonb_build_array(
(select jsonb_agg(to_jsonb(c)-'selected_template_id' order by id) from public.tcg_cards c),
(select jsonb_agg(to_jsonb(b) order by id) from public.tcg_boosters b),
(select jsonb_agg(to_jsonb(d) order by role,template_id) from public.tcg_discoveries d),
(select jsonb_agg(to_jsonb(t) order by id) from public.tcg_trades t),
(select jsonb_agg(to_jsonb(e) order by id) from public.tcg_card_events e),
(select jsonb_agg(to_jsonb(r) order by booster_id) from public.tcg_opening_receipts r),
(select jsonb_agg(to_jsonb(t) order by id) from public.tcg_card_templates t where id not like 'legend-%' and id not in ('fafoil-foodies-journee','fafoil-todo-travaux'))
)::text)) then raise exception 'Existing game data changed'; end if; end; $$;
notify pgrst, 'reload schema';
