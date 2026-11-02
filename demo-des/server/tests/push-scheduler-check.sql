-- Run after all three schemas. Every fixture, account move and outbox row rolls back.
begin;
do $$
declare
  fixture_room uuid:=gen_random_uuid();
  at_time timestamptz:='2030-03-31T04:00:00Z'; -- 6 h Paris, spring DST transition.
  state_value jsonb;
  result jsonb;
  count_value integer;
  token_old text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  token_new text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  token_other text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  subscription_value jsonb;
  rejected boolean:=false;
begin
  if public.desir_quota_window('2027-03-28T03:59:59Z')->>'window'<>'2027-03-27T18:00'
    or public.desir_quota_window('2027-03-28T04:00:00Z')->>'window'<>'2027-03-28T06:00'
    or public.desir_quota_window('2027-10-31T04:59:59Z')->>'window'<>'2027-10-30T18:00'
    or public.desir_quota_window('2027-10-31T05:00:00Z')->>'window'<>'2027-10-31T06:00'
    or public.desir_quota_window('2027-03-27T17:00:00Z')->>'nextAt'<>'2027-03-28T04:00:00.000Z'
    or public.desir_quota_window('2027-10-30T16:00:00Z')->>'nextAt'<>'2027-10-31T05:00:00.000Z'
  then raise exception 'Paris quota DST boundary failed';end if;
  if public.desir_draw_ready_for_state('{"phase":"category","round":{"from":"a"}}','a') is not true
    or public.desir_draw_ready_for_state('{"phase":"category","round":{"from":"a"}}','b') is not false
    or public.desir_draw_ready_for_state('{"phase":"pending","round":{"from":"a"}}','b') is not false
    or public.desir_draw_ready_for_state('{"phase":"accepted","round":{"from":"a"},"sequence":1}','b') is not true
    or public.desir_draw_ready_for_state('{"phase":"accepted","round":{"from":"a"},"sequence":1}','a') is not false
    or public.desir_draw_ready_for_state('{"phase":"resolved","round":{"from":"a"},"sequence":9007199254740991}','b') is not false
  then raise exception 'Draw readiness disagrees with turn engine';end if;
  state_value:=jsonb_build_object('phase','accepted','sequence',1,'round',jsonb_build_object('from','a'),
    'tasks',jsonb_build_array(
      jsonb_build_object('id','onde-1','expiresAt',at_time+interval '2 hours','checks',jsonb_build_object('a',false,'b',false)),
      jsonb_build_object('id','onde-2','expiresAt',at_time+interval '90 minutes','checks',jsonb_build_object('a',true,'b',false)),
      jsonb_build_object('id','onde-3','expiresAt',at_time+interval '3 hours','checks',jsonb_build_object('a',false,'b',false)),
      jsonb_build_object('id','onde-4','expiresAt',at_time,'checks',jsonb_build_object('a',false,'b',false))));
  select count(*) into count_value from public.desir_due_task_reminders(state_value,'a',at_time);
  if count_value<>1 then raise exception 'Checked/expired/not-yet-due reminder filter failed';end if;
  insert into public.desir_rooms(id,state,revision) values(fixture_room,state_value,1);
  insert into public.desir_accounts(actor,room_id,login_normalized,display_name,password_hash)
    values('a',fixture_room,'push-fixture-a-'||fixture_room,'Fixture A','$2b$12$'||repeat('.',53)),
      ('b',fixture_room,'push-fixture-b-'||fixture_room,'Fixture B','$2b$12$'||repeat('.',53))
    on conflict(actor) do update set room_id=excluded.room_id,disabled_at=null;
  result:=public.desir_enqueue_scheduled_push(at_time);
  if (result->>'drawAvailable')::int<>1 or (result->>'taskReminders')::int<>3 then raise exception 'Due event enqueue failed: %',result;end if;
  result:=public.desir_enqueue_scheduled_push(at_time+interval '1 minute');
  if (result->>'drawAvailable')::int<>0 or (result->>'taskReminders')::int<>0 then raise exception 'Scheduler produced duplicate events';end if;
  select count(*) into count_value from public.desir_push_outbox where room_id=fixture_room and kind='task-reminder' and target_actor='b';
  if count_value<>2 then raise exception 'Multiple task reminders collided at same room revision';end if;
  -- A quota spent by a real D6 cannot yield a reminder on the next scheduler tick.
  delete from public.desir_push_outbox where room_id=fixture_room and kind='draw-available';
  insert into public.desir_draw_usage(room_id,actor,window_key) values(fixture_room,'b',public.desir_quota_window(at_time)->>'window');
  result:=public.desir_enqueue_scheduled_push(at_time+interval '2 minutes');
  if (result->>'drawAvailable')::int<>0 then raise exception 'Spent D6 quota was announced';end if;
  update public.desir_rooms set state=jsonb_set(state,'{phase}','"pending"') where id=fixture_room;
  delete from public.desir_draw_usage where room_id=fixture_room;
  result:=public.desir_enqueue_scheduled_push(at_time+interval '3 minutes');
  if (result->>'drawAvailable')::int<>0 then raise exception 'Blocked turn was announced';end if;
  -- Reconnection may move a browser subscription within the same account;
  -- an active different account cannot claim its endpoint.
  insert into public.desir_devices(token_hash,room_id,actor) values(token_old,fixture_room,'a'),(token_new,fixture_room,'a'),(token_other,fixture_room,'b');
  subscription_value:=jsonb_build_object('endpoint','https://web.push.apple.com/Qfixture-'||fixture_room,'keys',jsonb_build_object('auth','fixture','p256dh','fixture'));
  perform public.desir_save_push_subscription(token_old,subscription_value);
  perform public.desir_save_push_subscription(token_new,subscription_value);
  if (select token_hash from public.desir_push_subscriptions where endpoint=subscription_value->>'endpoint')<>token_new then raise exception 'Reconnection did not restore browser subscription';end if;
  begin
    perform public.desir_save_push_subscription(token_other,subscription_value);
  exception when others then
    if sqlerrm='Subscription belongs to another device' then rejected:=true;else raise;end if;
  end;
  if not rejected then raise exception 'Another active account claimed browser subscription';end if;
  update public.desir_devices set revoked_at=now() where token_hash=token_new;
  perform public.desir_save_push_subscription(token_other,subscription_value);
  if (select actor from public.desir_push_subscriptions where endpoint=subscription_value->>'endpoint')<>'b' then raise exception 'Logout did not release browser subscription';end if;
  if has_table_privilege('anon','public.desir_push_scheduler_config','select')
    or has_table_privilege('authenticated','public.desir_push_config','select')
    or has_function_privilege('anon','public.desir_enqueue_scheduled_push(timestamptz)','execute')
    or has_function_privilege('authenticated','public.desir_configure_push_scheduler(text,text,text)','execute')
    or has_function_privilege('service_role','desir_internal.tick()','execute')
  then raise exception 'Push scheduler private permission boundary failed';end if;
end $$;
rollback;
select 'Dés·ir push scheduler: DST, eligible D6, spent quota, due reminders, per-task deduplication and private ACL checks passed (all fixtures rolled back).' as result;
