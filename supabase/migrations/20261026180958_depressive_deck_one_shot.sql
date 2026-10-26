-- Additive one-shot event. No existing save, drop or discovery is rewritten.
create table public.tcg_deck_games (
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
create index tcg_deck_games_owner_idx on public.tcg_deck_games(owner_role);
create index tcg_deck_games_last_reward_idx on public.tcg_deck_games(last_reward_id);
alter table public.tcg_deck_games enable row level security;
revoke all on public.tcg_deck_games from public,anon,authenticated;
comment on table public.tcg_deck_games is 'One immutable draw per profile for the 26 October 2026 event. Hidden board and prizes never leave the token-validated API.';

create function public.tcg_deck_window(p_at timestamptz) returns boolean
language sql immutable set search_path='' as $fn$
  select p_at >= timestamptz '2026-10-26 00:00 Europe/Paris'
    and p_at < timestamptz '2026-10-27 05:00 Europe/Paris';
$fn$;
create function public.tcg_deck_finish(p_roll double precision) returns text
language sql immutable strict set search_path='' as $fn$
  select case when p_roll < .005 then 'legendary' when p_roll < .025 then 'full_art_foil'
    when p_roll < .105 then 'foil' when p_roll < .305 then 'full_art' else 'standard' end;
$fn$;

create function public.tcg_deck_card(p_id uuid,p_role text) returns jsonb
language sql stable set search_path='' as $fn$
  select jsonb_build_object('id',c.id,'template_id',t.id,'category',t.category,'title',t.title,
    'challenge',t.challenge,'symbol',t.symbol,'palette',t.palette,'card_type',t.card_type,
    'spell_code',t.spell_code,'edition',t.edition,'finish',c.finish,'wear_seed',c.wear_seed,
    'status',c.status,'acquired_at',c.acquired_at,'expires_at',c.expires_at,
    'legendary_options',case when c.finish='legendary' then public.tcg_legendary_options(p_role,t.category) else '[]'::jsonb end)
  from public.tcg_cards c join public.tcg_card_templates t on t.id=c.template_id
  where c.id=p_id;
$fn$;

create function public.tcg_deck_snapshot(p_role text,p_at timestamptz default now()) returns jsonb
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
create function public.tcg_deck_action(p_role text,p_action text,p_payload jsonb,p_at timestamptz default now())
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

do $patch$
declare body text:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
begin
  if md5(body)<>'a3ed90d8930230d0ed5ba298cba6bd2e' then raise exception 'tcg_api_changed_review_required'; end if;
  body:=replace(body,$old$'finish_opening', 'use_spell')$old$,$new$'finish_opening', 'use_spell', 'deck_start', 'deck_flip', 'deck_resolve', 'deck_continue', 'deck_dismiss')$new$);
  body:=replace(body,$old$  -- Receipt writes never run timed game transitions or create a daily booster.$old$,$new$  if p_action in ('deck_start','deck_flip','deck_resolve','deck_continue','deck_dismiss') then
    perform public.tcg_deck_action(v_role,p_action,p_payload);
  end if;

  -- Receipt writes never run timed game transitions or create a daily booster.$new$);
  body:=replace(body,$old$    'boosters', v_boosters,$old$,$new$    'depressive_deck', public.tcg_deck_snapshot(v_role),
    'boosters', v_boosters,$new$);
  if position('perform public.tcg_deck_action(v_role,p_action,p_payload)' in body)=0
    or position('''depressive_deck'', public.tcg_deck_snapshot(v_role)' in body)=0 then raise exception 'deck_patch_incomplete'; end if;
  execute body;
end;
$patch$;
