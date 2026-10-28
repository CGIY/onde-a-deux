-- Explicitly requested one-time gift. Admin-only SQL; never called by the client.
begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare before_snapshot jsonb; after_snapshot jsonb; inserted_count integer;
begin
  select jsonb_build_object(
'cards',(select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from public.tcg_cards c),
'discoveries',(select md5(coalesce(string_agg(to_jsonb(d)::text,'' order by role,template_id),'')) from public.tcg_discoveries d),
'events',(select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by id),'')) from public.tcg_card_events e),
'receipts',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by booster_id),'')) from public.tcg_opening_receipts r),
'trades',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.tcg_trades t),
'existing_boosters',(select md5(coalesce(string_agg(to_jsonb(b)::text,'' order by id),'')) from public.tcg_boosters b where bonus_key is distinct from 'halloween-morning-2026-10-28'),
'next_daily_at',(((timezone('Europe/Paris',now())-interval '5 hours')::date+1+time '05:00') at time zone 'Europe/Paris')
) into before_snapshot;
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select role,null,'halloween-morning-2026-10-28',now(),now()+interval '48 hours'
  from public.tcg_players where role in ('AG','CL')
  on conflict (owner_role,bonus_key) where bonus_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  select jsonb_build_object(
'cards',(select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from public.tcg_cards c),
'discoveries',(select md5(coalesce(string_agg(to_jsonb(d)::text,'' order by role,template_id),'')) from public.tcg_discoveries d),
'events',(select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by id),'')) from public.tcg_card_events e),
'receipts',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by booster_id),'')) from public.tcg_opening_receipts r),
'trades',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.tcg_trades t),
'existing_boosters',(select md5(coalesce(string_agg(to_jsonb(b)::text,'' order by id),'')) from public.tcg_boosters b where bonus_key is distinct from 'halloween-morning-2026-10-28'),
'next_daily_at',(((timezone('Europe/Paris',now())-interval '5 hours')::date+1+time '05:00') at time zone 'Europe/Paris')
) into after_snapshot;
  if before_snapshot is distinct from after_snapshot then raise exception 'Existing saved state or daily schedule changed'; end if;
  if (select count(*) from public.tcg_boosters where bonus_key='halloween-morning-2026-10-28') <> 2 then raise exception 'Expected exactly one bonus for each player'; end if;
  perform set_config('tcg.bonus_report',jsonb_build_object(
    'inserted',inserted_count,'contents','One extra morning booster; compatible Halloween drops boosted; normal rarities','saved_data_unchanged',true,'daily_schedule_unchanged',true,
    'next_daily_utc',before_snapshot->'next_daily_at',
    'next_daily_paris',to_char(((before_snapshot->>'next_daily_at')::timestamptz at time zone 'Europe/Paris'),'YYYY-MM-DD HH24:MI'),
    'gifts',(select jsonb_agg(jsonb_build_object('role',owner_role,'id',id,'available_at',available_at,'expires_at',expires_at,'opened_at',opened_at) order by owner_role) from public.tcg_boosters where bonus_key='halloween-morning-2026-10-28')
  )::text,true);
end;
$$;
select current_setting('tcg.bonus_report')::jsonb as report;
commit;

