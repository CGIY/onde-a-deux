-- One independently versioned live session per existing duo; no normal game writes.
create table if not exists public.desir_hardcore_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into public.desir_hardcore_settings(singleton,enabled) values(true,true) on conflict(singleton) do nothing;
create table if not exists public.desir_hardcore_sessions (
  room_id uuid primary key references public.desir_rooms(id) on delete cascade,
  state jsonb check(state is null or (jsonb_typeof(state)='object' and pg_column_size(state)<=262144)),
  revision bigint not null default 0 check(revision>=0),
  updated_at timestamptz not null default now()
);
create table if not exists public.desir_hardcore_requests (
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null check(actor in ('a','b')),
  request_id uuid not null,
  payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key(room_id,actor,request_id)
);
create index if not exists desir_hardcore_requests_expiry_idx on public.desir_hardcore_requests(created_at);
alter table public.desir_hardcore_settings enable row level security;
alter table public.desir_hardcore_sessions enable row level security;
alter table public.desir_hardcore_requests enable row level security;
revoke all on public.desir_hardcore_settings,public.desir_hardcore_sessions,public.desir_hardcore_requests from public,anon,authenticated;
grant select,insert,update,delete on public.desir_hardcore_settings,public.desir_hardcore_sessions,public.desir_hardcore_requests to service_role;

-- Read-only authentication for the brief high-frequency live loop. It never
-- rewrites device presence, normal rooms, ticket windows or notification state.
create or replace function public.desir_hardcore_auth(p_token_hash text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('roomId',d.room_id,'actor',d.actor)
 from public.desir_devices d
 where d.token_hash=p_token_hash and d.revoked_at is null and d.expires_at>now()
 and exists(select 1 from public.desir_accounts a where a.actor=d.actor and a.room_id=d.room_id and a.disabled_at is null)
 and (select count(*) from public.desir_accounts a where a.room_id=d.room_id and a.disabled_at is null)=2
$$;

create or replace function public.desir_hardcore_get(p_room_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',coalesce((select enabled from public.desir_hardcore_settings where singleton),false),
   'state',(select state from public.desir_hardcore_sessions where room_id=p_room_id),
   'revision',coalesce((select revision from public.desir_hardcore_sessions where room_id=p_room_id),0))
$$;

create or replace function public.desir_hardcore_receipt(p_room_id uuid,p_actor text,p_request_id uuid,p_payload_hash text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare receipt public.desir_hardcore_requests%rowtype;
begin
 select * into receipt from public.desir_hardcore_requests where room_id=p_room_id and actor=p_actor and request_id=p_request_id;
 if not found then return jsonb_build_object('kind','missing');end if;
 return jsonb_build_object('kind',case when receipt.payload_hash=p_payload_hash then 'replayed' else 'mismatch' end);
end $$;

create or replace function public.desir_hardcore_commit(p_room_id uuid,p_actor text,p_request_id uuid,p_payload_hash text,p_expected_revision bigint,p_next_state jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare live public.desir_hardcore_sessions%rowtype;receipt public.desir_hardcore_requests%rowtype;
begin
 if p_actor not in ('a','b') or p_payload_hash !~ '^[0-9a-f]{64}$' or p_next_state is null then raise exception 'Invalid live commit';end if;
 if not coalesce((select enabled from public.desir_hardcore_settings where singleton),false) then return jsonb_build_object('kind','disabled');end if;
 insert into public.desir_hardcore_sessions(room_id) values(p_room_id) on conflict do nothing;
 select * into live from public.desir_hardcore_sessions where room_id=p_room_id for update;
 select * into receipt from public.desir_hardcore_requests where room_id=p_room_id and actor=p_actor and request_id=p_request_id;
 if found then
  if receipt.payload_hash<>p_payload_hash then return jsonb_build_object('kind','mismatch');end if;
  return jsonb_build_object('kind','replayed','state',live.state,'revision',live.revision);
 end if;
 if live.revision<>p_expected_revision then return jsonb_build_object('kind','conflict');end if;
 update public.desir_hardcore_sessions set state=p_next_state,revision=revision+1,updated_at=now() where room_id=p_room_id returning * into live;
 insert into public.desir_hardcore_requests(room_id,actor,request_id,payload_hash) values(p_room_id,p_actor,p_request_id,p_payload_hash);
 -- Keep the active session's receipt lifetime longer than its 30-minute lease.
 delete from public.desir_hardcore_requests where room_id=p_room_id and created_at<now()-interval '1 day';
 return jsonb_build_object('kind','applied','state',live.state,'revision',live.revision);
end $$;

revoke all on function public.desir_hardcore_auth(text),public.desir_hardcore_get(uuid),public.desir_hardcore_receipt(uuid,text,uuid,text),public.desir_hardcore_commit(uuid,text,uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.desir_hardcore_auth(text),public.desir_hardcore_get(uuid),public.desir_hardcore_receipt(uuid,text,uuid,text),public.desir_hardcore_commit(uuid,text,uuid,text,bigint,jsonb) to service_role;
