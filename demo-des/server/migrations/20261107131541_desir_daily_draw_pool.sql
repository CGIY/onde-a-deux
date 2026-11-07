-- Three draws per Paris day, renewed at 5 h, instead of one per clock hour.
-- The window key becomes the Paris game day 'YYYY-MM-DD' (the calendar day
-- when local time is at or after 5 h, else the previous day), so past hourly
-- rows simply stop matching new keys and every player gets a fresh pool of
-- three tickets at the next 5 h renewal.
create or replace function public.desir_quota_window(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  local_at timestamp:=p_at at time zone 'Europe/Paris';
  day date;
  finish_at timestamp;
begin
  day:=local_at::date;
  if local_at::time<time '05:00' then day:=day-1;end if;
  finish_at:=(day+1)+time '05:00';
  return jsonb_build_object('window',to_char(day,'YYYY-MM-DD'),
    'label',case when day=local_at::date then 'Aujourd’hui' else 'Cette nuit' end,
    'nextAt',to_char((finish_at at time zone 'Europe/Paris') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create or replace function public.desir_quota_status(p_room_id uuid,p_actor text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select w || jsonb_build_object('remaining',greatest(0,3-(select count(*) from public.desir_draw_usage u where u.room_id=p_room_id and u.actor=p_actor and u.window_key=w->>'window'))::int)
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
    if (select count(*) from public.desir_draw_usage where room_id=p_room_id and actor=p_actor and window_key=window_info->>'window')>=3 then return jsonb_build_object('kind','quota_exhausted');end if;
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

revoke all on function public.desir_quota_window(timestamptz),public.desir_quota_status(uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.desir_quota_window(timestamptz),public.desir_quota_status(uuid,text),public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb) to service_role;
