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
  available_at timestamptz not null,
  expires_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_role, release_date),
  check (expires_at = available_at + interval '48 hours')
);

-- Daily release uniqueness remains untouched; gifts have no daily release date.
alter table public.tcg_boosters add column if not exists bonus_key text;
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
  select p.role, d.release_date, d.available_at, d.expires_at
  from public.tcg_players p cross join public.tcg_daily_release_window(now()) d
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
    'rules', jsonb_build_object('booster_hours', 48, 'booster_cards', 3, 'active_hours', 24, 'collection_days', 7, 'daily_release_hour', 5, 'joker_slot_chance', 0.10, 'legendary_chance',0.005)
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
