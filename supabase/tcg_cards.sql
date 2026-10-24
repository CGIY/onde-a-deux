-- LES CARTES — persistent two-player collection and daily booster state.
-- Direct table access is blocked. The static client only uses tcg_exchange,
-- which validates the selected profile and its device token on every call.
begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tcg_players (
  role text primary key check (role in ('AG', 'CL')),
  access_code_hash text not null check (access_code_hash ~ '^[a-f0-9]{64}$'),
  device_token_hash text,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tcg_card_templates (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  category text not null,
  title text not null check (length(title) between 2 and 80),
  challenge text not null check (length(challenge) between 2 and 500),
  symbol text not null default '✦' check (length(symbol) between 1 and 12),
  palette text not null,
  card_type text not null default 'challenge',
  eligible_role text,
  finish_tier text not null default 'standard',
  rarity text not null default 'commune' check (rarity in ('commune', 'rare', 'légendaire')),
  active boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tcg_card_templates add column if not exists card_type text not null default 'challenge';
alter table public.tcg_card_templates add column if not exists eligible_role text;
alter table public.tcg_card_templates add column if not exists finish_tier text not null default 'standard';
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_category_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_palette_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_card_type_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_eligible_role_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_finish_tier_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_category_check
  check (category in ('EN COUPLE', 'POUR L''AUTRE', 'MISE À NUE', 'LES FOODIES', 'TO DO', 'ÉNERGIE', 'JOKER'));
alter table public.tcg_card_templates add constraint tcg_card_templates_palette_check
  check (palette in ('couple', 'other', 'nude', 'foodies', 'todo', 'energy', 'joker'));
alter table public.tcg_card_templates add constraint tcg_card_templates_card_type_check
  check (card_type in ('challenge', 'energy', 'joker'));
alter table public.tcg_card_templates add constraint tcg_card_templates_eligible_role_check
  check (eligible_role is null or eligible_role in ('AG', 'CL'));
alter table public.tcg_card_templates add constraint tcg_card_templates_finish_tier_check
  check (finish_tier in ('standard', 'foil', 'full_art', 'full_art_foil'));

create table if not exists public.tcg_boosters (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null references public.tcg_players(role),
  release_date date not null,
  available_at timestamptz not null,
  expires_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_role, release_date),
  check (expires_at = available_at + interval '48 hours')
);

create table if not exists public.tcg_cards (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.tcg_card_templates(id),
  owner_role text not null references public.tcg_players(role),
  status text not null default 'available' check (status in ('available', 'trading', 'activated', 'used', 'expired')),
  finish text not null default 'standard' check (finish in ('standard', 'foil', 'full_art', 'full_art_foil')),
  wear_seed integer not null check (wear_seed between 0 and 999999),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  activated_at timestamptz,
  active_until timestamptz,
  consumed_at timestamptz,
  booster_id uuid references public.tcg_boosters(id),
  check (expires_at = acquired_at + interval '30 days'),
  check ((status <> 'activated') or (activated_at is not null and active_until is not null))
);

create table if not exists public.tcg_discoveries (
  role text not null references public.tcg_players(role),
  template_id text not null references public.tcg_card_templates(id),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  times_seen integer not null default 1 check (times_seen > 0),
  primary key (role, template_id)
);

create table if not exists public.tcg_trades (
  id uuid primary key default gen_random_uuid(),
  proposed_by text not null references public.tcg_players(role),
  offered_card_id uuid not null references public.tcg_cards(id),
  requested_card_id uuid not null references public.tcg_cards(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  responded_at timestamptz,
  check (offered_card_id <> requested_card_id)
);

create index if not exists tcg_cards_owner_status_idx on public.tcg_cards(owner_role, status, expires_at);
create index if not exists tcg_cards_active_idx on public.tcg_cards(status, active_until);
create index if not exists tcg_cards_template_idx on public.tcg_cards(template_id);
create index if not exists tcg_cards_booster_idx on public.tcg_cards(booster_id);
create index if not exists tcg_discoveries_template_idx on public.tcg_discoveries(template_id);
create index if not exists tcg_trades_status_expiry_idx on public.tcg_trades(status, expires_at);
create index if not exists tcg_trades_proposed_by_idx on public.tcg_trades(proposed_by);
create index if not exists tcg_trades_offered_card_idx on public.tcg_trades(offered_card_id);
create index if not exists tcg_trades_requested_card_idx on public.tcg_trades(requested_card_id);
create index if not exists tcg_boosters_owner_expiry_idx on public.tcg_boosters(owner_role, expires_at);

alter table public.tcg_players enable row level security;
alter table public.tcg_card_templates enable row level security;
alter table public.tcg_boosters enable row level security;
alter table public.tcg_cards enable row level security;
alter table public.tcg_discoveries enable row level security;
alter table public.tcg_trades enable row level security;

revoke all on public.tcg_players from anon, authenticated;
revoke all on public.tcg_card_templates from anon, authenticated;
revoke all on public.tcg_boosters from anon, authenticated;
revoke all on public.tcg_cards from anon, authenticated;
revoke all on public.tcg_discoveries from anon, authenticated;
revoke all on public.tcg_trades from anon, authenticated;

insert into public.tcg_players(role, access_code_hash)
values ('AG', repeat('0', 64)), ('CL', repeat('0', 64))
on conflict (role) do nothing;

-- The first five visual placeholders remain in history but can no longer be drawn.
update public.tcg_card_templates set active = false where demo;

-- First authored common set. Special foil and full-art templates will be added later.
insert into public.tcg_card_templates(
  id, category, title, challenge, symbol, palette, card_type,
  eligible_role, finish_tier, rarity, active, demo
)
values
  ('couple-jeu-societe', 'EN COUPLE', 'JEU DE SOCIÉTÉ', 'Choisissez un jeu de société et jouez une partie ensemble.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-film', 'EN COUPLE', 'FILM', 'Choisissez un film et regardez-le ensemble.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-serie', 'EN COUPLE', 'SÉRIE', 'Regardez ensemble un épisode de la série de votre choix.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-aquarelle', 'EN COUPLE', 'AQUARELLE', 'Installez-vous et peignez quelque chose ensemble à l’aquarelle.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-dessin', 'EN COUPLE', 'DESSIN', 'Prenez de quoi dessiner et créez quelque chose côte à côte.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-balade-rapide', 'EN COUPLE', 'BALADE RAPIDE', 'Sortez prendre l’air ensemble pour une balade rapide.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-tour-ville', 'EN COUPLE', 'PETIT TOUR EN VILLE', 'Partez faire un petit tour en ville ensemble.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),
  ('couple-gateau', 'EN COUPLE', 'FAIRE UN GÂTEAU', 'Choisissez une recette et préparez un gâteau à deux.', '◎', 'couple', 'challenge', null, 'standard', 'commune', true, false),

  ('autre-massage-epaules', 'POUR L''AUTRE', 'MASSAGE DES ÉPAULES', 'L’autre offre un massage des épaules.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-massage-tete', 'POUR L''AUTRE', 'MASSAGE DE LA TÊTE', 'L’autre offre un massage de la tête.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-massage-cuisses', 'POUR L''AUTRE', 'MASSAGE DES CUISSES', 'L’autre offre un massage des cuisses.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-mot-doux', 'POUR L''AUTRE', 'CACHER UN MOT DOUX', 'L’autre cache un mot doux à découvrir plus tard.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-massage-visage', 'POUR L''AUTRE', 'MASSAGE DU VISAGE', 'L’autre offre un massage doux du visage.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-cadeau-vinted', 'POUR L''AUTRE', 'CADEAU VINTED · 5 €', 'L’autre choisit un petit cadeau sur Vinted, avec un budget de 5 €.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-cadeau-ville', 'POUR L''AUTRE', 'CADEAU EN VILLE · 10 €', 'L’autre choisit un cadeau en ville, avec un budget de 10 €.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),
  ('autre-massage-dos', 'POUR L''AUTRE', 'MASSAGE DU DOS', 'L’autre offre un massage du dos.', '◇', 'other', 'challenge', null, 'standard', 'commune', true, false),

  ('nue-leche-partenaire', 'MISE À NUE', 'L’AUTRE LÈCHE SA PARTENAIRE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'AG', 'standard', 'commune', true, false),
  ('nue-suce-partenaire', 'MISE À NUE', 'L’AUTRE SUCE SON PARTENAIRE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'CL', 'standard', 'commune', true, false),
  ('nue-assise-visage', 'MISE À NUE', 'L’AUTRE S’ASSOIT SUR LE VISAGE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'AG', 'standard', 'commune', true, false),
  ('nue-faciale', 'MISE À NUE', 'L’AUTRE FAIT UNE FACIALE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'CL', 'standard', 'commune', true, false),
  ('nue-grosse-levrette', 'MISE À NUE', 'UNE GROSSE LEVRETTE', 'Choisissez ensemble le rythme et l’intensité, sans pression.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-star-wars', 'MISE À NUE', 'SÉANCE PHOTO STAR WARS', 'Créez une séance photo inspirée de Star Wars. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-berlin', 'MISE À NUE', 'SÉANCE PHOTO BERLIN', 'Créez une séance photo inspirée de Berlin. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-apres-sport', 'MISE À NUE', 'SÉANCE PHOTO APRÈS-SPORT', 'Créez une séance photo après-sport. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-douche-vapeur', 'MISE À NUE', 'SÉANCE PHOTO DOUCHE VAPEUR', 'Créez une séance photo dans la vapeur. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-cuisine', 'MISE À NUE', 'SÉANCE PHOTO CUISINE', 'Créez une séance photo dans la cuisine. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-linge', 'MISE À NUE', 'SÉANCE PHOTO MACHINE / LINGE', 'Créez une séance photo autour du linge. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-neon', 'MISE À NUE', 'SÉANCE PHOTO NÉON', 'Créez une séance photo sous une lumière néon. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-pluie', 'MISE À NUE', 'SÉANCE PHOTO SOUS LA PLUIE', 'Créez une séance photo sous la pluie, dans un lieu sûr et privé.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-massage-nuru', 'MISE À NUE', 'MASSAGE NURU', 'L’autre réalise un massage Nuru avec un produit compatible et un accord explicite.', '◒', 'nude', 'challenge', 'AG', 'standard', 'commune', true, false),
  ('nue-avaler', 'MISE À NUE', 'L’AUTRE ACCEPTE D’AVALER', 'Uniquement avec un accord explicite, sans pression et avec possibilité de changer d’avis.', '◒', 'nude', 'challenge', 'CL', 'standard', 'commune', true, false),

  ('foodies-fast-food', 'LES FOODIES', 'L’AUTRE PAIE LE FAST-FOOD', 'L’autre invite au fast-food de votre choix.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-apero', 'LES FOODIES', 'L’AUTRE PRÉPARE UN APÉRO', 'L’autre prépare un apéro à partager.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-gateau', 'LES FOODIES', 'L’AUTRE FAIT UN GÂTEAU', 'L’autre prépare un gâteau pour vous deux.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-cafe-ville', 'LES FOODIES', 'L’AUTRE PAIE LE CAFÉ', 'L’autre invite pour un café en ville.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),

  ('todo-vaisselle', 'TO DO', 'PROCHAIN LAVE-VAISSELLE', 'L’autre s’occupe du prochain lave-vaisselle.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-machine', 'TO DO', 'PROCHAINE MACHINE', 'L’autre s’occupe de la prochaine machine.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-linge', 'TO DO', 'PROCHAIN LINGE', 'L’autre étend ou plie le prochain linge.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-poubelles', 'TO DO', 'LES POUBELLES', 'L’autre s’occupe des poubelles.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-piece', 'TO DO', 'RANGER UNE PIÈCE', 'L’autre range une pièce de votre choix.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-placard', 'TO DO', 'RANGER UN PLACARD', 'L’autre range un placard de votre choix.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),

  ('energy-bisou', 'ÉNERGIE', 'ÉNERGIE BISOUS', 'Cette carte donne droit à un bisou.', '♥', 'energy', 'energy', null, 'standard', 'commune', true, false),
  ('joker-annulation', 'JOKER', 'JOKER', 'Annule une carte active consommée par l’autre joueur.', 'J', 'joker', 'joker', null, 'standard', 'légendaire', true, false)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  challenge = excluded.challenge,
  symbol = excluded.symbol,
  palette = excluded.palette,
  card_type = excluded.card_type,
  eligible_role = excluded.eligible_role,
  finish_tier = excluded.finish_tier,
  rarity = excluded.rarity,
  active = excluded.active,
  demo = false;

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
     or p_token !~ '^[a-f0-9]{48}$'
     or p_action not in ('login', 'sync', 'open_booster', 'activate_card', 'use_joker', 'trade_propose', 'trade_respond', 'trade_cancel', 'release_device')
     or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or length(coalesce(p_payload, '{}'::jsonb)::text) > 12000 then
    raise exception 'invalid_request';
  end if;

  v_other := case when v_role = 'AG' then 'CL' else 'AG' end;
  v_token_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtext('tcg:main'));

  select * into player from public.tcg_players where role = v_role for update;
  if not found then raise exception 'unknown_profile'; end if;

  if player.device_token_hash is null then
    if p_action <> 'login' or coalesce(p_access_code, '') !~ '^[A-Z0-9]{10,16}$' then
      raise exception 'pairing_required';
    end if;
    v_access_hash := encode(extensions.digest(convert_to(upper(p_access_code), 'UTF8'), 'sha256'), 'hex');
    if v_access_hash <> player.access_code_hash then raise exception 'invalid_access_code'; end if;
    update public.tcg_players
    set device_token_hash = v_token_hash, last_seen = now()
    where role = v_role;
  elsif player.device_token_hash <> v_token_hash then
    raise exception 'device_not_authorized';
  else
    update public.tcg_players set last_seen = now() where role = v_role;
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
        select * into template_row
        from public.tcg_card_templates
        where active and card_type = 'joker'
          and (eligible_role is null or eligible_role = v_role)
          and not (id = any(v_drawn_template_ids))
        order by random()
        limit 1;
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
        select * into template_row
        from public.tcg_card_templates
        where active and card_type = 'challenge'
          and finish_tier = v_desired_finish
          and (eligible_role is null or eligible_role = v_role)
          and not (id = any(v_drawn_template_ids))
        order by random()
        limit 1;
        if not found then
          select * into template_row
          from public.tcg_card_templates
          where active and card_type = 'challenge'
            and finish_tier = 'standard'
            and (eligible_role is null or eligible_role = v_role)
            and not (id = any(v_drawn_template_ids))
          order by random()
          limit 1;
        end if;
      elsif v_draw_type = 'energy' then
        select * into template_row
        from public.tcg_card_templates
        where active and card_type = 'energy'
          and (eligible_role is null or eligible_role = v_role)
          and not (id = any(v_drawn_template_ids))
        order by random()
        limit 1;
      end if;

      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;
      insert into public.tcg_cards(template_id, owner_role, finish, wear_seed, acquired_at, expires_at, booster_id)
      values (template_row.id, v_role, v_finish, floor(random() * 1000000)::integer, now(), now() + interval '30 days', booster.id);
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
       or offered.expires_at <= now() or requested.expires_at <= now() then
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
    update public.tcg_players set device_token_hash = null, last_seen = null where role = v_role;
    return jsonb_build_object('released', true, 'role', v_role, 'server_now', now());
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'available_at', b.available_at,
    'expires_at', b.expires_at
  ) order by b.expires_at), '[]'::jsonb)
  into v_boosters
  from public.tcg_boosters b
  where b.owner_role = v_role and b.opened_at is null and b.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type,
    'rarity', t.rarity, 'demo', t.demo, 'finish', c.finish,
    'wear_seed', c.wear_seed, 'status', c.status,
    'acquired_at', c.acquired_at, 'expires_at', c.expires_at
  ) order by c.expires_at), '[]'::jsonb)
  into v_my_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  where c.owner_role = v_role and c.status in ('available', 'trading') and c.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type,
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
    'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type, 'rarity', t.rarity,
    'finish', c.finish, 'wear_seed', c.wear_seed,
    'activated_at', c.activated_at, 'active_until', c.active_until
  ) order by c.active_until), '[]'::jsonb)
  into v_active_cards
  from public.tcg_cards c join public.tcg_card_templates t on t.id = c.template_id
  where c.status = 'activated' and c.active_until > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'template_id', t.id, 'category', t.category, 'title', t.title,
    'challenge', t.challenge, 'symbol', t.symbol, 'palette', t.palette, 'card_type', t.card_type,
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
  from public.tcg_trades tr
  join public.tcg_cards a on a.id = tr.offered_card_id
  join public.tcg_card_templates ta on ta.id = a.template_id
  join public.tcg_cards b on b.id = tr.requested_card_id
  join public.tcg_card_templates tb on tb.id = b.template_id
  where tr.proposed_by = v_role or tr.proposed_by = v_other
  limit 40;

  return jsonb_build_object(
    'role', v_role,
    'partner_role', v_other,
    'server_now', now(),
    'partner_online', exists(select 1 from public.tcg_players where role = v_other and last_seen > now() - interval '45 seconds'),
    'boosters', v_boosters,
    'my_cards', v_my_cards,
    'partner_cards', v_partner_cards,
    'active_cards', v_active_cards,
    'known_cards', v_known,
    'trades', v_trades,
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 3, 'active_hours', 24, 'collection_days', 30, 'daily_release_hour', 5, 'joker_slot_chance', 0.10)
  );
end;
$$;

revoke all on function public.tcg_exchange(text,text,text,text,jsonb) from public;
grant execute on function public.tcg_exchange(text,text,text,text,jsonb) to anon, authenticated;

comment on table public.tcg_players is 'LES CARTES fixed AG/CL profiles. Direct access blocked.';
comment on table public.tcg_card_templates is 'Card catalogue. Unknown templates are never returned before discovery.';
comment on function public.tcg_exchange(text,text,text,text,jsonb) is 'Token-validated API for LES CARTES; all direct table access is revoked.';

notify pgrst, 'reload schema';
commit;
