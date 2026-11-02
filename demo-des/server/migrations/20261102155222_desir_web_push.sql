-- Apply after schema.sql. All access is from the authenticated server, never the public browser key.
create table if not exists public.desir_push_config (
  id integer primary key default 1 check (id = 1),
  public_key text not null check (public_key ~ '^[A-Za-z0-9_-]{87}$'),
  private_key text not null check (private_key ~ '^[A-Za-z0-9_-]{43}$'),
  subject text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.desir_push_subscriptions (
  endpoint_hash text primary key check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  token_hash text not null references public.desir_devices(token_hash) on delete cascade,
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null check (actor in ('a','b')),
  endpoint text not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists desir_push_subscriptions_room_actor on public.desir_push_subscriptions(room_id,actor);
create index if not exists desir_push_subscriptions_device on public.desir_push_subscriptions(token_hash);
create table if not exists public.desir_push_deliveries (
  event_id uuid not null references public.desir_push_outbox(id) on delete cascade,
  endpoint_hash text not null,
  delivered_at timestamptz not null default now(),
  primary key(event_id,endpoint_hash)
);
alter table public.desir_push_config enable row level security;
alter table public.desir_push_subscriptions enable row level security;
alter table public.desir_push_deliveries enable row level security;
revoke all on public.desir_push_config,public.desir_push_subscriptions,public.desir_push_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.desir_push_config,public.desir_push_subscriptions,public.desir_push_deliveries to service_role;

create or replace function public.desir_ensure_push_config(p_public_key text,p_private_key text,p_subject text)
returns setof public.desir_push_config language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  insert into public.desir_push_config(id,public_key,private_key,subject)
  values(1,p_public_key,p_private_key,p_subject) on conflict(id) do nothing;
  return query select * from public.desir_push_config where id=1;
end;
$$;

create or replace function public.desir_save_push_subscription(p_token_hash text,p_subscription jsonb)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  device public.desir_devices;
  endpoint_value text:=p_subscription->>'endpoint';
  endpoint_key text;
  owner_hash text;
  old_owner public.desir_devices;
begin
  select * into device from public.desir_devices where token_hash=p_token_hash and revoked_at is null and expires_at>now();
  if not found then raise exception 'Unknown device'; end if;
  if endpoint_value is null or length(endpoint_value)>4096 or jsonb_typeof(p_subscription)<>'object' then raise exception 'Invalid subscription'; end if;
  endpoint_key:=encode(sha256(convert_to(endpoint_value,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash,79432));
  perform pg_advisory_xact_lock(hashtextextended(endpoint_value,79431));
  select token_hash into owner_hash from public.desir_push_subscriptions where endpoint_hash=endpoint_key;
  if owner_hash is not null and owner_hash<>p_token_hash then
    select * into old_owner from public.desir_devices where token_hash=owner_hash;
    if old_owner.revoked_at is null and old_owner.expires_at>now() and (old_owner.actor<>device.actor or old_owner.room_id<>device.room_id) then
      raise exception 'Subscription belongs to another device';
    end if;
  end if;
  if owner_hash is distinct from p_token_hash and (select count(*) from public.desir_push_subscriptions where token_hash=p_token_hash)>=5 then raise exception 'Too many subscriptions'; end if;
  insert into public.desir_push_subscriptions(endpoint_hash,token_hash,room_id,actor,endpoint,subscription)
  values(endpoint_key,p_token_hash,device.room_id,device.actor,endpoint_value,p_subscription)
  on conflict(endpoint_hash) do update set token_hash=excluded.token_hash,room_id=excluded.room_id,actor=excluded.actor,subscription=excluded.subscription,updated_at=now();
  return true;
end;
$$;

create or replace function public.desir_claim_push_outbox(p_room_id uuid default null,p_limit integer default 10)
returns setof public.desir_push_outbox language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  update public.desir_push_outbox set delivered_at=now(),lease_until=null
  where delivered_at is null and created_at<now()-interval '24 hours' and (p_room_id is null or room_id=p_room_id);
  return query with selected as (
    select id from public.desir_push_outbox
    where delivered_at is null and attempts<8 and (lease_until is null or lease_until<=now())
      and (p_room_id is null or room_id=p_room_id)
    order by created_at,id limit greatest(1,least(p_limit,10)) for update skip locked
  )
  update public.desir_push_outbox outbox set attempts=outbox.attempts+1,lease_until=now()+interval '2 minutes'
  from selected where outbox.id=selected.id returning outbox.*;
end;
$$;

create or replace function public.desir_finish_push_event(p_event_id uuid,p_delivered boolean,p_retry_seconds integer default 60)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  update public.desir_push_outbox set
    delivered_at=case when p_delivered then now() else delivered_at end,
    lease_until=case when p_delivered then null else now()+make_interval(secs=>greatest(60,least(p_retry_seconds,3600))) end
  where id=p_event_id and delivered_at is null;
end;
$$;

create or replace function public.desir_record_push_delivery(p_event_id uuid,p_endpoint_hash text)
returns void language sql security invoker set search_path=pg_catalog,public as $$
  insert into public.desir_push_deliveries(event_id,endpoint_hash) values(p_event_id,p_endpoint_hash) on conflict do nothing;
$$;
revoke all on function public.desir_ensure_push_config(text,text,text),public.desir_save_push_subscription(text,jsonb),public.desir_claim_push_outbox(uuid,integer),public.desir_finish_push_event(uuid,boolean,integer),public.desir_record_push_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.desir_ensure_push_config(text,text,text),public.desir_save_push_subscription(text,jsonb),public.desir_claim_push_outbox(uuid,integer),public.desir_finish_push_event(uuid,boolean,integer),public.desir_record_push_delivery(uuid,text) to service_role;
