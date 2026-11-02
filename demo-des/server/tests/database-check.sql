-- Run after schema.sql as the project owner. All fixture writes are rolled back.
begin;
do $$
declare
  fixture uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid();
  req2 uuid:=gen_random_uuid();
  state1 jsonb:='{"fixture":1}';
  state2 jsonb:='{"fixture":2}';
  result jsonb;
  actual_count integer;
  key text:='selftest:'||gen_random_uuid()::text;
begin
  if public.desir_quota_window('2026-11-02T04:59:59.000Z')->>'window'<>'2026-11-01T18:00' then raise exception 'Pre-six window mismatch';end if;
  if public.desir_quota_window('2026-11-02T05:00:00.000Z')->>'window'<>'2026-11-02T06:00' then raise exception 'Six boundary mismatch';end if;
  if public.desir_quota_window('2026-11-02T11:00:00.000Z')->>'window'<>'2026-11-02T12:00' then raise exception 'Noon boundary mismatch';end if;
  if public.desir_quota_window('2026-11-02T17:00:00.000Z')->>'window'<>'2026-11-02T18:00' then raise exception 'Evening boundary mismatch';end if;
  if public.desir_quota_window('2026-03-28T23:00:00.000Z')->>'nextAt'<>'2026-03-29T04:00:00.000Z' then raise exception 'Spring DST boundary mismatch';end if;
  if public.desir_quota_window('2026-10-24T23:30:00.000Z')->>'nextAt'<>'2026-10-25T05:00:00.000Z' then raise exception 'Autumn DST boundary mismatch';end if;
  if public.desir_quota_window('2027-01-01T00:00:00.000Z')->>'window'<>'2026-12-31T18:00' then raise exception 'Year boundary mismatch';end if;
  if not public.desir_rate_limit(key,1,60) or public.desir_rate_limit(key,1,60) then raise exception 'Atomic rate bucket mismatch';end if;
  insert into public.desir_rooms(id,state) values(fixture,state1);
  if (public.desir_quota_status(fixture,'a')->>'remaining')::integer<>1 then raise exception 'Fresh ticket missing';end if;
  result:=public.desir_commit(fixture,'a',req,repeat('a',64),0,state2,'{"fixture":"first"}',true,'{"actor":"b","kind":"invitation"}');
  if (public.desir_quota_status(fixture,'b')->>'remaining')::integer<>1 then raise exception 'One actor consumed the other ticket';end if;
  if result->>'kind'<>'applied' or (result->'response'->>'revision')::integer<>1 or (result->'response'->'quota'->>'remaining')::integer<>0 then raise exception 'Commit/ticket mismatch';end if;
  result:=public.desir_commit(fixture,'a',req,repeat('a',64),0,state1,'{"fixture":"wrong-retry"}',true,'{"actor":"b","kind":"invitation"}');
  if result->>'kind'<>'replayed' or result->'response'->>'fixture'<>'first' then raise exception 'Receipt replay mismatch';end if;
  result:=public.desir_commit(fixture,'a',req,repeat('b',64),1,state1,'{}',false,null);
  if result->>'kind'<>'mismatch' then raise exception 'Reused UUID accepted';end if;
  result:=public.desir_commit(fixture,'b',req2,repeat('a',64),0,state1,'{}',false,null);
  if result->>'kind'<>'conflict' then raise exception 'CAS conflict accepted';end if;
  result:=public.desir_commit(fixture,'a',req2,repeat('c',64),1,state1,'{}',true,null);
  if result->>'kind'<>'quota_exhausted' then raise exception 'Second D6 ticket accepted';end if;
  select count(*) into actual_count from public.desir_draw_usage where room_id=fixture;
  if actual_count<>1 then raise exception 'Duplicate ticket recorded';end if;
  select count(*) into actual_count from public.desir_push_outbox where room_id=fixture;
  if actual_count<>1 then raise exception 'Duplicate notification recorded';end if;
  if public.desir_expire_room(fixture,0,state1) then raise exception 'Stale expiration accepted';end if;
  if not public.desir_expire_room(fixture,1,state1) then raise exception 'Current expiration rejected';end if;
  if has_table_privilege('anon','public.desir_rooms','SELECT') or has_table_privilege('authenticated','public.desir_accounts','SELECT') then raise exception 'Client can read private tables';end if;
  if has_function_privilege('anon','public.desir_login(text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.desir_commit(uuid,text,uuid,text,bigint,jsonb,jsonb,boolean,jsonb)','EXECUTE') then raise exception 'Client can execute privileged RPC';end if;
end $$;
select 'Dés·ir database quota/DST/CAS/idempotency/ACL checks passed' as result;
rollback;
