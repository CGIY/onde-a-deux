-- EN VIE/CORPS stores only predefined action IDs and weekly progress.
-- Direct table access is blocked; clients must use the token-validated RPC.
begin;

create extension if not exists pgcrypto;

create table if not exists public.envie_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  token_a text,
  token_c text,
  state jsonb not null default '{"week":"","completed":[],"wishlist":[]}'::jsonb,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.envie_rooms enable row level security;
revoke all on public.envie_rooms from anon, authenticated;

create or replace function public.envie_exchange(
  p_code text,
  p_role text,
  p_token text,
  p_create boolean default false,
  p_expected_version bigint default null,
  p_state jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.envie_rooms%rowtype;
  token_hash text;
  stored_token text;
  other_token text;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{8}$'
     or p_role not in ('A','C')
     or p_token !~ '^[a-f0-9]{48}$' then
    raise exception 'invalid_session';
  end if;

  if p_state is not null then
    if jsonb_typeof(p_state) <> 'object'
       or length(p_state::text) > 50000
       or (p_state - array['week','completed','wishlist']) <> '{}'::jsonb
       or coalesce(p_state->>'week','') !~ '^\d{4}-\d{2}-\d{2}$'
       or jsonb_typeof(p_state->'completed') <> 'array'
       or jsonb_typeof(p_state->'wishlist') <> 'array'
       or jsonb_array_length(p_state->'completed') > 100
       or jsonb_array_length(p_state->'wishlist') > 100
       or exists (
         select 1 from jsonb_array_elements(p_state->'completed') item
         where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 80
       )
       or exists (
         select 1 from jsonb_array_elements(p_state->'wishlist') item
         where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 80
       ) then
      raise exception 'invalid_state';
    end if;
  end if;

  token_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtext('envie:' || p_code));

  if p_create then
    delete from public.envie_rooms where updated_at < now() - interval '180 days';
    if exists(select 1 from public.envie_rooms where code = p_code) then
      raise exception 'room_taken';
    end if;
    insert into public.envie_rooms(code, token_a, token_c, state)
    values (
      p_code,
      case when p_role = 'A' then token_hash end,
      case when p_role = 'C' then token_hash end,
      coalesce(p_state, '{"week":"","completed":[],"wishlist":[]}'::jsonb)
    );
  end if;

  select * into room from public.envie_rooms where code = p_code for update;
  if not found then raise exception 'room_missing'; end if;
  if room.updated_at < now() - interval '180 days' then raise exception 'room_expired'; end if;

  stored_token := case when p_role = 'A' then room.token_a else room.token_c end;
  if stored_token is null then
    if p_role = 'A' then
      update public.envie_rooms set token_a = token_hash, updated_at = now() where code = p_code;
    else
      update public.envie_rooms set token_c = token_hash, updated_at = now() where code = p_code;
    end if;
  elsif stored_token <> token_hash then
    raise exception 'role_taken';
  end if;

  if p_state is not null and not p_create then
    if p_expected_version is null or p_expected_version <> room.version then
      raise exception 'stale_version';
    end if;
    update public.envie_rooms
    set state = p_state, version = version + 1, updated_at = now()
    where code = p_code;
  end if;

  select * into room from public.envie_rooms where code = p_code;
  stored_token := case when p_role = 'A' then room.token_a else room.token_c end;
  other_token := case when p_role = 'A' then room.token_c else room.token_a end;

  if stored_token <> token_hash then raise exception 'invalid_token'; end if;

  return jsonb_build_object(
    'code', room.code,
    'role', p_role,
    'paired', other_token is not null,
    'version', room.version,
    'state', room.state,
    'updated_at', room.updated_at,
    'expires_at', room.updated_at + interval '180 days'
  );
end;
$$;

revoke all on function public.envie_exchange(text,text,text,boolean,bigint,jsonb) from public;
grant execute on function public.envie_exchange(text,text,text,boolean,bigint,jsonb) to anon, authenticated;

comment on table public.envie_rooms is
  'Private pair progress for EN VIE/CORPS; access only through validated RPC tokens.';

notify pgrst, 'reload schema';
commit;
