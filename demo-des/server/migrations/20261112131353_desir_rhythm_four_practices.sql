-- Preserve the legacy aggregates for installed clients.
alter table public.desir_room_rhythm
  add column masturbation integer not null default 0
  check (masturbation between 0 and without_penetration);
grant update (masturbation) on public.desir_room_rhythm to service_role;

create or replace function public.desir_record_rhythm(p_token_hash text,p_request_id uuid,p_kind text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  session jsonb;
  rhythm public.desir_room_rhythm%rowtype;
begin
  if p_request_id is null or p_kind is null or p_kind not in ('penetration','no_penetration','anal','masturbation') then
    return jsonb_build_object('status','invalid');
  end if;
  session:=public.desir_get_session(p_token_hash);
  if session is null then return jsonb_build_object('status','unauthorized');end if;
  select * into rhythm from public.desir_room_rhythm r
  where r.room_id=(session->'member'->>'room_id')::uuid and r.editor_actor=session->'member'->>'actor'
  for update;
  if not found then return jsonb_build_object('status','forbidden');end if;

  insert into public.desir_rhythm_requests(room_id,request_id)
  values(rhythm.room_id,p_request_id) on conflict do nothing;
  if found then
    update public.desir_room_rhythm r set
      ended_on=greatest(r.ended_on,(now() at time zone 'Europe/Paris')::date),
      with_penetration=r.with_penetration+case when p_kind in ('penetration','anal') then 1 else 0 end,
      without_penetration=r.without_penetration+case when p_kind in ('no_penetration','masturbation') then 1 else 0 end,
      masturbation=r.masturbation+case when p_kind='masturbation' then 1 else 0 end,
      anal=r.anal+case when p_kind='anal' then 1 else 0 end
    where r.room_id=rhythm.room_id returning r.* into rhythm;
  end if;
  return jsonb_build_object('status','ok','rhythm',to_jsonb(rhythm)-'room_id'-'editor_actor');
end $$;
revoke all on function public.desir_record_rhythm(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.desir_record_rhythm(text,uuid,text) to service_role;
