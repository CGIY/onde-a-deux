-- Authorized operator-only reset. This is a one-time transaction, not a public RPC.
-- Supply both transaction-local settings:
--   select set_config('desir.reset_room', '<verified room UUID>', true);
--   select set_config('desir.reset_revision', '<fresh room revision>', true);
-- To restart the star reserves too, also set desir.reset_wallets to 'true'.
-- Run those statements and this block in the same transaction. A stale revision
-- aborts every change; reread and review the target instead of blindly retrying.
do $desir_reset$
declare
  target uuid := nullif(current_setting('desir.reset_room', true), '')::uuid;
  expected_revision bigint := nullif(current_setting('desir.reset_revision', true), '')::bigint;
  reset_wallets boolean := coalesce(nullif(current_setting('desir.reset_wallets', true), '')::boolean, false);
  room public.desir_rooms%rowtype;
  live public.desir_hardcore_sessions%rowtype;
  reset_at timestamptz := now();
  stamp text := to_char(reset_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  sequence_before bigint;
  initial_wallet jsonb := jsonb_build_object('balance',1,'anchorAt',stamp,'spentAt',null);
  next_state jsonb := $blank${"version":2,"sequence":2,"players":[{"id":"a","name":"Joueur 1"},{"id":"b","name":"Joueur 2"}],"prefs":{"reducedMotion":false,"sound":false,"discreet":true,"reminder":true},"favorites":[],"history":[],"seen":{},"stats":{"totalCompleted":0,"byCategory":{"complicite":0,"detente":0,"projets":0,"attention":0,"bouffe":0,"intimite":0}},"tasks":[],"daily":null,"dailyReroll":{"dateKey":null,"used":[]},"joker":null,"pendingRounds":[],"lanes":{"a":{"phase":"category","round":{"id":"onde-1","from":"a","to":"b","awaiting":null,"categoryId":null,"categoryRoll":null,"hand":[],"cardId":null,"cardRoll":null,"cardRerolled":false,"hp":null,"rolls":[],"rollTokens":[],"challengeUsed":false,"status":"drawing","draftRolls":[],"draftRollTokens":[],"draftChallengeUsed":false,"autoProposed":false,"fromConfirmed":false,"toConfirmed":false,"adapted":false,"proposal":null,"schedule":null,"createdAt":null,"sentAt":null,"acceptedAt":null,"endedAt":null,"closedBy":null,"modeRoll":null,"hardcoreOffer":false}},"b":{"phase":"category","round":{"id":"onde-2","from":"b","to":"a","awaiting":null,"categoryId":null,"categoryRoll":null,"hand":[],"cardId":null,"cardRoll":null,"cardRerolled":false,"hp":null,"rolls":[],"rollTokens":[],"challengeUsed":false,"status":"drawing","draftRolls":[],"draftRollTokens":[],"draftChallengeUsed":false,"autoProposed":false,"fromConfirmed":false,"toConfirmed":false,"adapted":false,"proposal":null,"schedule":null,"createdAt":null,"sentAt":null,"acceptedAt":null,"endedAt":null,"closedBy":null,"modeRoll":null,"hardcoreOffer":false}}}}$blank$::jsonb;
  quota jsonb := public.desir_quota_window(reset_at);
begin
  if target is null or expected_revision is null then
    raise exception 'A verified room and revision are required for a game reset';
  end if;
  -- No room key changes. Allow the KEY SHARE locks used by in-flight Hardcore
  -- receipt foreign keys while waiting for their independently locked live row.
  select * into room from public.desir_rooms where id=target for no key update;
  if not found then raise exception 'Reset room does not exist'; end if;
  if room.revision<>expected_revision then raise exception 'Reset revision changed; reread before applying'; end if;
  if room.revision>=9007199254740991 then raise exception 'Reset revision exhausted'; end if;
  if room.state->>'version' is distinct from '2'
     or room.state->>'sequence' is null
     or room.state->>'sequence' !~ '^[1-9][0-9]*$'
     or (room.state->>'sequence')::numeric>9007199254740989
     or jsonb_typeof(room.state->'players') is distinct from 'array'
     or jsonb_typeof(room.state->'prefs') is distinct from 'object'
     or jsonb_typeof(room.state->'favorites') is distinct from 'array' then
    raise exception 'Reset requires a valid parallel game with available identifiers';
  end if;
  sequence_before := (room.state->>'sequence')::bigint;
  next_state := next_state || jsonb_build_object(
    'players', room.state->'players', 'prefs', room.state->'prefs',
    'favorites', room.state->'favorites', 'sequence', sequence_before+2,
    'cardRerollWallets', case when reset_wallets or room.state->'cardRerollWallets' is null
      then jsonb_build_object('a',initial_wallet,'b',initial_wallet)
      else room.state->'cardRerollWallets' end,
    'dailyReroll', jsonb_build_object('dateKey', to_char(reset_at at time zone 'Europe/Paris','YYYY-MM-DD'), 'used', '[]'::jsonb));
  next_state := jsonb_set(next_state, '{lanes,a,round,id}', to_jsonb('onde-'||(sequence_before+1)::text));
  next_state := jsonb_set(next_state, '{lanes,b,round,id}', to_jsonb('onde-'||(sequence_before+2)::text));
  next_state := jsonb_set(next_state, '{lanes,a,round,createdAt}', to_jsonb(stamp));
  next_state := jsonb_set(next_state, '{lanes,b,round,createdAt}', to_jsonb(stamp));

  -- Keep the independent live revision monotone, including an empty tombstone.
  insert into public.desir_hardcore_sessions(room_id) values(target) on conflict do nothing;
  select * into live from public.desir_hardcore_sessions where room_id=target for update;
  if live.revision>=9007199254740991 then raise exception 'Live reset revision exhausted'; end if;
  update public.desir_hardcore_sessions set state=null, revision=revision+1, updated_at=reset_at where room_id=target;
  delete from public.desir_hardcore_requests where room_id=target;

  update public.desir_rooms set state=next_state, revision=revision+1, updated_at=reset_at where id=target;
  delete from public.desir_requests where room_id=target;
  delete from public.desir_draw_usage where room_id=target;

  -- Invalidate both pending and already-claimed events. Keep their dedupe and
  -- delivery records so an old worker cannot make the same event pending again.
  update public.desir_push_outbox
    set delivered_at=reset_at, lease_until=null, expires_at=least(coalesce(expires_at,reset_at),reset_at)
    where room_id=target and delivered_at is null;
  -- Clearing today's usage must not trigger a new reminder merely because of
  -- the reset. Delivered sentinels suppress this window only; tomorrow is normal.
  insert into public.desir_push_outbox(room_id,target_actor,kind,revision,dedupe_key,window_key,expires_at,delivered_at)
    select target,actor,'draw-available',room.revision+1,'window:'||(quota->>'window'),
      quota->>'window',(quota->>'nextAt')::timestamptz,reset_at
    from public.desir_accounts where room_id=target and disabled_at is null
    on conflict do nothing;
end;
$desir_reset$;
