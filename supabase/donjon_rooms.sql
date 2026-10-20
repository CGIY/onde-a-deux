-- Independent, short-lived shared dungeon. Clients can only call this RPC.
begin;
create table if not exists public.donjon_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_role text not null check (host_role in ('J1','J2')),
  token_j1 text,
  token_j2 text,
  seen_j1 timestamptz,
  seen_j2 timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  pending_action jsonb,
  created_at timestamptz not null default now()
);

alter table public.donjon_rooms enable row level security;
revoke all on public.donjon_rooms from anon, authenticated;

create or replace function public.donjon_exchange(
  p_code text,
  p_role text,
  p_token text,
  p_create boolean default false,
  p_expected_version bigint default null,
  p_snapshot jsonb default null,
  p_action jsonb default null,
  p_clear_action_id text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  room public.donjon_rooms%rowtype;
  stored_token text;
  seen_at timestamptz;
  other_seen timestamptz;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{8}$' or p_role not in ('J1','J2')
     or p_token !~ '^[a-f0-9]{48}$' then
    raise exception 'invalid_session';
  end if;
  if p_snapshot is not null and
     (jsonb_typeof(p_snapshot) <> 'object' or length(p_snapshot::text) > 450000) then
    raise exception 'invalid_snapshot';
  end if;
  if p_action is not null and
     (jsonb_typeof(p_action) <> 'object' or length(p_action::text) > 1500
      or coalesce(p_action->>'id','') !~ '^[a-f0-9]{16}$') then
    raise exception 'invalid_action';
  end if;

  perform pg_advisory_xact_lock(hashtext('donjon:' || p_code));
  if p_create then
    delete from public.donjon_rooms where created_at < now() - interval '24 hours';
    if exists(select 1 from public.donjon_rooms where code = p_code) then
      raise exception 'room_taken';
    end if;
    insert into public.donjon_rooms(code,host_role,token_j1,token_j2,seen_j1,seen_j2)
    values (p_code,p_role,
      case when p_role='J1' then md5(p_token) end,
      case when p_role='J2' then md5(p_token) end,
      case when p_role='J1' then now() end,
      case when p_role='J2' then now() end);
  end if;

  select * into room from public.donjon_rooms where code = p_code for update;
  if not found then raise exception 'room_missing'; end if;
  if room.created_at < now() - interval '24 hours' then raise exception 'room_expired'; end if;
  stored_token := case when p_role='J1' then room.token_j1 else room.token_j2 end;
  seen_at := case when p_role='J1' then room.seen_j1 else room.seen_j2 end;
  if stored_token is not null and stored_token <> md5(p_token)
     and seen_at > now() - interval '45 seconds' then
    raise exception 'role_taken';
  end if;
  if p_role='J1' then
    update public.donjon_rooms set token_j1=md5(p_token),seen_j1=now() where code=p_code;
  else
    update public.donjon_rooms set token_j2=md5(p_token),seen_j2=now() where code=p_code;
  end if;

  if p_snapshot is not null or p_clear_action_id is not null then
    if room.host_role <> p_role then raise exception 'host_only'; end if;
    if p_expected_version is null or p_expected_version <> room.version then
      raise exception 'stale_version';
    end if;
    if p_clear_action_id is not null and
       coalesce(room.pending_action->>'id','') <> p_clear_action_id then
      raise exception 'stale_action';
    end if;
    update public.donjon_rooms set
      snapshot=coalesce(p_snapshot,snapshot),
      version=version+case when p_snapshot is null then 0 else 1 end,
      pending_action=case when p_clear_action_id is null then pending_action else null end
    where code=p_code;
  end if;
  if p_action is not null then
    if room.host_role = p_role then raise exception 'remote_only'; end if;
    if room.pending_action is not null then raise exception 'action_pending'; end if;
    update public.donjon_rooms set pending_action=p_action where code=p_code;
  end if;

  select * into room from public.donjon_rooms where code=p_code;
  other_seen := case when p_role='J1' then room.seen_j2 else room.seen_j1 end;
  return jsonb_build_object(
    'code',room.code,'host_role',room.host_role,'role',p_role,
    'ready',other_seen > now()-interval '15 seconds',
    'version',room.version,'snapshot',room.snapshot,
    'pending_action',case when room.host_role=p_role then room.pending_action else null end,
    'expires_at',room.created_at+interval '24 hours'
  );
end;
$$;

revoke all on function public.donjon_exchange(text,text,text,boolean,bigint,jsonb,jsonb,text) from public;
grant execute on function public.donjon_exchange(text,text,text,boolean,bigint,jsonb,jsonb,text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
