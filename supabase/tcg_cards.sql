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

create table if not exists public.tcg_player_devices (
  role text not null references public.tcg_players(role) on delete cascade,
  device_token_hash text not null check (device_token_hash ~ '^[a-f0-9]{64}$'),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (role, device_token_hash)
);

alter table public.tcg_card_templates add column if not exists card_type text not null default 'challenge';
alter table public.tcg_card_templates add column if not exists eligible_role text;
alter table public.tcg_card_templates add column if not exists finish_tier text not null default 'standard';
alter table public.tcg_card_templates add column if not exists edition text not null default 'edition_01';
alter table public.tcg_card_templates add column if not exists draw_from timestamptz;
alter table public.tcg_card_templates add column if not exists draw_until timestamptz;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_draw_window_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_draw_window_check
  check ((draw_from is null and draw_until is null) or (draw_from is not null and draw_until is not null and draw_until > draw_from));
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_category_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_palette_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_card_type_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_eligible_role_check;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_finish_tier_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_category_check
  check (category in ('EN COUPLE', 'POUR L''AUTRE', 'MISE À NUE', 'LES FOODIES', 'TO DO', 'ÉNERGIE', 'JOKER', 'SORTILÈGES'));
alter table public.tcg_card_templates add constraint tcg_card_templates_palette_check
  check (palette in ('couple', 'other', 'nude', 'foodies', 'todo', 'energy', 'joker', 'reducto', 'presto', 'adagio', 'augmento', 'destructo'));
alter table public.tcg_card_templates add constraint tcg_card_templates_card_type_check
  check (card_type in ('challenge', 'energy', 'joker', 'spell'));
alter table public.tcg_card_templates add constraint tcg_card_templates_eligible_role_check
  check (eligible_role is null or eligible_role in ('AG', 'CL'));
alter table public.tcg_card_templates add constraint tcg_card_templates_finish_tier_check
  check (finish_tier in ('standard', 'foil', 'full_art', 'full_art_foil', 'legendary'));

create table if not exists public.tcg_boosters (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null references public.tcg_players(role),
  release_date date,
  bonus_key text,
  booster_kind text not null default 'classic',
  available_at timestamptz not null,
  expires_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_role, release_date),
  check (expires_at = available_at + interval '48 hours')
);

-- Daily release uniqueness remains untouched; gifts have no daily release date.
alter table public.tcg_boosters add column if not exists bonus_key text;
alter table public.tcg_boosters add column if not exists booster_kind text not null default 'classic';
alter table public.tcg_boosters drop constraint if exists tcg_boosters_kind_check;
alter table public.tcg_boosters add constraint tcg_boosters_kind_check
  check (booster_kind in ('classic','magician','pleasure','relax'));
alter table public.tcg_boosters alter column release_date drop not null;
alter table public.tcg_boosters drop constraint if exists tcg_boosters_source_check;
alter table public.tcg_boosters add constraint tcg_boosters_source_check
  check ((release_date is not null and bonus_key is null) or (release_date is null and bonus_key is not null));
create unique index if not exists tcg_boosters_bonus_once_idx
  on public.tcg_boosters(owner_role,bonus_key) where bonus_key is not null;
comment on column public.tcg_boosters.bonus_key is 'One-off additive gift key. NULL for daily boosters; never changes the daily release clock.';

create table if not exists public.tcg_cards (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.tcg_card_templates(id),
  owner_role text not null references public.tcg_players(role),
  status text not null default 'available' check (status in ('available', 'trading', 'activated', 'used', 'expired')),
  finish text not null default 'standard' check (finish in ('standard', 'foil', 'full_art', 'full_art_foil', 'legendary')),
  wear_seed integer not null check (wear_seed between 0 and 999999),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  activated_at timestamptz,
  active_until timestamptz,
  consumed_at timestamptz,
  booster_id uuid references public.tcg_boosters(id),
  constraint tcg_cards_retention_check check (expires_at = acquired_at + interval '7 days' or expires_at = acquired_at + interval '30 days'),
  constraint tcg_cards_activation_check check ((status <> 'activated') or (activated_at is not null and active_until is not null))
);

-- Preserve legacy 30-day cards; only future acquisitions use seven days.
alter table public.tcg_cards drop constraint if exists tcg_cards_check;
alter table public.tcg_cards drop constraint if exists tcg_cards_retention_check;
alter table public.tcg_cards add constraint tcg_cards_retention_check
  check (expires_at = acquired_at + interval '7 days' or expires_at = acquired_at + interval '30 days');

-- Additive management: no saved card, discovery, booster or trade is deleted.
alter table public.tcg_cards drop constraint if exists tcg_cards_status_check;
alter table public.tcg_cards add constraint tcg_cards_status_check
  check (status in ('available', 'trading', 'activated', 'used', 'expired', 'destroyed'));

create table if not exists public.tcg_card_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.tcg_cards(id),
  actor_role text not null references public.tcg_players(role),
  recipient_role text references public.tcg_players(role),
  event_type text not null check (event_type in ('give_card', 'destroy_card', 'complete_card')),
  created_at timestamptz not null default now(),
  check ((event_type = 'give_card' and recipient_role is not null and recipient_role <> actor_role)
      or (event_type in ('destroy_card','complete_card') and recipient_role is null))
);
create index if not exists tcg_card_events_card_idx on public.tcg_card_events(card_id);
create index if not exists tcg_card_events_actor_idx on public.tcg_card_events(actor_role);
create index if not exists tcg_card_events_recipient_idx on public.tcg_card_events(recipient_role);
alter table public.tcg_card_events enable row level security;
revoke all on public.tcg_card_events from public, anon, authenticated;
comment on table public.tcg_card_events is 'Append-only gift/destruction audit written only by the token-validated card API. Direct access blocked.';

alter table public.tcg_cards add column if not exists is_pinned boolean not null default false;
alter table public.tcg_card_events drop constraint if exists tcg_card_events_event_type_check;
alter table public.tcg_card_events add constraint tcg_card_events_event_type_check
  check (event_type in ('give_card','destroy_card','complete_card'));
alter table public.tcg_card_events drop constraint if exists tcg_card_events_check;
alter table public.tcg_card_events add constraint tcg_card_events_check
  check ((event_type='give_card' and recipient_role is not null and recipient_role<>actor_role)
      or (event_type in ('destroy_card','complete_card') and recipient_role is null));

create table if not exists public.tcg_opening_receipts (
  booster_id uuid primary key references public.tcg_boosters(id),
  owner_role text not null references public.tcg_players(role),
  cards jsonb not null check (jsonb_typeof(cards)='array' and jsonb_array_length(cards)=3),
  reveal_index integer not null default 0 check (reveal_index between 0 and 2),
  progress_at timestamptz not null default now(),
  opened_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.tcg_opening_receipts drop constraint if exists tcg_opening_receipts_cards_check;
alter table public.tcg_opening_receipts add constraint tcg_opening_receipts_cards_check
  check (jsonb_typeof(cards)='array' and jsonb_array_length(cards) in (3,5));
alter table public.tcg_opening_receipts drop constraint if exists tcg_opening_receipts_reveal_index_check;
alter table public.tcg_opening_receipts add constraint tcg_opening_receipts_reveal_index_check
  check (reveal_index >= 0 and reveal_index < jsonb_array_length(cards));
create index if not exists tcg_opening_receipts_owner_idx on public.tcg_opening_receipts(owner_role,opened_at);
alter table public.tcg_opening_receipts enable row level security;
revoke all on public.tcg_opening_receipts from public, anon, authenticated;
comment on table public.tcg_opening_receipts is 'Immutable drawn-card snapshots for interrupted discoveries. Token-validated RPC only.';

alter table public.tcg_card_templates add column if not exists spell_code text;
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_spell_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_spell_check
  check ((card_type='spell' and spell_code is not null and spell_code in ('reducto','presto','adagio','augmento','destructo')) or (card_type<>'spell' and spell_code is null));
alter table public.tcg_cards add column if not exists effect_modifier text check (effect_modifier in ('reducto','augmento'));
alter table public.tcg_cards add column if not exists time_modifier text check (time_modifier in ('presto','adagio'));
alter table public.tcg_card_events add column if not exists target_card_id uuid references public.tcg_cards(id);
create index if not exists tcg_card_events_target_idx on public.tcg_card_events(target_card_id);
alter table public.tcg_card_events drop constraint if exists tcg_card_events_event_type_check;
alter table public.tcg_card_events add constraint tcg_card_events_event_type_check
  check (event_type in ('give_card','destroy_card','complete_card','spell_cast'));
alter table public.tcg_card_events drop constraint if exists tcg_card_events_check;
alter table public.tcg_card_events add constraint tcg_card_events_check
  check ((event_type in ('give_card','spell_cast') and recipient_role is not null and recipient_role<>actor_role)
      or (event_type in ('destroy_card','complete_card') and recipient_role is null));
alter table public.tcg_card_events drop constraint if exists tcg_card_events_target_check;
alter table public.tcg_card_events add constraint tcg_card_events_target_check
  check ((event_type='spell_cast' and target_card_id is not null) or (event_type<>'spell_cast' and target_card_id is null));

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
create index if not exists tcg_player_devices_last_seen_idx on public.tcg_player_devices(role, last_seen desc);

alter table public.tcg_players enable row level security;
alter table public.tcg_player_devices enable row level security;
alter table public.tcg_card_templates enable row level security;
alter table public.tcg_boosters enable row level security;
alter table public.tcg_cards enable row level security;
alter table public.tcg_discoveries enable row level security;
alter table public.tcg_trades enable row level security;

revoke all on public.tcg_players from anon, authenticated;
revoke all on public.tcg_player_devices from anon, authenticated;
revoke all on public.tcg_card_templates from anon, authenticated;
revoke all on public.tcg_boosters from anon, authenticated;
revoke all on public.tcg_cards from anon, authenticated;
revoke all on public.tcg_discoveries from anon, authenticated;
revoke all on public.tcg_trades from anon, authenticated;

insert into public.tcg_players(role, access_code_hash)
values ('AG', repeat('0', 64)), ('CL', repeat('0', 64))
on conflict (role) do nothing;

-- Preserve any device paired by the first single-device version.
insert into public.tcg_player_devices(role, device_token_hash, last_seen)
select role, device_token_hash, coalesce(last_seen, now())
from public.tcg_players
where device_token_hash is not null
on conflict (role, device_token_hash) do update set last_seen = excluded.last_seen;

-- The first five visual placeholders remain in history but can no longer be drawn.
update public.tcg_card_templates set active = false where demo;

-- Authored catalogue. Finish tiers carry their own cards rather than applying a
-- cosmetic finish to a common card after it has been drawn.
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
  ('nue-assise-visage', 'MISE À NUE', 'L’AUTRE S’ASSOIT SUR LE VISAGE DE SON PARTENAIRE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'AG', 'standard', 'commune', true, false),
  ('nue-faciale', 'MISE À NUE', 'L’AUTRE FAIT UNE FACIALE À SA PARTENAIRE', 'À vivre seulement avec un accord explicite, enthousiaste et maintenu.', '◒', 'nude', 'challenge', 'CL', 'standard', 'commune', true, false),
  ('nue-grosse-levrette', 'MISE À NUE', 'UNE GROSSE LEVRETTE', 'Choisissez ensemble le rythme et l’intensité, sans pression.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-star-wars', 'MISE À NUE', 'SÉANCE PHOTO STAR WARS', 'Créez une séance photo inspirée de Star Wars. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-berlin', 'MISE À NUE', 'SÉANCE PHOTO BERLIN', 'Créez une séance photo inspirée de Berlin. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-apres-sport', 'MISE À NUE', 'SÉANCE PHOTO APRÈS-SPORT', 'Créez une séance photo après-sport. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-douche-vapeur', 'MISE À NUE', 'SÉANCE PHOTO DOUCHE VAPEUR', 'Créez une séance photo dans la vapeur. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-cuisine', 'MISE À NUE', 'SÉANCE PHOTO CUISINE', 'Créez une séance photo dans la cuisine. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-linge', 'MISE À NUE', 'SÉANCE PHOTO MACHINE À LAVER / LINGE', 'Créez une séance photo autour du linge. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-neon', 'MISE À NUE', 'SÉANCE PHOTO NÉON', 'Créez une séance photo sous une lumière néon. Décidez ensemble des images conservées.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-photo-pluie', 'MISE À NUE', 'SÉANCE PHOTO SOUS LA PLUIE', 'Créez une séance photo sous la pluie, dans un lieu sûr et privé.', '◒', 'nude', 'challenge', null, 'standard', 'commune', true, false),
  ('nue-massage-nuru', 'MISE À NUE', 'L’AUTRE DOIT FAIRE UN MASSAGE NURU', 'L’autre réalise un massage Nuru avec un produit compatible et un accord explicite.', '◒', 'nude', 'challenge', 'AG', 'standard', 'commune', true, false),
  ('nue-avaler', 'MISE À NUE', 'L’AUTRE ACCEPTE D’AVALER', 'Uniquement avec un accord explicite, sans pression et avec possibilité de changer d’avis.', '◒', 'nude', 'challenge', 'CL', 'standard', 'commune', true, false),

  ('foodies-fast-food', 'LES FOODIES', 'L’AUTRE PAIE LE FAST-FOOD', 'L’autre invite au fast-food de votre choix.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-apero', 'LES FOODIES', 'L’AUTRE PRÉPARE UN APÉRO', 'L’autre prépare un apéro à partager.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-gateau', 'LES FOODIES', 'L’AUTRE FAIT UN GÂTEAU', 'L’autre prépare un gâteau pour vous deux.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),
  ('foodies-cafe-ville', 'LES FOODIES', 'L’AUTRE PAIE SON CAFÉ EN VILLE', 'L’autre invite pour un café en ville.', '♨', 'foodies', 'challenge', null, 'standard', 'commune', true, false),

  ('todo-vaisselle', 'TO DO', 'L’AUTRE FAIT LE PROCHAIN LAVE-VAISSELLE', 'L’autre s’occupe du prochain lave-vaisselle.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-machine', 'TO DO', 'L’AUTRE FAIT LA PROCHAINE MACHINE', 'L’autre s’occupe de la prochaine machine.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-linge', 'TO DO', 'L’AUTRE ÉTEND / PLIE LE PROCHAIN LINGE', 'L’autre étend ou plie le prochain linge.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-poubelles', 'TO DO', 'L’AUTRE S’OCCUPE DES POUBELLES', 'L’autre s’occupe des poubelles.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-piece', 'TO DO', 'L’AUTRE RANGE UNE PIÈCE', 'L’autre range une pièce de votre choix.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),
  ('todo-placard', 'TO DO', 'L’AUTRE RANGE UN PLACARD', 'L’autre range un placard de votre choix.', '✓', 'todo', 'challenge', null, 'standard', 'commune', true, false),

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

insert into public.tcg_card_templates(
  id, category, title, challenge, symbol, palette, card_type,
  eligible_role, finish_tier, rarity, active, demo
)
values
  -- Full art · 20%
  ('fa-couple-repas-complet', 'EN COUPLE', 'PRÉPARER UN REPAS COMPLET', 'Préparez ensemble un repas complet, de l’entrée au dessert.', '◎', 'couple', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-couple-choix-activite', 'EN COUPLE', 'LAISSER L’AUTRE CHOISIR L’ACTIVITÉ', 'Laissez l’autre choisir entièrement votre prochaine activité à deux.', '◎', 'couple', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-autre-cadeau-20', 'POUR L''AUTRE', 'CADEAU · 20 €', 'Choisis pour l’autre un cadeau avec un budget de 20 €.', '◇', 'other', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-autre-cadeau-25', 'POUR L''AUTRE', 'CADEAU · 25 €', 'Choisis pour l’autre un cadeau avec un budget de 25 €.', '◇', 'other', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-nue-webcam-boobs', 'MISE À NUE', 'WEBCAM NUDE · BOOBS', 'À réaliser seulement entre adultes consentants, sur un canal privé choisi ensemble, sans capture non convenue.', '◒', 'nude', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-nue-anal', 'MISE À NUE', 'L’AUTRE ACCEPTE · ANAL', 'Seulement avec un oui explicite et maintenu : lubrifiant, progression lente et arrêt immédiat à la demande.', '◒', 'nude', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-nue-reproduction-porno', 'MISE À NUE', 'REPRODUCTION FILM PORNO · 1:1', 'Choisissez ensemble une scène compatible avec vos limites et reproduisez uniquement ce qui reste confortable et consenti.', '◒', 'nude', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-nue-fessees-filmees', 'MISE À NUE', '30 MINUTES DE FESSÉES FILMÉES', 'CL peut proposer cette séance avec intensité négociée, mot d’arrêt et vidéo conservée seulement avec l’accord des deux.', '◒', 'nude', 'challenge', 'CL', 'full_art', 'rare', true, false),
  ('fa-nue-reddit-boobs', 'MISE À NUE', 'REDDIT · BOOBS', 'Publication uniquement avec accord explicite des deux, anonymisation vérifiée et droit de retrait décidé ensemble.', '◒', 'nude', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-foodies-repas-choix-paye', 'LES FOODIES', 'L’AUTRE PAIE LE REPAS DE TON CHOIX', 'Choisis le repas : l’autre vous invite.', '♨', 'foodies', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-foodies-repas-choix-prepare', 'LES FOODIES', 'L’AUTRE PRÉPARE LE REPAS DE TON CHOIX', 'Choisis le menu : l’autre prépare le repas.', '♨', 'foodies', 'challenge', null, 'full_art', 'rare', true, false),
  ('fa-todo-impose-tache', 'TO DO', 'IMPOSE TA TÂCHE MÉNAGÈRE À L’AUTRE', 'Impose ta tâche ménagère à l’autre.', '✓', 'todo', 'challenge', null, 'full_art', 'rare', true, false),

  -- Foil · 8%
  ('foil-couple-marathon', 'EN COUPLE', 'MARATHON DE FILMS / SÉRIE', 'Choisissez votre marathon et installez-vous pour plusieurs épisodes ou films.', '◎', 'couple', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-couple-sortie-choisie', 'EN COUPLE', 'LA SORTIE CHOISIE PAR L’AUTRE', 'L’autre choisit et organise votre prochaine sortie.', '◎', 'couple', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-couple-soiree-theme', 'EN COUPLE', 'SOIRÉE À THÈME DÉCIDÉE PAR L’AUTRE', 'L’autre décide du thème et prépare votre soirée à deux.', '◎', 'couple', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-autre-massage-complet', 'POUR L''AUTRE', 'GROS MASSAGE COMPLET', 'Offre à l’autre un massage complet, avec durée et pression choisies ensemble.', '◇', 'other', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-autre-cadeau-50', 'POUR L''AUTRE', 'CADEAU · 50 €', 'Choisis pour l’autre un cadeau avec un budget de 50 €.', '◇', 'other', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-soumission', 'MISE À NUE', 'UNE HEURE DE SOUMISSION', 'Définissez avant de commencer les rôles, limites, mot d’arrêt et vérifications régulières pendant cette heure.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-porno-hardcore', 'MISE À NUE', 'REPRODUCTION FILM PORNO HARDCORE', 'Choisissez une scène compatible avec vos limites réelles : aucune pratique n’est obligatoire et l’arrêt reste possible à tout moment.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-blowjob-eglise', 'MISE À NUE', 'BLOWJOB À L’ÉGLISE', 'Uniquement dans un cadre privé et légal, sans visibilité ni implication de tiers non consentants ; sinon, mettez la scène en décor privé.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-site-echangiste', 'MISE À NUE', 'SITE ÉCHANGISTE', 'Explorez ensemble un site échangiste, sans engagement, en définissant vos limites et en protégeant vos informations.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-petit-sextoy', 'MISE À NUE', 'ACHAT D’UN PETIT SEXTOY', 'Choisissez ensemble un petit sextoy adapté à vos envies et à vos limites.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-webcam-pussy', 'MISE À NUE', 'WEBCAM NUDE · PUSSY', 'À réaliser seulement entre adultes consentants, sur un canal privé choisi ensemble, sans capture non convenue.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-nue-reddit-pussy', 'MISE À NUE', 'REDDIT · PUSSY', 'Publication uniquement avec accord explicite des deux, anonymisation vérifiée et droit de retrait décidé ensemble.', '◒', 'nude', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-foodies-restaurant', 'LES FOODIES', 'L’AUTRE PAIE SON RESTAURANT', 'Choisis ton restaurant : l’autre vous invite.', '♨', 'foodies', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-foodies-plat-luxe', 'LES FOODIES', 'L’AUTRE TE PROPOSE UN PLAT DE LUXE', 'L’autre te propose et prépare ou commande un plat de luxe.', '♨', 'foodies', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-foodies-dessert-luxe', 'LES FOODIES', 'L’AUTRE TE PROPOSE UN DESSERT DE LUXE', 'L’autre te propose et prépare ou commande un dessert de luxe.', '♨', 'foodies', 'challenge', null, 'foil', 'rare', true, false),
  ('foil-todo-refaire-piece', 'TO DO', 'L’AUTRE DOIT REFAIRE UN ÉLÉMENT D’UNE PIÈCE', 'L’autre doit refaire un élément d’une pièce.', '✓', 'todo', 'challenge', null, 'foil', 'rare', true, false),

  -- Full art + foil · 2%
  ('faf-couple-super-sortie', 'EN COUPLE', 'L’AUTRE PRÉPARE UNE SUPER SORTIE À DEUX', 'L’autre imagine et prépare une sortie complète rien que pour vous deux.', '◎', 'couple', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-couple-weekend', 'EN COUPLE', 'PRÉPARATION D’UN WEEK-END AILLEURS', 'Préparez ensemble un week-end ailleurs : destination, date et programme.', '◎', 'couple', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-autre-cadeau-100', 'POUR L''AUTRE', 'CADEAU · 100 €', 'Choisis pour l’autre un cadeau exceptionnel avec un budget de 100 €.', '◇', 'other', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-golden-shower', 'MISE À NUE', 'GOLDEN SHOWER SUR L’AUTRE', 'Seulement avec un accord explicite et maintenu ; évitez le visage et toute zone irritée, puis rincez-vous.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-roleplay-violent', 'MISE À NUE', 'ROLEPLAY VIOLENT SUR L’AUTRE', 'Jeu de rôle uniquement : scénario, gestes permis et interdits, mot d’arrêt et signal non verbal doivent être définis avant.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-achat-scandale', 'MISE À NUE', 'ACHAT SUR SCANDALE', 'Choisissez ensemble un achat sur Scandale qui respecte vos envies et vos limites.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-gros-sextoy', 'MISE À NUE', 'ACHAT D’UN GROS SEXTOY', 'Choisissez ensemble un modèle adapté, avec lubrifiant compatible et progression sans douleur.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-webcam-faciale', 'MISE À NUE', 'WEBCAM NUDE · FACIALE', 'À réaliser seulement entre adultes consentants, sur un canal privé choisi ensemble, sans capture non convenue.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false),
  ('faf-nue-reddit-faciale', 'MISE À NUE', 'REDDIT · FACIALE', 'Publication uniquement avec accord explicite des deux, anonymisation vérifiée et droit de retrait décidé ensemble.', '◒', 'nude', 'challenge', null, 'full_art_foil', 'légendaire', true, false)
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

insert into public.tcg_card_templates(id,category,title,challenge,symbol,palette,card_type,spell_code,finish_tier,rarity,active,demo,edition) values
('spell-reducto','SORTILÈGES','REDUCTO','Divise par deux l’effet d’un rituel adverse. Un seul changement d’effet par carte.','◐','reducto','spell','reducto','standard','commune',true,false,'edition_01'),
('spell-presto','SORTILÈGES','PRESTO','Divise par deux le temps restant d’un rituel adverse. Un seul changement de durée par carte.','⌛','presto','spell','presto','standard','commune',true,false,'edition_01'),
('spell-adagio','SORTILÈGES','ADAGIO','Double le temps restant d’un rituel adverse. Un seul changement de durée par carte.','☾','adagio','spell','adagio','standard','commune',true,false,'edition_01'),
('spell-augmento','SORTILÈGES','AUGMENTO','Double l’effet d’un rituel adverse. Un seul changement d’effet par carte.','✧','augmento','spell','augmento','full_art_foil','légendaire',true,false,'edition_01'),
('spell-destructo','SORTILÈGES','DESTRUCTO','Détruit un exemplaire disponible dans la main adverse, à condition de l’avoir déjà découvert.','◇','destructo','spell','destructo','full_art_foil','légendaire',true,false,'edition_01'),
('fafoil-foodies-journee','LES FOODIES','on mange TOUT ce que je veux, toute la journée','on mange TOUT ce que je veux, toute la journée','♨','foodies','challenge',null,'full_art_foil','légendaire',false,true,'edition_01'),
('fafoil-todo-travaux','TO DO','gros travaux effectué par l’autre','gros travaux effectué par l’autre','✓','todo','challenge',null,'full_art_foil','légendaire',false,true,'edition_01')
on conflict(id) do update set title=excluded.title,challenge=excluded.challenge,category=excluded.category,
  symbol=excluded.symbol,palette=excluded.palette,card_type=excluded.card_type,spell_code=excluded.spell_code,
  finish_tier=excluded.finish_tier,rarity=excluded.rarity,active=excluded.active,demo=excluded.demo,edition=excluded.edition;

insert into public.tcg_card_templates(id,category,title,challenge,symbol,palette,card_type,finish_tier,rarity,active,demo,edition) values
('legend-couple','EN COUPLE','EN COUPLE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','couple','challenge','legendary','légendaire',true,false,'edition_01'),
('legend-other','POUR L''AUTRE','POUR L’AUTRE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','other','challenge','legendary','légendaire',true,false,'edition_01'),
('legend-nude','MISE À NUE','MISE À NUE · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','nude','challenge','legendary','légendaire',true,false,'edition_01'),
('legend-foodies','LES FOODIES','LES FOODIES · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','foodies','challenge','legendary','légendaire',true,false,'edition_01'),
('legend-todo','TO DO','TO DO · LÉGENDAIRE','Choisis un défi full art + foil de cette catégorie.','✵','todo','challenge','legendary','légendaire',true,false,'edition_01')
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

-- Internal picker: a single source of truth for temporal eligibility, profile
-- restrictions and the 0.8 individual weight of Mise à nue cards.
create or replace function public.tcg_pick_template(
  p_role text, p_card_type text, p_finish text, p_excluded_ids text[], p_at timestamptz default now()
) returns setof public.tcg_card_templates
language sql volatile
set search_path = public, pg_temp
as $$
  select t.* from public.tcg_card_templates t
  where t.active and not t.demo and (t.card_type = p_card_type or (p_card_type='challenge_or_spell' and t.card_type in ('challenge','spell')))
    and (p_card_type not in ('challenge','challenge_or_spell') or t.finish_tier = p_finish)
    and (t.eligible_role is null or t.eligible_role = p_role)
    and (t.draw_from is null or (p_at >= t.draw_from and p_at < t.draw_until))
    and not (t.id = any(coalesce(p_excluded_ids, array[]::text[])))
  order by -ln(greatest(random(), 0.000000000001)) /
    case when t.category = 'MISE À NUE' then 0.8 else 1.0 end
  limit 1;
$$;
revoke all on function public.tcg_pick_template(text,text,text,text[],timestamptz) from public, anon, authenticated;

-- One guaranteed themed reward in a purchased packet. Keep the normal finish roll.
create or replace function public.tcg_pick_themed_template(
  p_role text, p_kind text, p_finish text, p_excluded_ids text[], p_at timestamptz default now()
) returns setof public.tcg_card_templates
language sql volatile set search_path=public,pg_temp as $$
  select t.* from public.tcg_card_templates t
  where t.active and not t.demo and t.finish_tier=p_finish
    and (t.eligible_role is null or t.eligible_role=p_role)
    and (t.draw_from is null or (p_at>=t.draw_from and p_at<t.draw_until))
    and not (t.id=any(coalesce(p_excluded_ids,array[]::text[])))
    and ((p_kind='magician' and t.card_type='spell')
      or (p_kind='pleasure' and t.card_type='challenge' and t.category='MISE À NUE')
      or (p_kind='relax' and t.card_type='challenge' and t.category='POUR L''AUTRE'
        and (t.title ilike '%MASSAGE%' or t.title ilike '%SOIN%')))
  order by -ln(greatest(random(),0.000000000001)) /
    case when t.category='MISE À NUE' then 0.8 else 1.0 end
  limit 1;
$$;
revoke all on function public.tcg_pick_themed_template(text,text,text,text[],timestamptz) from public,anon,authenticated;

-- Pure schedule calculation: no inventory changes or new public API.
create or replace function public.tcg_daily_release_window(p_now timestamptz)
returns table(release_date date,available_at timestamptz,expires_at timestamptz)
language sql stable set search_path = '' as $function$
  select d.day, d.at, d.at + interval '48 hours'
  from (
    select ((p_now at time zone 'Europe/Paris' - interval '5 hours')::date - n) as day,
      (((p_now at time zone 'Europe/Paris' - interval '5 hours')::date - n) + time '05:00') at time zone 'Europe/Paris' as at
    from generate_series(0,2) n
  ) d where d.at <= p_now and d.at + interval '48 hours' > p_now;
$function$;
revoke all on function public.tcg_daily_release_window(timestamptz) from public,anon,authenticated;

-- Calendar-only helpers: private, deterministic for a supplied instant.
create or replace function public.tcg_birthday_multiplier(p_role text,p_now timestamptz)
returns double precision language sql stable set search_path='' as $fn$
  select case when p_role='AG' and p_now >= timestamptz '2026-11-08 00:00 Europe/Paris'
    and p_now < timestamptz '2026-11-09 00:00 Europe/Paris' then 2.0 else 1.0 end;
$fn$;
create or replace function public.tcg_challenge_finish(p_role text,p_now timestamptz,p_roll double precision,p_allow_legendary boolean default true)
returns text language sql stable set search_path='' as $fn$
  select case when p_roll < .005*m and p_allow_legendary then 'legendary'
    when p_roll < .025*m then 'full_art_foil'
    when p_roll < .105*m then 'foil'
    when p_roll < .305*m then 'full_art' else 'standard' end
  from (select public.tcg_birthday_multiplier(p_role,p_now) m) b;
$fn$;
create or replace function public.tcg_birthday_booster_window(p_now timestamptz)
returns table(owner_role text,bonus_key text,available_at timestamptz,expires_at timestamptz)
language sql stable set search_path='' as $fn$
  select 'AG'::text,'birthday-mamamouth-2026-11-08'::text,
    timestamptz '2026-11-08 00:00 Europe/Paris',timestamptz '2026-11-10 00:00 Europe/Paris'
  where p_now >= timestamptz '2026-11-08 00:00 Europe/Paris'
    and p_now < timestamptz '2026-11-10 00:00 Europe/Paris';
$fn$;
revoke all on function public.tcg_birthday_multiplier(text,timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_challenge_finish(text,timestamptz,double precision,boolean) from public,anon,authenticated;
revoke all on function public.tcg_birthday_booster_window(timestamptz) from public,anon,authenticated;

-- Additive one-shot event. No existing save, drop or discovery is rewritten.
create table if not exists public.tcg_deck_games (
  event_id text not null default 'depressive-deck-2026-10-26'
    check (event_id = 'depressive-deck-2026-10-26'),
  owner_role text not null references public.tcg_players(role),
  announced_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  attempts integer not null default 0 check (attempts between 0 and 20),
  board integer[] not null default '{}' check (cardinality(board) in (0,20)),
  reward_templates text[] not null default '{}' check (cardinality(reward_templates) in (0,10)),
  reward_card_ids uuid[] not null default array_fill(null::uuid,array[10]) check (cardinality(reward_card_ids)=10),
  matched_pairs integer[] not null default '{}' check (cardinality(matched_pairs)<=10),
  exposed integer[] not null default '{}' check (cardinality(exposed)<=2),
  last_reward_id uuid references public.tcg_cards(id),
  primary key(event_id,owner_role),
  check (completed_at is null or started_at is not null),
  check ((started_at is null and cardinality(board)=0 and cardinality(reward_templates)=0)
    or (started_at is not null and cardinality(board)=20 and cardinality(reward_templates)=10))
);
create index if not exists tcg_deck_games_owner_idx on public.tcg_deck_games(owner_role);
create index if not exists tcg_deck_games_last_reward_idx on public.tcg_deck_games(last_reward_id);
alter table public.tcg_deck_games enable row level security;
revoke all on public.tcg_deck_games from public,anon,authenticated;
comment on table public.tcg_deck_games is 'One immutable draw per profile for the 26 October 2026 event. Hidden board and prizes never leave the token-validated API.';

create or replace function public.tcg_deck_window(p_at timestamptz) returns boolean
language sql immutable set search_path='' as $fn$
  select p_at >= timestamptz '2026-10-26 00:00 Europe/Paris'
    and p_at < timestamptz '2026-10-27 05:00 Europe/Paris';
$fn$;
create or replace function public.tcg_deck_finish(p_roll double precision) returns text
language sql immutable strict set search_path='' as $fn$
  select case when p_roll < .005 then 'legendary' when p_roll < .025 then 'full_art_foil'
    when p_roll < .105 then 'foil' when p_roll < .305 then 'full_art' else 'standard' end;
$fn$;

create or replace function public.tcg_deck_card(p_id uuid,p_role text) returns jsonb
language sql stable set search_path='' as $fn$
  select jsonb_build_object('id',c.id,'template_id',t.id,'category',t.category,'title',t.title,
    'challenge',t.challenge,'symbol',t.symbol,'palette',t.palette,'card_type',t.card_type,
    'spell_code',t.spell_code,'edition',t.edition,'finish',c.finish,'wear_seed',c.wear_seed,
    'status',c.status,'acquired_at',c.acquired_at,'expires_at',c.expires_at,
    'legendary_options',case when c.finish='legendary' then public.tcg_legendary_options(p_role,t.category) else '[]'::jsonb end)
  from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id
  where c.id=p_id;
$fn$;

create or replace function public.tcg_deck_snapshot(p_role text,p_at timestamptz default now()) returns jsonb
language plpgsql stable set search_path='' as $fn$
declare g public.tcg_deck_games%rowtype;
begin
  select * into g from public.tcg_deck_games where owner_role=p_role and event_id='depressive-deck-2026-10-26';
  return jsonb_build_object('event_id','depressive-deck-2026-10-26',
    'available',public.tcg_deck_window(p_at),'start_until',timestamptz '2026-10-27 05:00 Europe/Paris',
    'announced',g.announced_at is not null,'started',g.started_at is not null,
    'done',g.completed_at is not null,'revision',coalesce(g.revision,0),
    'turns',coalesce(g.attempts,0),'remaining',20-coalesce(g.attempts,0),
    'found',coalesce(cardinality(g.matched_pairs),0),'pending',coalesce(cardinality(g.exposed),0)=2,
    'last_reward',public.tcg_deck_card(g.last_reward_id,p_role),
    'rewards',(select coalesce(jsonb_agg(public.tcg_deck_card(x,p_role) order by n),'[]'::jsonb)
      from unnest(g.reward_card_ids) with ordinality a(x,n) where x is not null),
    'tiles',(select coalesce(jsonb_agg(jsonb_build_object('index',n-1,
      'up',pair=any(g.matched_pairs) or (n-1)=any(g.exposed),
      'matched',pair=any(g.matched_pairs),
      'motif',case when pair=any(g.matched_pairs) or (n-1)=any(g.exposed) then pair else null end) order by n),'[]'::jsonb)
      from unnest(g.board) with ordinality a(pair,n)));
end;
$fn$;

-- Called only after tcg_exchange has authenticated the device and taken tcg:main.
create or replace function public.tcg_deck_action(p_role text,p_action text,p_payload jsonb,p_at timestamptz default now())
returns void language plpgsql set search_path='' as $fn$
declare
  g public.tcg_deck_games%rowtype;
  t public.tcg_card_templates%rowtype;
  v_templates text[]:='{}';
  v_board integer[];
  v_index integer;
  v_pair integer;
  v_matched integer;
  v_match boolean;
  v_ending boolean;
  v_card uuid;
  v_finish text;
begin
  if p_role not in ('AG','CL') then raise exception 'invalid_request'; end if;
  select * into g from public.tcg_deck_games where owner_role=p_role and event_id='depressive-deck-2026-10-26' for update;
  if p_action='deck_dismiss' then
    if public.tcg_deck_window(p_at) or g.started_at is not null then
      insert into public.tcg_deck_games(owner_role,announced_at) values(p_role,p_at)
      on conflict(event_id,owner_role) do update set announced_at=coalesce(public.tcg_deck_games.announced_at,excluded.announced_at);
    end if;
    return;
  end if;
  if p_action='deck_start' then
    -- Idempotent: repeated starts and other devices always resume the same draw.
    if g.started_at is not null then return; end if;
    if not public.tcg_deck_window(p_at) then raise exception 'deck_closed'; end if;
    for v_index in 1..10 loop
      v_finish:=public.tcg_deck_finish(random());
      select * into t from public.tcg_pick_template(p_role,
        case when v_finish='standard' and random()<.10 then 'joker' else 'challenge_or_spell' end,
        v_finish,array[]::text[],p_at);
      if not found then raise exception 'no_active_card'; end if;
      v_templates:=array_append(v_templates,t.id);
    end loop;
    select array_agg(pair order by random()) into v_board from generate_series(0,19) a(pair_index)
      cross join lateral (select pair_index/2 pair) b;
    insert into public.tcg_deck_games(owner_role,announced_at,started_at,board,reward_templates,revision)
      values(p_role,p_at,p_at,v_board,v_templates,1)
    on conflict(event_id,owner_role) do update set announced_at=coalesce(public.tcg_deck_games.announced_at,p_at),
      started_at=p_at,board=v_board,reward_templates=v_templates,revision=public.tcg_deck_games.revision+1;
    return;
  end if;
  if g.started_at is null then raise exception 'deck_not_started'; end if;
  if coalesce(p_payload->>'revision','') !~ '^[0-9]{1,9}$'
    or (p_payload->>'revision')::integer <> g.revision then raise exception 'deck_state_changed'; end if;
  if p_action='deck_continue' then
    if g.last_reward_id is not null then
      update public.tcg_deck_games set last_reward_id=null,revision=revision+1 where event_id=g.event_id and owner_role=p_role;
    end if;
    return;
  end if;
  if g.completed_at is not null then return; end if;
  if p_action='deck_flip' then
    if cardinality(g.exposed)=2 or g.last_reward_id is not null then raise exception 'deck_pending'; end if;
    if coalesce(p_payload->>'index','') !~ '^(0|[1-9]|1[0-9])$' then raise exception 'invalid_request'; end if;
    v_index:=(p_payload->>'index')::integer;
    if v_index=any(g.exposed) or g.board[v_index+1]=any(g.matched_pairs) then raise exception 'deck_tile_unavailable'; end if;
    update public.tcg_deck_games set exposed=array_append(exposed,v_index),
      attempts=attempts+case when cardinality(exposed)=1 then 1 else 0 end,revision=revision+1
      where event_id=g.event_id and owner_role=p_role;
  elsif p_action='deck_resolve' then
    if cardinality(g.exposed)<>2 then return; end if;
    v_matched:=g.board[g.exposed[1]+1];
    v_match:=v_matched=g.board[g.exposed[2]+1];
    if v_match then g.matched_pairs:=array_append(g.matched_pairs,v_matched); end if;
    v_ending:=g.attempts=20 or cardinality(g.matched_pairs)=10;
    for v_pair in 0..9 loop
      if g.reward_card_ids[v_pair+1] is null and ((v_match and v_pair=v_matched) or v_ending) then
        select * into t from public.tcg_card_templates where id=case when v_match and v_pair=v_matched
          then g.reward_templates[v_pair+1] else 'energy-bisou' end;
        if not found then raise exception 'no_active_card'; end if;
        insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,acquired_at,expires_at)
          values(t.id,p_role,t.finish_tier,floor(random()*1000000)::integer,p_at,p_at+interval '7 days') returning id into v_card;
        g.reward_card_ids[v_pair+1]:=v_card;
        if v_match and v_pair=v_matched then g.last_reward_id:=v_card; end if;
        insert into public.tcg_discoveries(role,template_id,first_seen_at,last_seen_at)
          values(p_role,t.id,p_at,p_at)
        on conflict(role,template_id) do update set last_seen_at=p_at,times_seen=public.tcg_discoveries.times_seen+1;
      end if;
    end loop;
    update public.tcg_deck_games set exposed='{}',matched_pairs=g.matched_pairs,reward_card_ids=g.reward_card_ids,
      last_reward_id=g.last_reward_id,completed_at=case when v_ending then p_at end,revision=revision+1
      where event_id=g.event_id and owner_role=p_role;
  else raise exception 'invalid_request'; end if;
end;
$fn$;
revoke all on function public.tcg_deck_window(timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_deck_finish(double precision) from public,anon,authenticated;
revoke all on function public.tcg_deck_card(uuid,text) from public,anon,authenticated;
revoke all on function public.tcg_deck_snapshot(text,timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_deck_action(text,text,jsonb,timestamptz) from public,anon,authenticated;


-- Additive economy. Existing cards and timed rituals are not repriced retroactively.
alter table public.tcg_cards add column if not exists economy_eligible boolean not null default false;

create table if not exists public.tcg_economy_wallets (
  role text primary key references public.tcg_players(role),
  balance integer not null default 0 check (balance >= -12),
  updated_at timestamptz not null default now()
);
insert into public.tcg_economy_wallets(role) values ('AG'),('CL') on conflict(role) do nothing;
alter table public.tcg_economy_wallets enable row level security;
revoke all on public.tcg_economy_wallets from public,anon,authenticated;

create table if not exists public.tcg_ritual_claims (
  card_id uuid primary key references public.tcg_cards(id),
  owner_role text not null references public.tcg_players(role),
  status text not null check (status in ('pending','approved','rejected','passed','expired','unanswered')),
  claimed_at timestamptz not null default now(),
  resolved_at timestamptz,
  amount integer not null default 0
);
create index if not exists tcg_ritual_claims_owner_idx on public.tcg_ritual_claims(owner_role,status);
alter table public.tcg_ritual_claims enable row level security;
revoke all on public.tcg_ritual_claims from public,anon,authenticated;

create table if not exists public.tcg_economy_events (
  id uuid primary key default gen_random_uuid(),
  role text not null references public.tcg_players(role),
  event_type text not null,
  card_id uuid references public.tcg_cards(id),
  amount integer not null,
  balance_after integer not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tcg_economy_events_role_idx on public.tcg_economy_events(role,created_at desc);
create unique index if not exists tcg_economy_bonus_once_idx on public.tcg_economy_events(role,event_type)
  where event_type='launch_bonus';
alter table public.tcg_economy_events enable row level security;
revoke all on public.tcg_economy_events from public,anon,authenticated;

-- Exactly one launch gift per real profile, without changing any old save.
with locked as (select role,balance from public.tcg_economy_wallets for update),
granted as (
  insert into public.tcg_economy_events(role,event_type,amount,balance_after)
  select role,'launch_bonus',6,balance+6 from locked
  on conflict(role,event_type) where event_type='launch_bonus' do nothing
  returning role
)
update public.tcg_economy_wallets w set balance=w.balance+6,updated_at=now()
from granted g where w.role=g.role;

create table if not exists public.tcg_bank_trades (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null references public.tcg_players(role),
  trade_date date not null,
  recipe text not null,
  input_card_ids uuid[] not null,
  reward_card_id uuid not null references public.tcg_cards(id),
  created_at timestamptz not null default now(),
  unique(owner_role,trade_date)
);
alter table public.tcg_bank_trades enable row level security;
revoke all on public.tcg_bank_trades from public,anon,authenticated;

create or replace function public.tcg_ritual_value(p_finish text) returns integer
language sql immutable set search_path=public,pg_temp as $$
  select case p_finish when 'full_art' then 2 when 'foil' then 3 when 'full_art_foil' then 6 when 'legendary' then 10 else 1 end;
$$;
create or replace function public.tcg_sale_price(p_finish text,p_expires timestamptz,p_at timestamptz default now()) returns integer
language sql stable set search_path=public,pg_temp as $$
  select greatest(1,ceil((case p_finish when 'foil' then 2 when 'full_art_foil' then 4 when 'legendary' then 7 else 1 end)::numeric
    * case when p_expires-p_at <= interval '24 hours' then 0.5 when p_expires-p_at <= interval '3 days' then 0.75 else 1 end)::integer);
$$;
create or replace function public.tcg_economy_apply(p_role text,p_amount integer,p_type text,p_card uuid default null,p_detail jsonb default '{}'::jsonb)
returns integer language plpgsql set search_path=public,pg_temp as $$
declare old_balance integer; new_balance integer;
begin
  select balance into old_balance from public.tcg_economy_wallets where role=p_role for update;
  if old_balance is null then raise exception 'wallet_unavailable'; end if;
  new_balance:=greatest(-12,old_balance+p_amount);
  update public.tcg_economy_wallets set balance=new_balance,updated_at=now() where role=p_role;
  insert into public.tcg_economy_events(role,event_type,card_id,amount,balance_after,detail)
    values(p_role,p_type,p_card,new_balance-old_balance,new_balance,p_detail);
  return new_balance;
end;
$$;
create or replace function public.tcg_economy_tick() returns void
language plpgsql set search_path=public,pg_temp as $$
declare c record; claim record;
begin
  for c in select x.id,x.owner_role,x.finish,t.category from public.tcg_cards x
    join public.tcg_card_templates t on t.id=x.template_id
    where x.status='activated' and x.active_until<=now() and x.economy_eligible
      and not exists(select 1 from public.tcg_ritual_claims r where r.card_id=x.id)
  loop
    insert into public.tcg_ritual_claims(card_id,owner_role,status,claimed_at,resolved_at)
      values(c.id,c.owner_role,'expired',now(),now()) on conflict(card_id) do nothing;
    if found then
      perform public.tcg_economy_apply(c.owner_role,-public.tcg_ritual_value(c.finish),'ritual_expired',c.id);
    end if;
  end loop;
  for claim in select card_id,owner_role from public.tcg_ritual_claims
    where status='pending' and claimed_at+interval '24 hours'<=now()
  loop
    update public.tcg_ritual_claims set status='unanswered',resolved_at=now() where card_id=claim.card_id and status='pending';
    if found then perform public.tcg_economy_apply(claim.owner_role,0,'ritual_unanswered',claim.card_id); end if;
  end loop;
end;
$$;

create or replace function public.tcg_economy_action(p_role text,p_action text,p_payload jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
  c public.tcg_cards%rowtype;
  t public.tcg_card_templates%rowtype;
  claim public.tcg_ritual_claims%rowtype;
  other_role text:=case when p_role='AG' then 'CL' else 'AG' end;
  ids uuid[]; n integer; energy_count integer; standard_count integer; art_count integer; foil_count integer;
  category_count integer; card_type_count integer; v_finish text; v_type text; v_price integer;
  reward_id uuid; v_day date:=(timezone('Europe/Paris',now())-interval '5 hours')::date;
  v_week date:=date_trunc('week',timezone('Europe/Paris',now()))::date;
  v_kind text; v_cost integer;
begin
  if p_action in ('complete_card','ritual_pass') then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if c.id is null or c.status<>'activated' or c.active_until<=now() then raise exception 'card_unavailable'; end if;
    if exists(select 1 from public.tcg_ritual_claims where card_id=c.id) then raise exception 'ritual_already_claimed'; end if;
    select * into t from public.tcg_card_templates where id=c.template_id;
    if p_action='complete_card' then
      insert into public.tcg_ritual_claims(card_id,owner_role,status) values(c.id,p_role,'pending');
    else
      insert into public.tcg_ritual_claims(card_id,owner_role,status,resolved_at) values(c.id,p_role,'passed',now());
      update public.tcg_cards set status='used',consumed_at=now(),active_until=now() where id=c.id;
      perform public.tcg_economy_apply(p_role,case when not c.economy_eligible then 0 else -public.tcg_ritual_value(c.finish) end,'ritual_passed',c.id);
    end if;
  elsif p_action='ritual_review' then
    begin select * into claim from public.tcg_ritual_claims where card_id=(p_payload->>'card_id')::uuid for update;
    exception when invalid_text_representation then raise exception 'ritual_unavailable'; end;
    if claim.card_id is null or claim.owner_role<>other_role or claim.status<>'pending' or claim.claimed_at+interval '24 hours'<=now() then raise exception 'ritual_unavailable'; end if;
    if coalesce(p_payload->>'decision','') not in ('approve','reject') then raise exception 'invalid_request'; end if;
    select * into c from public.tcg_cards where id=claim.card_id for update;
    select * into t from public.tcg_card_templates where id=c.template_id;
    v_price:=case when p_payload->>'decision'='approve' then public.tcg_ritual_value(c.finish)
      when not c.economy_eligible then 0 else -public.tcg_ritual_value(c.finish) end;
    update public.tcg_ritual_claims set status=case when v_price>0 then 'approved' else 'rejected' end,
      resolved_at=now(),amount=v_price where card_id=c.id;
    update public.tcg_cards set status='used',consumed_at=now(),active_until=now() where id=c.id and status='activated';
    if v_price>0 then insert into public.tcg_card_events(card_id,actor_role,event_type) values(c.id,claim.owner_role,'complete_card'); end if;
    perform public.tcg_economy_apply(claim.owner_role,v_price,case when v_price>0 then 'ritual_approved' else 'ritual_rejected' end,c.id);
  elsif p_action='sell_cards' then
    if jsonb_typeof(p_payload->'card_ids')<>'array' then raise exception 'invalid_request'; end if;
    begin select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_payload->'card_ids') x(value);
    exception when invalid_text_representation then raise exception 'invalid_request'; end;
    n:=coalesce(cardinality(ids),0);
    if n<2 or n>50 or n<>coalesce((select count(distinct x) from unnest(ids) x),0) then raise exception 'invalid_request'; end if;
    if (select count(*) from public.tcg_cards where id=any(ids) and owner_role=p_role and status='available' and expires_at>now())<>n then raise exception 'card_unavailable'; end if;
    for c in select * from public.tcg_cards where id=any(ids) and owner_role=p_role for update loop
      v_price:=public.tcg_sale_price(c.finish,c.expires_at);
      update public.tcg_cards set status='destroyed',consumed_at=now() where id=c.id;
      perform public.tcg_economy_apply(p_role,v_price,'card_sold',c.id);
    end loop;
  elsif p_action='sell_card' then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if c.id is null or c.status<>'available' or c.expires_at<=now() then raise exception 'card_unavailable'; end if;
    v_price:=public.tcg_sale_price(c.finish,c.expires_at);
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=c.id;
    perform public.tcg_economy_apply(p_role,v_price,'card_sold',c.id);
  elsif p_action='buy_booster' then
    v_kind:=coalesce(p_payload->>'kind','classic');
    if v_kind not in ('classic','magician','pleasure','relax') then raise exception 'invalid_request'; end if;
    v_cost:=case when v_kind='classic' then 12 else 15 end;
    if (select count(*) from public.tcg_boosters where owner_role=p_role
      and (bonus_key='economy-'||v_week or bonus_key like 'economy-'||v_week||'-%'))>=3 then
      raise exception 'weekly_booster_used';
    end if;
    if (select balance from public.tcg_economy_wallets where role=p_role)<v_cost then raise exception 'not_enough_shards'; end if;
    insert into public.tcg_boosters(owner_role,release_date,bonus_key,booster_kind,available_at,expires_at)
      values(p_role,null,'economy-'||v_week||'-'||gen_random_uuid(),v_kind,now(),now()+interval '48 hours');
    perform public.tcg_economy_apply(p_role,-v_cost,'booster_bought',null,jsonb_build_object('kind',v_kind));
  elsif p_action='bank_exchange' then
    if exists(select 1 from public.tcg_bank_trades where owner_role=p_role and trade_date=v_day) then raise exception 'bank_used_today'; end if;
    if jsonb_typeof(p_payload->'card_ids')<>'array' then raise exception 'invalid_request'; end if;
    begin select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_payload->'card_ids') x(value);
    exception when invalid_text_representation then raise exception 'invalid_request'; end;
    n:=coalesce(cardinality(ids),0);
    if n<>coalesce((select count(distinct x) from unnest(ids) x),0) then raise exception 'invalid_request'; end if;
    if n not in (4,5,6,8,15) then raise exception 'invalid_request'; end if;
    if (select count(*) from public.tcg_cards where id=any(ids) and owner_role=p_role and status='available' and expires_at>now())<>n then raise exception 'card_unavailable'; end if;
    select count(*) filter(where template_row.card_type='energy'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='standard'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='full_art'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='foil')
      into energy_count,standard_count,art_count,foil_count
      from public.tcg_cards owned_card join public.tcg_card_templates template_row on template_row.id=owned_card.template_id where owned_card.id=any(ids);
    case p_payload->>'recipe'
      when 'draw' then
        if n<>5 or energy_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        if random()<0.10 then select * into t from public.tcg_pick_template(p_role,'joker','standard',array[]::text[]); end if;
        if t.id is null then
          v_finish:=public.tcg_challenge_finish(p_role,now(),random());
          select * into t from public.tcg_pick_template(p_role,'challenge_or_spell',v_finish,array[]::text[]);
        end if;
      when 'reforge' then
        if n<>4 or energy_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        select owned_card.* into c from public.tcg_cards owned_card where owned_card.id=any(ids) and owned_card.template_id not in
          (select id from public.tcg_card_templates where card_type='energy');
        select * into t from public.tcg_card_templates where id=c.template_id;
        select * into t from public.tcg_card_templates x where x.active and not x.demo and x.category=t.category
          and x.card_type=t.card_type and x.finish_tier=c.finish
          and (x.eligible_role is null or x.eligible_role=p_role)
          and (x.draw_from is null or (now()>=x.draw_from and now()<x.draw_until))
          order by -ln(greatest(random(),0.000000000001))/case when x.category='MISE À NUE' then 0.8 else 1 end limit 1;
      when 'common_to_art' then
        if n<>8 or energy_count<>3 or standard_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='full_art';
      when 'art_to_foil' then
        if n<>6 or energy_count<>3 or art_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='foil';
      when 'foil_to_artfoil' then
        if n<>6 or energy_count<>3 or foil_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='full_art_foil';
      when 'legendary' then
        if n<>15 or energy_count<>5 or art_count<>5 or foil_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='legendary';
      else raise exception 'invalid_request';
    end case;
    if t.id is null then select * into t from public.tcg_pick_template(p_role,'challenge',v_finish,array[]::text[]); end if;
    if t.id is null then raise exception 'bank_no_offer'; end if;
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=any(ids);
    insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,acquired_at,expires_at)
      values(t.id,p_role,t.finish_tier,floor(random()*1000000)::integer,now(),now()+interval '7 days') returning id into reward_id;
    insert into public.tcg_discoveries(role,template_id) values(p_role,t.id)
      on conflict(role,template_id) do update set last_seen_at=now(),times_seen=public.tcg_discoveries.times_seen+1;
    insert into public.tcg_bank_trades(owner_role,trade_date,recipe,input_card_ids,reward_card_id)
      values(p_role,v_day,p_payload->>'recipe',ids,reward_id);
    perform public.tcg_economy_apply(p_role,0,'bank_exchange',reward_id,jsonb_build_object('recipe',p_payload->>'recipe','input_card_ids',ids));
  end if;
end;
$$;

create or replace function public.tcg_economy_snapshot(p_role text) returns jsonb
language sql stable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'balance',(select balance from public.tcg_economy_wallets where role=p_role),
    'bank_used_today',exists(select 1 from public.tcg_bank_trades where owner_role=p_role and trade_date=(timezone('Europe/Paris',now())-interval '5 hours')::date),
    'weekly_boosters_bought',(select count(*) from public.tcg_boosters where owner_role=p_role and (bonus_key='economy-'||date_trunc('week',timezone('Europe/Paris',now()))::date or bonus_key like 'economy-'||date_trunc('week',timezone('Europe/Paris',now()))::date||'-%')),
    'last_bank_trade',(select jsonb_build_object('id',b.id,'recipe',b.recipe,'reward_card_id',b.reward_card_id)
      from public.tcg_bank_trades b where b.owner_role=p_role order by b.created_at desc limit 1),
    'pending_reviews',(select coalesce(jsonb_agg(jsonb_build_object('card_id',r.card_id,'title',coalesce(chosen.title,t.title),
      'owner_role',r.owner_role,'finish',c.finish,'category',t.category,'claimed_at',r.claimed_at)
      order by r.claimed_at),'[]'::jsonb)
      from public.tcg_ritual_claims r join public.tcg_cards c on c.id=r.card_id
      join public.tcg_card_templates t on t.id=c.template_id
      left join public.tcg_card_templates chosen on chosen.id=c.selected_template_id
      where r.status='pending'),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'amount',e.amount,
      'balance_after',e.balance_after,'card_id',e.card_id,'detail',e.detail,'created_at',e.created_at)
      order by e.created_at desc),'[]'::jsonb)
      from (select * from public.tcg_economy_events where role=p_role order by created_at desc limit 40) e)
  );
$$;

revoke all on function public.tcg_ritual_value(text) from public,anon,authenticated;
revoke all on function public.tcg_sale_price(text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_economy_apply(text,integer,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.tcg_economy_tick() from public,anon,authenticated;
revoke all on function public.tcg_economy_action(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.tcg_economy_snapshot(text) from public,anon,authenticated;

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
     or coalesce(p_action, '') not in ('login', 'sync', 'open_booster', 'activate_card', 'use_joker', 'trade_propose', 'trade_respond', 'trade_cancel', 'release_device', 'give_card', 'destroy_card', 'pin_card', 'complete_card', 'ritual_pass', 'ritual_review', 'sell_card', 'sell_cards', 'buy_booster', 'bank_exchange', 'opening_progress', 'finish_opening', 'use_spell', 'deck_start', 'deck_flip', 'deck_resolve', 'deck_continue', 'deck_dismiss')
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
        v_reward_amount:=case when v_roll<0.70 then 1 when v_roll<0.95 then 2 else 3 end;
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

      if not found then raise exception 'no_active_card'; end if;
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
    if offered.finish='legendary' then
      select * into choice_row from public.tcg_card_templates t where t.id=p_payload->>'choice_template_id'
        and exists(select 1 from jsonb_array_elements(public.tcg_legendary_options(v_role,template_row.category)) o where o->>'id'=t.id);
      if not found then raise exception 'invalid_legendary_choice'; end if;
    end if;
    update public.tcg_cards
    set status = 'activated', activated_at = now(), active_until = now() + interval '24 hours', economy_eligible=true,
      selected_template_id=case when offered.finish='legendary' then choice_row.id end
    where id = offered.id;

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
    'edition', case when now() >= timestamptz '2026-10-29 00:00:00 Europe/Paris' and now() < timestamptz '2026-11-02 00:00:00 Europe/Paris' then 'halloween_2026' else 'edition_01' end,
    'is_test', b.bonus_key='spells-legends-test-2026-10-25',
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
    'economy_eligible',c.economy_eligible
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
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 5, 'guaranteed_cards',3,'shard_slot_chance',0.60,'active_hours', 24, 'collection_days', 7, 'daily_release_hour', 5, 'joker_slot_chance', 0.10, 'legendary_chance',0.005*public.tcg_birthday_multiplier(v_role,now()),'birthday_role','AG','birthday_multiplier',public.tcg_birthday_multiplier(v_role,now()))
  );
end;
$$;

revoke all on function public.tcg_exchange(text,text,text,text,jsonb) from public;
grant execute on function public.tcg_exchange(text,text,text,text,jsonb) to anon, authenticated;

comment on table public.tcg_players is 'LES CARTES fixed AG/CL profiles. Direct access blocked.';
comment on table public.tcg_player_devices is 'Multiple paired devices per LES CARTES profile. Direct access blocked.';
comment on table public.tcg_card_templates is 'Card catalogue. Unknown templates are never returned before discovery.';
comment on function public.tcg_exchange(text,text,text,text,jsonb) is 'Token-validated API for LES CARTES; all direct table access is revoked.';

notify pgrst, 'reload schema';
commit;
