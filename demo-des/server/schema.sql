-- Dés·ir: dedicated service-only application tables. No browser Data API grants.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
grant execute on function extensions.crypt(text,text),extensions.gen_salt(text,integer) to service_role;

create table if not exists public.desir_rooms (
  id uuid primary key default gen_random_uuid(),
  state jsonb not null check (jsonb_typeof(state)='object' and pg_column_size(state)<=1048576),
  revision bigint not null default 0 check (revision>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.desir_accounts (
  actor text primary key check (actor in ('a','b')),
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  login_normalized text not null unique check (length(login_normalized) between 1 and 80 and login_normalized=lower(btrim(login_normalized))),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  password_hash text not null check (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'),
  disabled_at timestamptz
);
create index if not exists desir_accounts_room_idx on public.desir_accounts(room_id);
create table if not exists public.desir_devices (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null references public.desir_accounts(actor),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '90 days'),
  revoked_at timestamptz
);
create index if not exists desir_devices_room_actor_idx on public.desir_devices(room_id,actor);
create index if not exists desir_devices_actor_idx on public.desir_devices(actor);
create table if not exists public.desir_requests (
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null check (actor in ('a','b')),
  request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id,actor,request_id)
);
create table if not exists public.desir_draw_usage (
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null check (actor in ('a','b')),
  window_key text not null,
  used_at timestamptz not null default now(),
  primary key(room_id,actor,window_key)
);
create table if not exists public.desir_rate_limits (
  bucket text primary key,
  count integer not null,
  resets_at timestamptz not null
);
create index if not exists desir_rate_limits_expiry_idx on public.desir_rate_limits(resets_at);
create table if not exists public.desir_push_outbox (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  round_id text,
  target_actor text not null check (target_actor in ('a','b')),
  kind text not null check (kind in ('invitation','confirmation','task-ready','shared-moment')),
  revision bigint not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  unique(room_id,revision,target_actor,kind)
);
alter table public.desir_push_outbox add column if not exists round_id text;
create index if not exists desir_requests_expiry_idx on public.desir_requests(created_at);
create index if not exists desir_push_outbox_pending_idx on public.desir_push_outbox(room_id,created_at) where delivered_at is null;

alter table public.desir_rooms enable row level security;
alter table public.desir_accounts enable row level security;
alter table public.desir_devices enable row level security;
alter table public.desir_requests enable row level security;
alter table public.desir_draw_usage enable row level security;
alter table public.desir_rate_limits enable row level security;
alter table public.desir_push_outbox enable row level security;
revoke all on public.desir_rooms,public.desir_accounts,public.desir_devices,public.desir_requests,public.desir_draw_usage,public.desir_rate_limits,public.desir_push_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.desir_rooms,public.desir_accounts,public.desir_devices,public.desir_requests,public.desir_draw_usage,public.desir_rate_limits,public.desir_push_outbox to service_role;

create or replace function public.desir_quota_window(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  local_at timestamp:=p_at at time zone 'Europe/Paris';
  start_at timestamp;
  finish_at timestamp;
  window_label text;
begin
  if local_at::time>=time '06:00' and local_at::time<time '12:00' then
    start_at:=local_at::date+time '06:00';finish_at:=local_at::date+time '12:00';window_label:='6 h – 12 h';
  elsif local_at::time>=time '12:00' and local_at::time<time '18:00' then
    start_at:=local_at::date+time '12:00';finish_at:=local_at::date+time '18:00';window_label:='12 h – 18 h';
  else
    start_at:=local_at::date+time '18:00';
    if local_at::time<time '06:00' then start_at:=start_at-interval '1 day';end if;
    finish_at:=(start_at::date+1)+time '06:00';window_label:='18 h – 6 h';
  end if;
  return jsonb_build_object('window',to_char(start_at,'YYYY-MM-DD"T"HH24:MI'),'label',window_label,
    'nextAt',to_char((finish_at at time zone 'Europe/Paris') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create or replace function public.desir_quota_status(p_room_id uuid,p_actor text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select w || jsonb_build_object('remaining',case when exists(select 1 from public.desir_draw_usage u where u.room_id=p_room_id and u.actor=p_actor and u.window_key=w->>'window') then 0 else 1 end)
  from (select public.desir_quota_window(now()) as w) q
$$;

create or replace function public.desir_rate_limit(p_bucket text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare usage_count integer;
begin
  if length(p_bucket)>200 or p_limit<1 or p_limit>10000 or p_seconds<1 or p_seconds>86400 then return false;end if;
  insert into public.desir_rate_limits(bucket,count,resets_at) values(p_bucket,1,now()+make_interval(secs=>p_seconds))
  on conflict(bucket) do update set
    count=case when public.desir_rate_limits.resets_at<=now() then 1 else least(public.desir_rate_limits.count+1,p_limit+1) end,
    resets_at=case when public.desir_rate_limits.resets_at<=now() then now()+make_interval(secs=>p_seconds) else public.desir_rate_limits.resets_at end
  returning count into usage_count;
  return usage_count<=p_limit;
end $$;

create or replace function public.desir_login(p_login text,p_password text,p_token_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare account public.desir_accounts%rowtype;device public.desir_devices%rowtype;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or length(p_login)>80 or octet_length(p_password)>72 or length(p_password)<1 then return null;end if;
  select * into account from public.desir_accounts where login_normalized=p_login and disabled_at is null;
  if not found then perform extensions.crypt(p_password,extensions.gen_salt('bf',12));return null;end if;
  if extensions.crypt(p_password,account.password_hash) is distinct from account.password_hash then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
  select * into device from public.desir_devices where token_hash=p_token_hash;
  if found and (device.actor<>account.actor or device.room_id<>account.room_id) then return jsonb_build_object('error','session_conflict');end if;
  insert into public.desir_devices(token_hash,room_id,actor) values(p_token_hash,account.room_id,account.actor)
  on conflict(token_hash) do update set last_seen_at=now(),expires_at=now()+interval '90 days',revoked_at=null;
  return jsonb_build_object('roomId',account.room_id,'actor',account.actor);
end $$;

create or replace function public.desir_get_session(p_token_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare device public.desir_devices%rowtype;room public.desir_rooms%rowtype;people jsonb;
begin
  update public.desir_devices d set last_seen_at=now(),expires_at=now()+interval '90 days'
  where d.token_hash=p_token_hash and d.revoked_at is null and d.expires_at>now()
    and exists(select 1 from public.desir_accounts a where a.actor=d.actor and a.room_id=d.room_id and a.disabled_at is null)
  returning d.* into device;
  if not found then return null;end if;
  select * into room from public.desir_rooms where id=device.room_id;
  select jsonb_agg(jsonb_build_object('id',actor,'name',display_name) order by actor) into people
    from public.desir_accounts where room_id=device.room_id and disabled_at is null;
  if jsonb_array_length(people)<>2 then return null;end if;
  room.state:=jsonb_set(room.state,'{players}',people,false);
  return jsonb_build_object('member',jsonb_build_object('token_hash',device.token_hash,'room_id',device.room_id,'actor',device.actor),
    'room',to_jsonb(room),'paired',true,'quota',public.desir_quota_status(device.room_id,device.actor));
end $$;

create or replace function public.desir_get_request(p_room_id uuid,p_actor text,p_request_id uuid,p_payload_hash text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare receipt public.desir_requests%rowtype;
begin
  select * into receipt from public.desir_requests where room_id=p_room_id and actor=p_actor and request_id=p_request_id;
  if not found then return jsonb_build_object('kind','missing');end if;
  if receipt.payload_hash<>p_payload_hash then return jsonb_build_object('kind','mismatch');end if;
  return jsonb_build_object('kind','replayed','response',receipt.response);
end $$;

create or replace function public.desir_commit(p_room_id uuid,p_actor text,p_request_id uuid,p_payload_hash text,p_expected_revision bigint,p_next_state jsonb,p_response jsonb,p_consume_ticket boolean default false,p_notification jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare room public.desir_rooms%rowtype;receipt public.desir_requests%rowtype;new_revision bigint;response jsonb;window_info jsonb;
begin
  select * into room from public.desir_rooms where id=p_room_id for update;
  if not found then return jsonb_build_object('kind','missing');end if;
  select * into receipt from public.desir_requests where room_id=p_room_id and actor=p_actor and request_id=p_request_id;
  if found then
    if receipt.payload_hash<>p_payload_hash then return jsonb_build_object('kind','mismatch');end if;
    return jsonb_build_object('kind','replayed','response',receipt.response);
  end if;
  if room.revision<>p_expected_revision then return jsonb_build_object('kind','conflict');end if;
  if p_consume_ticket then
    window_info:=public.desir_quota_window(now());
    if exists(select 1 from public.desir_draw_usage where room_id=p_room_id and actor=p_actor and window_key=window_info->>'window') then return jsonb_build_object('kind','quota_exhausted');end if;
    insert into public.desir_draw_usage(room_id,actor,window_key) values(p_room_id,p_actor,window_info->>'window');
  end if;
  new_revision:=room.revision+1;
  update public.desir_rooms set state=p_next_state,revision=new_revision,updated_at=now() where id=p_room_id;
  response:=p_response || jsonb_build_object('revision',new_revision,'quota',public.desir_quota_status(p_room_id,p_actor));
  insert into public.desir_requests(room_id,actor,request_id,payload_hash,response) values(p_room_id,p_actor,p_request_id,p_payload_hash,response);
  if p_notification is not null and p_notification->>'actor' in ('a','b') and p_notification->>'kind' in ('invitation','confirmation') then
    insert into public.desir_push_outbox(room_id,round_id,target_actor,kind,revision) values(p_room_id,coalesce(p_notification->>'roundId',p_next_state->'round'->>'id'),p_notification->>'actor',p_notification->>'kind',new_revision) on conflict do nothing;
  end if;
  return jsonb_build_object('kind','applied','response',response);
end $$;

create or replace function public.desir_expire_room(p_room_id uuid,p_expected_revision bigint,p_next_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.desir_rooms set state=p_next_state,revision=revision+1,updated_at=now() where id=p_room_id and revision=p_expected_revision;
  return found;
end $$;

revoke all on function public.desir_quota_window(timestamptz),public.desir_quota_status(uuid,text),public.desir_rate_limit(text,integer,integer),public.desir_login(text,text,text),public.desir_get_session(text),public.desir_get_request(uuid,text,uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb),public.desir_expire_room(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.desir_quota_window(timestamptz),public.desir_quota_status(uuid,text),public.desir_rate_limit(text,integer,integer),public.desir_login(text,text,text),public.desir_get_session(text),public.desir_get_request(uuid,text,uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb),public.desir_expire_room(uuid,bigint,jsonb) to service_role;

-- Idempotency receipts are a short-lived operational cache, never the score.
create or replace function public.desir_cleanup()
returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.desir_requests where created_at<now()-interval '7 days';
  delete from public.desir_rate_limits where resets_at<now()-interval '2 days';
  delete from public.desir_push_outbox where delivered_at<now()-interval '7 days';
end $$;
revoke all on function public.desir_cleanup() from public,anon,authenticated;
grant execute on function public.desir_cleanup() to service_role;
