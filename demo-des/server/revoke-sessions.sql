-- Revoke only devices belonging to the caller's account and stop their push deliveries.
-- This function is callable only by the trusted game service.
create or replace function public.desir_revoke_sessions(p_token_hash text,p_scope text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare device public.desir_devices%rowtype;
begin
  if p_scope is null or p_scope not in ('current','others') then return false; end if;
  select d.* into device from public.desir_devices d
    where d.token_hash=p_token_hash and d.revoked_at is null and d.expires_at>now()
      and exists(select 1 from public.desir_accounts a where a.actor=d.actor and a.room_id=d.room_id and a.disabled_at is null)
    for update;
  if not found then return false; end if;
  with revoked as (
    update public.desir_devices d set revoked_at=now()
      where d.room_id=device.room_id and d.actor=device.actor and d.revoked_at is null
        and case when p_scope='current' then d.token_hash=device.token_hash else d.token_hash<>device.token_hash end
      returning d.token_hash
  )
  delete from public.desir_push_subscriptions s where s.token_hash in (select token_hash from revoked);
  return true;
end $$;
revoke all on function public.desir_revoke_sessions(text,text) from public,anon,authenticated;
grant execute on function public.desir_revoke_sessions(text,text) to service_role;

-- Serialize subscription registration with revocation to prevent a revoked device restoring notifications.
create or replace function public.desir_save_push_subscription(p_token_hash text,p_subscription jsonb)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  device public.desir_devices;
  endpoint_value text:=p_subscription->>'endpoint';
  endpoint_key text;
  owner_hash text;
  old_owner public.desir_devices;
begin
  select * into device from public.desir_devices where token_hash=p_token_hash and revoked_at is null and expires_at>now() for update;
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

