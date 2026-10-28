-- One atomic, retry-safe participation per profile. Random draws permit repeats.
create schema if not exists private;
alter table public.tcg_cards add column if not exists event_id text;
alter table public.tcg_cards drop constraint tcg_cards_retention_check;
alter table public.tcg_cards add constraint tcg_cards_retention_check check (
 (event_id is null and (expires_at=acquired_at+interval '7 days' or expires_at=acquired_at+interval '30 days'))
 or (event_id='reroll-en-ville-2026-10-28' and expires_at=timestamptz '2026-11-02 00:00:00 Europe/Paris' and acquired_at<expires_at)
);
create table public.tcg_reroll_en_ville_uses (
 event_id text not null check(event_id='reroll-en-ville-2026-10-28'),
 owner_role text not null references public.tcg_players(role),
 input_card_ids uuid[] not null,
 output_card_ids uuid[] not null,
 used_at timestamptz not null default now(),
 expires_at timestamptz not null,
 primary key(event_id,owner_role),
 check(cardinality(input_card_ids) between 1 and 10),
 check(cardinality(input_card_ids)=cardinality(output_card_ids))
);
alter table public.tcg_reroll_en_ville_uses enable row level security;
revoke all on public.tcg_reroll_en_ville_uses from public,anon,authenticated;
create or replace function private.tcg_reroll_en_ville_action(p_role text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $event$
declare
 v_event constant text := 'reroll-en-ville-2026-10-28';
 v_deadline constant timestamptz := timestamptz '2026-11-02 00:00:00 Europe/Paris';
 v_start constant timestamptz := timestamptz '2026-10-28 00:00:00 Europe/Paris';
 v_mode text := coalesce(p_payload->>'mode','status');
 v_use public.tcg_reroll_en_ville_uses%rowtype;
 v_card public.tcg_cards%rowtype;
 v_source public.tcg_card_templates%rowtype;
 v_target public.tcg_card_templates%rowtype;
 v_ids uuid[]; v_outputs uuid[] := array[]::uuid[]; v_id uuid; v_output uuid;
 v_n integer;
begin
 if p_role is null or p_role not in ('AG','CL') or v_mode not in ('status','claim') then raise exception 'invalid_request'; end if;
 -- Same lock order as tcg_exchange, also safe when called internally.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('tcg:main'));
 select * into v_use from public.tcg_reroll_en_ville_uses where event_id=v_event and owner_role=p_role;
 if v_mode='claim' then
  if jsonb_typeof(p_payload->'card_ids') is distinct from 'array' then raise exception 'invalid_request'; end if;
  begin
   select array_agg(value::uuid order by ord) into v_ids from jsonb_array_elements_text(p_payload->'card_ids') with ordinality x(value,ord);
  exception when invalid_text_representation then raise exception 'invalid_request'; end;
  v_n:=coalesce(cardinality(v_ids),0);
  if v_n<1 or v_n>10 or v_n<>(select count(distinct id) from unnest(v_ids) id) then raise exception 'invalid_request'; end if;
  if v_use.owner_role is not null then
   if not(v_use.input_card_ids @> v_ids and v_ids @> v_use.input_card_ids) then raise exception 'reroll_en_ville_used'; end if;
  else
   if now()<v_start or now()>=v_deadline then raise exception 'reroll_en_ville_closed'; end if;
   foreach v_id in array v_ids loop
    select * into v_card from public.tcg_cards where id=v_id and owner_role=p_role for update;
    if not found or v_card.status<>'available' or v_card.expires_at<=now() then raise exception 'card_unavailable'; end if;
    select * into v_source from public.tcg_card_templates where id=v_card.template_id;
    if v_source.card_type<>'challenge' then raise exception 'invalid_request'; end if;
    select * into v_target from public.tcg_card_templates t
      where t.active and not t.demo and t.category=v_source.category
      and t.card_type=v_source.card_type and t.finish_tier=v_card.finish
      and (t.eligible_role is null or t.eligible_role=p_role)
      and (t.draw_from is null or now()>=t.draw_from)
      and (t.draw_until is null or now()<t.draw_until)
      order by random() limit 1;
    if not found then raise exception 'reroll_en_ville_no_match'; end if;
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=v_id;
    insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,acquired_at,expires_at,event_id)
    values(v_target.id,p_role,v_card.finish,floor(random()*1000000)::integer,now(),v_deadline,v_event) returning id into v_output;
    v_outputs:=array_append(v_outputs,v_output);
    insert into public.tcg_discoveries(role,template_id) values(p_role,v_target.id)
     on conflict(role,template_id) do update set last_seen_at=now(),times_seen=public.tcg_discoveries.times_seen+1;
   end loop;
   insert into public.tcg_reroll_en_ville_uses(event_id,owner_role,input_card_ids,output_card_ids,expires_at)
   values(v_event,p_role,v_ids,v_outputs,v_deadline) returning * into v_use;
  end if;
 end if;
 return jsonb_build_object('event_id',v_event,'active',now()>=v_start and now()<v_deadline,
  'used',v_use.owner_role is not null,'max_cards',10,'deadline',v_deadline,'server_now',now(),
  'input_card_ids',coalesce(to_jsonb(v_use.input_card_ids),'[]'::jsonb),
  'output_card_ids',coalesce(to_jsonb(v_use.output_card_ids),'[]'::jsonb),'used_at',v_use.used_at);
end;
$event$;
revoke all on function private.tcg_reroll_en_ville_action(text,jsonb) from public,anon,authenticated;
-- An activated event card cannot extend beyond the advertised Sunday deadline.
create or replace function private.tcg_cap_event_card_deadline()
returns trigger language plpgsql security invoker set search_path='' as $cap$
begin
 if new.event_id='reroll-en-ville-2026-10-28' and new.active_until is not null then
  new.active_until:=least(new.active_until,new.expires_at);
 end if;
 return new;
end;
$cap$;
revoke all on function private.tcg_cap_event_card_deadline() from public,anon,authenticated;
create trigger tcg_cap_event_card_deadline before insert or update on public.tcg_cards for each row execute function private.tcg_cap_event_card_deadline();
CREATE OR REPLACE FUNCTION public.tcg_exchange(p_role text, p_token text, p_access_code text DEFAULT NULL::text, p_action text DEFAULT 'sync'::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
  v_history_limit integer := case when coalesce(p_payload->>'history_limit','') ~ '^[0-9]{1,3}$' then greatest(20,least(500,(p_payload->>'history_limit')::integer)) else 40 end;
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
  v_rewards jsonb := '[]'::jsonb;
  v_reward_amount integer;
  v_card_id uuid;
  v_wear_seed integer;
  v_boosters jsonb;
  v_my_cards jsonb;
  v_partner_cards jsonb;
  v_active_cards jsonb;
  v_known jsonb;
  v_trades jsonb;
begin
  if v_role not in ('AG', 'CL')
     or coalesce(p_token, '') !~ '^[a-f0-9]{48}$'
     or coalesce(p_action, '') not in ('login', 'sync', 'open_booster', 'activate_card', 'use_joker', 'trade_propose', 'trade_respond', 'trade_cancel', 'release_device', 'give_card', 'destroy_card', 'pin_card', 'complete_card', 'ritual_pass', 'ritual_review', 'sell_card', 'sell_cards', 'buy_booster', 'bank_exchange', 'use_helper', 'opening_progress', 'finish_opening', 'use_spell', 'deck_start', 'deck_flip', 'deck_resolve', 'deck_continue', 'deck_dismiss', 'reroll_en_ville')
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

  if p_action in ('deck_start','deck_flip','deck_resolve','deck_continue','deck_dismiss') then
    perform public.tcg_deck_action(v_role,p_action,p_payload);
  end if;

  if p_action = 'reroll_en_ville' then
    perform private.tcg_reroll_en_ville_action(v_role,p_payload);
  end if;

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
      if coalesce(p_payload->>'index','') !~ '^[0-4]$' or (p_payload->>'index')::integer >= jsonb_array_length(receipt.cards) then raise exception 'invalid_request'; end if;
      update public.tcg_opening_receipts set reveal_index=(p_payload->>'index')::integer, progress_at=now()
      where booster_id=receipt.booster_id and completed_at is null;
    end if;
    return jsonb_build_object('opening_saved',true,'server_now',now());
  end if;

  -- New rituals only: old activated cards retain their original neutral expiry.
  perform public.tcg_economy_tick();
  -- Timed transitions are server-authoritative.
  update public.tcg_cards
  set status = 'used', consumed_at = coalesce(consumed_at, active_until)
  where status = 'activated' and active_until <= now() and not exists(select 1 from public.tcg_joint_sessions j where j.card_id=tcg_cards.id and j.status='active') and not exists(select 1 from public.tcg_ritual_claims r where r.card_id=tcg_cards.id and r.status='pending' and r.claimed_at+interval '24 hours'>now());

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
  select p.role, d.release_date, d.available_at, d.expires_at
  from public.tcg_players p cross join public.tcg_daily_release_window(now()) d
  on conflict (owner_role, release_date) do nothing;

  -- One birthday gift, additive to daily releases; its original 48h clock never moves.
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select w.owner_role,null,w.bonus_key,w.available_at,w.expires_at
  from public.tcg_birthday_booster_window(now()) w
  on conflict(owner_role,bonus_key) where bonus_key is not null do nothing;

  if p_action in ('complete_card','ritual_pass','ritual_review','sell_card','sell_cards','buy_booster','bank_exchange') then
    perform public.tcg_economy_action(v_role,p_action,p_payload);
  end if;
  if p_action='use_helper' then
    perform public.tcg_helper_action(v_role,coalesce(p_payload->>'kind',''),p_payload);
  end if;

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
    -- Five rewards: Energy, two challenges, then two flexible slots.
    -- Each flexible slot has a 60% chance of yielding 1–3 shards instead.
    -- Existing three-card opening receipts stay valid and resumable.
    for v_draw_index in 1..5 loop
      if v_draw_index>=4 and not (v_draw_index=4 and booster.booster_kind<>'classic') and random()<0.60 then
        v_roll:=random();
        v_reward_amount:=1;
        perform public.tcg_economy_apply(v_role,v_reward_amount,'booster_shards',null,jsonb_build_object('booster_id',booster.id,'slot',v_draw_index));
        v_rewards:=v_rewards||jsonb_build_array(jsonb_build_object('reward_type','shards','amount',v_reward_amount,'slot',v_draw_index));
        continue;
      end if;
      v_draw_type := case
        when v_draw_index = 1 then 'energy'
        when booster.bonus_key='spells-legends-test-2026-10-25' and v_draw_index=3 then 'spell'
        when v_draw_index=4 and booster.booster_kind='magician' then 'spell'
        when v_draw_index=4 and booster.booster_kind in ('pleasure','relax') then 'challenge'
        when v_draw_index >= 4 and random() < 0.10 then 'joker'
        else 'challenge'
      end;

      if v_draw_type = 'joker' then
        select * into template_row from public.tcg_pick_template(v_role, 'joker', 'standard', v_drawn_template_ids);
        if not found then v_draw_type := 'challenge'; end if;
      end if;

      if v_draw_type = 'challenge' then
        v_pool_type := case when v_draw_index>=4 then 'challenge_or_spell' else 'challenge' end;
        v_roll := random();
        v_desired_finish := public.tcg_challenge_finish(v_role,now(),v_roll,
          booster.bonus_key is distinct from 'spells-legends-test-2026-10-25');
        if v_draw_index=4 and booster.booster_kind in ('pleasure','relax') then
          select * into template_row from public.tcg_pick_themed_template(v_role,booster.booster_kind,v_desired_finish,v_drawn_template_ids);
          if not found then
            select * into template_row from public.tcg_pick_themed_template(v_role,booster.booster_kind,'standard',v_drawn_template_ids);
          end if;
        else
          select * into template_row from public.tcg_pick_template(v_role, v_pool_type, v_desired_finish, v_drawn_template_ids);
          if not found then
            select * into template_row from public.tcg_pick_template(v_role, v_pool_type, 'standard', v_drawn_template_ids);
          end if;
        end if;
      elsif v_draw_type = 'spell' then
        if v_draw_index=4 and booster.booster_kind='magician' then
          v_desired_finish:=public.tcg_challenge_finish(v_role,now(),random());
          select * into template_row from public.tcg_pick_themed_template(v_role,'magician',v_desired_finish,v_drawn_template_ids);
          if not found then
            select * into template_row from public.tcg_pick_themed_template(v_role,'magician','standard',v_drawn_template_ids);
          end if;
        else
          select * into template_row from public.tcg_pick_template(v_role, 'spell', 'standard', v_drawn_template_ids);
        end if;
      elsif v_draw_type = 'energy' then
        select * into template_row from public.tcg_pick_template(v_role, 'energy', 'standard', v_drawn_template_ids);
      end if;

      if booster.bonus_key='halloween-launch-2026-10-27' and v_draw_index in (1,2) then
        select * into template_row from public.tcg_card_templates t
        where t.active and not t.demo and t.edition='halloween_2026'
          and (t.eligible_role is null or t.eligible_role=v_role)
          and t.card_type=case when v_draw_index=1 then 'energy' else 'challenge' end
          and t.finish_tier=case when v_draw_index=1 then 'standard'
            when v_role='CL' then 'standard' when v_desired_finish in ('full_art','foil') then v_desired_finish else 'standard' end
          and (v_role<>'CL' or v_draw_index<>2 or t.id='hw-nue-photo-horreur')
          and not (t.id=any(v_drawn_template_ids))
        order by -ln(greatest(random(),0.000001))/case when t.palette='nude' then 0.8 else 1 end limit 1;
      end if;
      if not found then raise exception 'no_active_card'; end if;
      if booster.release_date=date '2026-10-28' or booster.bonus_key='halloween-morning-2026-10-28' then
        template_row:=public.tcg_halloween_morning_pick(v_role,template_row,v_drawn_template_ids,case when v_draw_index=4 then booster.booster_kind else 'classic' end);
      end if;
      v_finish := template_row.finish_tier;
      v_wear_seed:=floor(random()*1000000)::integer;
      insert into public.tcg_cards(template_id, owner_role, finish, wear_seed, acquired_at, expires_at, booster_id)
      values (template_row.id, v_role, v_finish, v_wear_seed, now(), now() + interval '7 days', booster.id)
      returning id into v_card_id;
      v_rewards:=v_rewards||jsonb_build_array(jsonb_build_object(
        'id',v_card_id,'template_id',template_row.id,'category',template_row.category,'title',template_row.title,
        'challenge',template_row.challenge,'symbol',template_row.symbol,'palette',template_row.palette,
        'card_type',template_row.card_type,'spell_code',template_row.spell_code,'edition',template_row.edition,
        'finish',v_finish,'wear_seed',v_wear_seed,'status','available',
        'legendary_options',case when v_finish='legendary' then public.tcg_legendary_options(v_role,template_row.category) else '[]'::jsonb end,
        'acquired_at',now(),'expires_at',now()+interval '7 days','booster_id',booster.id));
      v_drawn_template_ids := array_append(v_drawn_template_ids, template_row.id);
      insert into public.tcg_discoveries(role, template_id)
      values (v_role, template_row.id)
      on conflict (role, template_id) do update
        set last_seen_at = now(), times_seen = public.tcg_discoveries.times_seen + 1;
    end loop;
    update public.tcg_boosters set opened_at = now() where id = booster.id;

    insert into public.tcg_opening_receipts(booster_id,owner_role,cards) values(booster.id,v_role,v_rewards);
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
    if offered.template_id='fa-couple-defi-simultane' then
      select * into choice_row from public.tcg_card_templates t where t.id=p_payload->>'choice_template_id'
        and exists(select 1 from jsonb_array_elements(public.tcg_joint_options()) x where x->>'id'=t.id);
      if not found then raise exception 'invalid_joint_choice'; end if;
    end if;
    if offered.finish='legendary' then
      select * into choice_row from public.tcg_card_templates t where t.id=p_payload->>'choice_template_id'
        and exists(select 1 from jsonb_array_elements(public.tcg_legendary_options(v_role,template_row.category)) o where o->>'id'=t.id);
      if not found then raise exception 'invalid_legendary_choice'; end if;
    end if;
    update public.tcg_cards
    set status = 'activated', activated_at = now(), active_until = now() + interval '24 hours', economy_eligible=true,
      selected_template_id=case when offered.finish='legendary' or offered.template_id='fa-couple-defi-simultane' then choice_row.id end
    where id = offered.id;
    if offered.template_id='fa-couple-defi-simultane' then perform public.tcg_joint_start(offered.id,choice_row.id); end if;

  elsif p_action = 'pin_card' then
    begin
      select * into offered from public.tcg_cards
      where id=(p_payload->>'card_id')::uuid and owner_role=v_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if offered.id is null then raise exception 'card_unavailable'; end if;
    if offered.status<>'available' or offered.expires_at<=now() then raise exception 'card_unavailable'; end if;
    if jsonb_typeof(p_payload->'is_pinned') is distinct from 'boolean' then raise exception 'invalid_request'; end if;
    update public.tcg_cards set is_pinned=(p_payload->>'is_pinned')::boolean where id=offered.id;

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
    'edition', case when now() >= timestamptz '2026-10-27 00:00:00 Europe/Paris' and now() < timestamptz '2026-11-02 00:00:00 Europe/Paris' then 'halloween_2026' else 'edition_01' end,
    'is_test', b.bonus_key='spells-legends-test-2026-10-25',
    'is_halloween_morning',(b.bonus_key='halloween-morning-2026-10-28' or b.release_date=date '2026-10-28'),
    'is_birthday',b.bonus_key='birthday-mamamouth-2026-11-08',
    'is_economy',b.bonus_key like 'economy-%',
    'booster_kind',b.booster_kind,
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
    'sale_price',public.tcg_sale_price(c.finish,c.expires_at),
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
    'activated_at', c.activated_at, 'active_until', c.active_until, 'effect_modifier', c.effect_modifier, 'time_modifier', c.time_modifier,
    'ritual_claim_status',(select r.status from public.tcg_ritual_claims r where r.card_id=c.id),
    'joint_ritual',public.tcg_joint_snapshot(c.id,v_role),
    'economy_eligible',c.economy_eligible
  ) order by c.active_until), '[]'::jsonb)
  into v_active_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  left join public.tcg_card_templates selected on selected.id=c.selected_template_id
  where c.status = 'activated' and (c.active_until > now() or exists(select 1 from public.tcg_joint_sessions j where j.card_id=c.id and j.status='active') or exists(select 1 from public.tcg_ritual_claims r where r.card_id=c.id and r.status='pending' and r.claimed_at+interval '24 hours'>now()));

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
        order by created_at desc limit v_history_limit) tr
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
    'reroll_en_ville', private.tcg_reroll_en_ville_action(v_role,'{"mode":"status"}'::jsonb),
    'depressive_deck', public.tcg_deck_snapshot(v_role),
    'economy',public.tcg_economy_snapshot(v_role),
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
        'recipient_role',e.recipient_role,'created_at',e.created_at,'title',coalesce(chosen.title,t.title),'finish',c.finish,
        'edition',t.edition,'target_title',coalesce(target_choice.title,target.title),'spell_code',t.spell_code
      ) order by e.created_at desc,e.id desc),'[]'::jsonb)
      from (select * from public.tcg_card_events where actor_role=v_role or recipient_role=v_role
            order by created_at desc,id desc limit v_history_limit) e
      join public.tcg_cards c on c.id=e.card_id
      join public.tcg_card_templates t on t.id=c.template_id
      left join public.tcg_cards target_card on target_card.id=e.target_card_id
      left join public.tcg_card_templates target on target.id=target_card.template_id
      left join public.tcg_card_templates chosen on chosen.id=c.selected_template_id
      left join public.tcg_card_templates target_choice on target_choice.id=target_card.selected_template_id
    ),
    'trades', v_trades,
    'joint_options',case when exists(select 1 from public.tcg_cards where owner_role=v_role and template_id='fa-couple-defi-simultane' and status='available' and expires_at>now()) then public.tcg_joint_options() else '[]'::jsonb end,
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 5, 'guaranteed_cards',3,'shard_slot_chance',0.60,'active_hours', 24, 'collection_days', 7, 'daily_release_hour', 5, 'joker_slot_chance', 0.10, 'legendary_chance',0.005*public.tcg_birthday_multiplier(v_role,now()),'birthday_role','AG','birthday_multiplier',public.tcg_birthday_multiplier(v_role,now()))
  );
end;
$function$

