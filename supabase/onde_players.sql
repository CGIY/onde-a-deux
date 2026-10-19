-- Each device has its own role token. Browsers cannot query the table directly.
create table if not exists public.onde_players (
  room_code text not null check (room_code ~ '^[A-Z0-9]{6,8}$'),
  role text not null check (role in ('J1', 'J2')),
  device_token_hash text not null,
  state jsonb not null default '{}'::jsonb,
  last_seen timestamptz not null default now(),
  primary key (room_code, role)
);

alter table public.onde_players enable row level security;
revoke all on public.onde_players from anon, authenticated;

create or replace function public.onde_exchange(
  p_room_code text,
  p_role text,
  p_token text,
  p_create boolean default false,
  p_state jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_player public.onde_players%rowtype;
  room_exists boolean;
  response jsonb;
begin
  if p_room_code !~ '^[A-Z0-9]{6,8}$' or p_role not in ('J1', 'J2')
     or p_token !~ '^[a-f0-9]{48}$' then
    raise exception 'invalid_session';
  end if;
  if p_state is not null and
     (jsonb_typeof(p_state) <> 'object' or length(p_state::text) > 50000) then
    raise exception 'invalid_state';
  end if;

  select * into current_player from public.onde_players
    where room_code = p_room_code and role = p_role for update;
  if found then
    if current_player.device_token_hash <> md5(p_token) then
      if current_player.last_seen > now() - interval '45 seconds' then
        raise exception 'role_taken';
      end if;
      update public.onde_players
        set device_token_hash = md5(p_token), state = '{}'::jsonb, last_seen = now()
        where room_code = p_room_code and role = p_role;
    else
      update public.onde_players set last_seen = now()
        where room_code = p_room_code and role = p_role;
    end if;
  else
    select exists(select 1 from public.onde_players where room_code = p_room_code)
      into room_exists;
    if not room_exists and not p_create then raise exception 'room_missing'; end if;
    insert into public.onde_players(room_code, role, device_token_hash)
      values (p_room_code, p_role, md5(p_token));
  end if;

  if p_state is not null then
    update public.onde_players set state = p_state, last_seen = now()
      where room_code = p_room_code and role = p_role;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', role, 'state', state, 'last_seen', last_seen
  )), '[]'::jsonb) into response from public.onde_players
    where room_code = p_room_code;
  return response;
end;
$$;

revoke all on function public.onde_exchange(text,text,text,boolean,jsonb) from public;
grant execute on function public.onde_exchange(text,text,text,boolean,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
