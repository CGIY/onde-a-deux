-- Per-player readiness and the exact action round for invitation notifications.

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

create or replace function public.desir_draw_ready_for_state(p_state jsonb,p_actor text)
returns boolean language sql immutable security invoker set search_path='' as $$
  select coalesce(p_actor in ('a','b') and case
    when p_state->>'version'='2' and jsonb_typeof(p_state->'lanes')='object' then
      p_state->'lanes'->p_actor->'round'->>'from'=p_actor and (
        p_state->'lanes'->p_actor->>'phase'='category'
        or (p_state->'lanes'->p_actor->>'phase' in ('accepted','resolved')
          and coalesce((p_state->>'sequence')::numeric,0)<9007199254740991)
      )
    else p_state->'round'->>'from' in ('a','b') and (
      p_state->>'phase'='category'
      or (p_state->>'phase' in ('accepted','resolved')
        and coalesce((p_state->>'sequence')::numeric,0)<9007199254740991)
    )
  end,false);
$$;
