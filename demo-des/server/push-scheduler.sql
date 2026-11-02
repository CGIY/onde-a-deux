-- Apply after schema.sql and push-schema.sql. Cron wakes the server even with both apps closed.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists desir_internal;
revoke all on schema desir_internal from public,anon,authenticated;

create table if not exists public.desir_push_scheduler_config (
  id integer primary key default 1 check(id=1),
  endpoint_url text not null check(endpoint_url ~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/desir-game$'),
  cron_token text not null check(cron_token ~ '^[A-Za-z0-9_-]{43,128}$'),
  publishable_key text not null default '' check(publishable_key='' or publishable_key ~ '^sb_publishable_'),
  updated_at timestamptz not null default now()
);
alter table public.desir_push_scheduler_config enable row level security;
revoke all on public.desir_push_scheduler_config from public,anon,authenticated;
grant select,insert,update,delete on public.desir_push_scheduler_config to service_role;

alter table public.desir_push_outbox add column if not exists dedupe_key text;
alter table public.desir_push_outbox add column if not exists window_key text;
alter table public.desir_push_outbox add column if not exists task_id text;
alter table public.desir_push_outbox add column if not exists expires_at timestamptz;
alter table public.desir_push_outbox drop constraint if exists desir_push_outbox_kind_check;
alter table public.desir_push_outbox add constraint desir_push_outbox_kind_check check(kind in ('invitation','confirmation','task-ready','shared-moment','draw-available','task-reminder'));
alter table public.desir_push_outbox drop constraint if exists desir_push_outbox_room_id_revision_target_actor_kind_key;
create unique index if not exists desir_push_outbox_transition_unique on public.desir_push_outbox(room_id,revision,target_actor,kind) where dedupe_key is null;
create unique index if not exists desir_push_outbox_scheduled_unique on public.desir_push_outbox(room_id,target_actor,kind,dedupe_key) where dedupe_key is not null;
create index if not exists desir_push_outbox_global_pending on public.desir_push_outbox(created_at,id) where delivered_at is null and attempts<8;

create or replace function public.desir_configure_push_scheduler(p_endpoint_url text,p_cron_token text,p_publishable_key text default '')
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  insert into public.desir_push_scheduler_config(id,endpoint_url,cron_token,publishable_key)
  values(1,p_endpoint_url,p_cron_token,p_publishable_key)
  on conflict(id) do update set endpoint_url=excluded.endpoint_url,cron_token=excluded.cron_token,publishable_key=excluded.publishable_key,updated_at=now();
  return true;
end;
$$;

create or replace function public.desir_draw_ready_for_state(p_state jsonb,p_actor text)
returns boolean language sql immutable security invoker set search_path='' as $$
  select p_actor in ('a','b') and (
    (p_state->>'phase'='category' and p_state->'round'->>'from'=p_actor)
    or (p_state->>'phase' in ('accepted','resolved') and p_state->'round'->>'from' in ('a','b')
      and p_state->'round'->>'from'<>p_actor and coalesce((p_state->>'sequence')::numeric,0)<9007199254740991)
  );
$$;

create or replace function public.desir_due_task_reminders(p_state jsonb,p_actor text,p_at timestamptz default now())
returns table(task_id text,expires_at timestamptz) language sql stable security invoker set search_path='' as $$
  select task->>'id',(task->>'expiresAt')::timestamptz
  from jsonb_array_elements(coalesce(p_state->'tasks','[]'::jsonb)) task
  where p_actor in ('a','b') and task->'checks'->>p_actor='false'
    and (task->>'expiresAt')::timestamptz>p_at
    and (task->>'expiresAt')::timestamptz<=p_at+interval '2 hours';
$$;

create or replace function public.desir_push_draw_ready(p_room_id uuid,p_actor text,p_window_key text default null)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(
    select 1 from public.desir_rooms r join public.desir_accounts a on a.room_id=r.id and a.actor=p_actor and a.disabled_at is null
    where r.id=p_room_id and public.desir_draw_ready_for_state(r.state,p_actor)
      and (p_window_key is null or p_window_key=public.desir_quota_window(now())->>'window')
      and not exists(select 1 from public.desir_draw_usage u where u.room_id=r.id and u.actor=p_actor and u.window_key=public.desir_quota_window(now())->>'window')
  );
$$;

create or replace function public.desir_enqueue_scheduled_push(p_at timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account record;
  reminder record;
  quota jsonb:=public.desir_quota_window(p_at);
  added integer;
  draw_count integer:=0;
  reminder_count integer:=0;
begin
  for account in select a.actor,a.room_id,r.state,r.revision from public.desir_accounts a join public.desir_rooms r on r.id=a.room_id where a.disabled_at is null
  loop
    if public.desir_draw_ready_for_state(account.state,account.actor) and not exists(
      select 1 from public.desir_draw_usage u where u.room_id=account.room_id and u.actor=account.actor and u.window_key=quota->>'window'
    ) then
      insert into public.desir_push_outbox(room_id,target_actor,kind,revision,dedupe_key,window_key,expires_at)
      values(account.room_id,account.actor,'draw-available',account.revision,'window:'||(quota->>'window'),quota->>'window',(quota->>'nextAt')::timestamptz) on conflict do nothing;
      get diagnostics added=row_count;draw_count:=draw_count+added;
    end if;
    for reminder in select * from public.desir_due_task_reminders(account.state,account.actor,p_at)
    loop
      insert into public.desir_push_outbox(room_id,target_actor,kind,revision,dedupe_key,task_id,expires_at)
      values(account.room_id,account.actor,'task-reminder',account.revision,'task:'||reminder.task_id,reminder.task_id,reminder.expires_at) on conflict do nothing;
      get diagnostics added=row_count;reminder_count:=reminder_count+added;
    end loop;
  end loop;
  return jsonb_build_object('drawAvailable',draw_count,'taskReminders',reminder_count);
end;
$$;

-- Expired reminders and superseded draw windows never enter the delivery worker.
create or replace function public.desir_claim_push_outbox(p_room_id uuid default null,p_limit integer default 10)
returns setof public.desir_push_outbox language plpgsql security invoker set search_path='' as $$
begin
  update public.desir_push_outbox set delivered_at=now(),lease_until=null
  where delivered_at is null and (created_at<now()-interval '24 hours' or expires_at<=now()) and (p_room_id is null or room_id=p_room_id);
  return query with selected as (
    select id from public.desir_push_outbox
    where delivered_at is null and attempts<8 and (lease_until is null or lease_until<=now()) and (expires_at is null or expires_at>now())
      and (p_room_id is null or room_id=p_room_id)
    order by created_at,id limit greatest(1,least(p_limit,10)) for update skip locked
  )
  update public.desir_push_outbox outbox set attempts=outbox.attempts+1,lease_until=now()+interval '2 minutes'
  from selected where outbox.id=selected.id returning outbox.*;
end;
$$;

revoke all on function public.desir_configure_push_scheduler(text,text,text),public.desir_draw_ready_for_state(jsonb,text),public.desir_due_task_reminders(jsonb,text,timestamptz),public.desir_push_draw_ready(uuid,text,text),public.desir_enqueue_scheduled_push(timestamptz) from public,anon,authenticated;
grant execute on function public.desir_configure_push_scheduler(text,text,text),public.desir_draw_ready_for_state(jsonb,text),public.desir_due_task_reminders(jsonb,text,timestamptz),public.desir_push_draw_ready(uuid,text,text),public.desir_enqueue_scheduled_push(timestamptz) to service_role;

-- This sole privileged routine is private and can only be run by the cron owner.
-- No service-role credential appears in the routine or the cron command.
create or replace function desir_internal.tick()
returns bigint language plpgsql security definer set search_path='' as $$
declare config public.desir_push_scheduler_config%rowtype;request_id bigint;
begin
  select * into config from public.desir_push_scheduler_config where id=1;
  if not found then return null;end if;
  select net.http_post(
    url:=config.endpoint_url,
    headers:=jsonb_build_object('Content-Type','application/json','X-Desir-Cron',config.cron_token)
      ||case when config.publishable_key<>'' then jsonb_build_object('apikey',config.publishable_key) else '{}'::jsonb end,
    body:='{"op":"drain_push"}'::jsonb,
    timeout_milliseconds:=10000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function desir_internal.tick() from public,anon,authenticated,service_role;
grant execute on function desir_internal.tick() to postgres;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
select cron.schedule('desir-push-minute','* * * * *','select desir_internal.tick();');
