alter table public.tcg_card_templates add column if not exists edition text not null default 'edition_01';
alter table public.tcg_card_templates add column if not exists draw_from timestamptz;
alter table public.tcg_card_templates add column if not exists draw_until timestamptz;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_draw_window_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_draw_window_check
  check ((draw_from is null and draw_until is null) or (draw_from is not null and draw_until is not null and draw_until > draw_from));
-- Preserve legacy 30-day cards; only future acquisitions use seven days.
alter table public.tcg_cards drop constraint if exists tcg_cards_check;
alter table public.tcg_cards drop constraint if exists tcg_cards_retention_check;
alter table public.tcg_cards add constraint tcg_cards_retention_check
  check (expires_at = acquired_at + interval '7 days' or expires_at = acquired_at + interval '30 days');

-- Halloween is a separate ten-card edition. The original eighty rows stay intact.
insert into public.tcg_card_templates(
  id, category, title, challenge, symbol, palette, card_type,
  eligible_role, finish_tier, rarity, active, demo, edition, draw_from, draw_until
)
values
  ('hw-couple-film-horreur', 'EN COUPLE', 'FILM D’HORREUR', 'Regardez un film d’horreur ensemble.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-couple-urbex', 'EN COUPLE', 'URBEX', 'Faites une sortie urbex ensemble, dans un lieu accessible et autorisé.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-autre-cadeau-666', 'POUR L''AUTRE', 'CADEAU · 6,66 €', 'Un cadeau à 6,66 euros.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-nue-photo-horreur', 'MISE À NUE', 'SÉANCE PHOTO NUDES D’HORREUR (COSTUME)', 'Séance photo nudes d’horreur, en costume.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-foodies-gateau', 'LES FOODIES', 'L’AUTRE FAIT UN GÂTEAU D’HALLOWEEN', 'L’autre fait un gâteau d’Halloween.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-fa-foodies-repas', 'LES FOODIES', 'REPAS EFFRAYANT PROPOSÉ PAR L’AUTRE', 'Un repas effrayant proposé par l’autre.', '♨', 'foodies', 'challenge', null, 'full_art', 'rare', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-foil-autre-cadeau-66', 'POUR L''AUTRE', 'CADEAU · 66 €', 'Un cadeau à 66 euros.', '◇', 'other', 'challenge', null, 'foil', 'rare', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-foil-nue-faciale-eglise', 'MISE À NUE', 'FACIALE À L’ÉGLISE', 'Faciale à l’église.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-energy-morsure', 'ÉNERGIE', 'UNE MORSURE', 'Cette carte donne droit à une morsure.', '♥', 'energy', 'energy', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris'),
  ('hw-energy-griffure', 'ÉNERGIE', 'UNE GRIFFURE', 'Cette carte donne droit à une griffure.', '♥', 'energy', 'energy', null, 'standard', 'commune', true, false, 'halloween_2026', '2026-10-29 00:00:00 Europe/Paris', '2026-11-02 00:00:00 Europe/Paris')
on conflict (id) do update set
  title = excluded.title, challenge = excluded.challenge, category = excluded.category,
  symbol = excluded.symbol, palette = excluded.palette, card_type = excluded.card_type,
  eligible_role = excluded.eligible_role, finish_tier = excluded.finish_tier,
  rarity = excluded.rarity, active = excluded.active, demo = false,
  edition = excluded.edition, draw_from = excluded.draw_from, draw_until = excluded.draw_until;

-- Internal picker: a single source of truth for temporal eligibility, profile
-- restrictions and the 0.8 individual weight of Mise à nue cards.
create or replace function public.tcg_pick_template(
  p_role text, p_card_type text, p_finish text, p_excluded_ids text[], p_at timestamptz default now()
) returns setof public.tcg_card_templates
language sql volatile
set search_path = public, pg_temp
as $$
  select t.* from public.tcg_card_templates t
  where t.active and not t.demo and t.card_type = p_card_type
    and (p_card_type <> 'challenge' or t.finish_tier = p_finish)
    and (t.eligible_role is null or t.eligible_role = p_role)
    and (t.draw_from is null or (p_at >= t.draw_from and p_at < t.draw_until))
    and not (t.id = any(coalesce(p_excluded_ids, array[]::text[])))
  order by -ln(greatest(random(), 0.000000000001)) /
    case when t.category = 'MISE À NUE' then 0.8 else 1.0 end
  limit 1;
$$;
revoke all on function public.tcg_pick_template(text,text,text,text[],timestamptz) from public, anon, authenticated;

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
     or coalesce(p_action, '') not in ('login', 'sync', 'open_booster', 'activate_card', 'use_joker', 'trade_propose', 'trade_respond', 'trade_cancel', 'release_device')
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
    if not found or booster.opened_at is not null or booster.available_at > now() or booster.expires_at <= now() then
      raise exception 'booster_unavailable';
    end if;

    -- Three cards per booster: one Energy, one challenge, then a challenge
    -- or a rare Joker (10%). The 70/20/8/2 finish split is applied only
    -- to authored challenge pools. Missing special pools fall back to common.
    for v_draw_index in 1..3 loop
      v_draw_type := case
        when v_draw_index = 1 then 'energy'
        when v_draw_index = 3 and random() < 0.10 then 'joker'
        else 'challenge'
      end;

      if v_draw_type = 'joker' then
        select * into template_row from public.tcg_pick_template(v_role, 'joker', 'standard', v_drawn_template_ids);
        if not found then v_draw_type := 'challenge'; end if;
      end if;

      if v_draw_type = 'challenge' then
        v_roll := random();
        v_desired_finish := case
          when v_roll < 0.02 then 'full_art_foil'
          when v_roll < 0.10 then 'foil'
          when v_roll < 0.30 then 'full_art'
          else 'standard'
        end;
        select * into template_row from public.tcg_pick_template(v_role, 'challenge', v_desired_finish, v_drawn_template_ids);
        if not found then
          select * into template_row from public.tcg_pick_template(v_role, 'challenge', 'standard', v_drawn_template_ids);
        end if;
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
    update public.tcg_cards
    set status = 'activated', activated_at = now(), active_until = now() + interval '24 hours'
    where id = offered.id;

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
      update public.tcg_cards set owner_role = v_role, status = 'available' where id = offered.id;
      update public.tcg_cards set owner_role = trade_row.proposed_by, status = 'available' where id = requested.id;
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
    'available_at', b.available_at,
    'expires_at', b.expires_at
  ) order by b.expires_at), '[]'::jsonb)
  into v_boosters
  from public.tcg_boosters b
  where b.owner_role = v_role and b.opened_at is null and b.available_at <= now() and b.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'edition', t.edition,
    'rarity', t.rarity, 'demo', t.demo, 'finish', c.finish,
    'wear_seed', c.wear_seed, 'status', c.status,
    'acquired_at', c.acquired_at, 'expires_at', c.expires_at, 'booster_id', c.booster_id
  ) order by c.expires_at), '[]'::jsonb)
  into v_my_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  where c.owner_role = v_role and c.status in ('available', 'trading') and c.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'edition', t.edition,
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
    'category', t.category, 'title', t.title, 'challenge', t.challenge,
    'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'rarity', t.rarity, 'edition', t.edition,
    'finish', c.finish, 'wear_seed', c.wear_seed,
    'activated_at', c.activated_at, 'active_until', c.active_until
  ) order by c.active_until), '[]'::jsonb)
  into v_active_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  where c.status = 'activated' and c.active_until > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'edition', t.edition,
    'rarity', t.rarity, 'finish_tier', t.finish_tier, 'demo', t.demo, 'first_seen_at', d.first_seen_at,
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
    'trades', v_trades,
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 3, 'active_hours', 24, 'collection_days', 7, 'daily_release_hour', 5, 'joker_slot_chance', 0.10)
  );
end;
$$;

revoke all on function public.tcg_exchange(text,text,text,text,jsonb) from public;
grant execute on function public.tcg_exchange(text,text,text,text,jsonb) to anon, authenticated;


notify pgrst, 'reload schema';

