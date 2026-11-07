-- The daily pool allowed three draws but the original primary key still
-- allowed only one row per (room, actor, window). A second INSERT failed with
-- 23505, leaving a durable client action stuck in its retry queue.
-- Retain that key and the first-use timestamp. Existing rows consumed one
-- draw, including historical hourly windows, and therefore start at 1.
alter table public.desir_draw_usage
  add column draw_count smallint not null default 1
  constraint desir_draw_usage_draw_count_check check (draw_count between 1 and 3);

create or replace function public.desir_quota_status(p_room_id uuid,p_actor text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select w || jsonb_build_object('remaining',greatest(0,3-coalesce((select u.draw_count from public.desir_draw_usage u where u.room_id=p_room_id and u.actor=p_actor and u.window_key=w->>'window'),0)))
  from (select public.desir_quota_window(now()) as w) q
$$;

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
    -- Keep one row per actor/day. A retry replays its receipt before this
    -- guarded increment, so neither concurrent requests nor retries overspend.
    insert into public.desir_draw_usage as usage(room_id,actor,window_key,draw_count)
    values(p_room_id,p_actor,window_info->>'window',1)
    on conflict(room_id,actor,window_key) do update
      set draw_count=usage.draw_count+1 where usage.draw_count<3;
    if not found then return jsonb_build_object('kind','quota_exhausted');end if;
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

-- Keep the service-only boundary; no public Data API or session changes.
revoke all on function public.desir_quota_status(uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.desir_quota_status(uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb) to service_role;
