-- All fixture writes are rolled back. Existing cards, discoveries and logs stay intact.
begin;
do $test$
declare day_at timestamptz:='2026-11-08 12:00 Europe/Paris'; result jsonb; first_count bigint; cards_before bigint;
begin
  assert public.tcg_birthday_multiplier('AG','2026-11-07 23:59:59 Europe/Paris')=1;
  assert public.tcg_birthday_multiplier('AG','2026-11-08 00:00 Europe/Paris')=2;
  assert public.tcg_birthday_multiplier('AG','2026-11-08 23:59:59 Europe/Paris')=2;
  assert public.tcg_birthday_multiplier('AG','2026-11-09 00:00 Europe/Paris')=1;
  assert public.tcg_birthday_multiplier('CL',day_at)=1;
  assert public.tcg_challenge_finish('AG',day_at,.0075)='legendary';
  assert public.tcg_challenge_finish('CL',day_at,.0075)='full_art_foil';
  assert public.tcg_challenge_finish('AG',day_at,.0075,false)='full_art_foil';
  select jsonb_object_agg(f,n) into result from (
    select public.tcg_challenge_finish('AG',day_at,(i+.5)/100000.0) f,count(*) n from generate_series(0,99999) i group by f
  ) distribution;
  assert result='{"legendary":1000,"full_art_foil":4000,"foil":16000,"full_art":40000,"standard":39000}'::jsonb,'birthday finish distribution';
  assert (select count(*)=0 from public.tcg_birthday_booster_window('2026-11-07 23:59:59 Europe/Paris'));
  assert (select count(*)=1 from public.tcg_birthday_booster_window(day_at));
  assert (select count(*)=1 from public.tcg_birthday_booster_window('2026-11-09 23:59:59 Europe/Paris'));
  assert (select count(*)=0 from public.tcg_birthday_booster_window('2026-11-10 00:00 Europe/Paris'));
  select count(*) into cards_before from public.tcg_cards;
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select owner_role,null,bonus_key,available_at,expires_at from public.tcg_birthday_booster_window(day_at)
  on conflict(owner_role,bonus_key) where bonus_key is not null do nothing;
  select count(*) into first_count from public.tcg_boosters where bonus_key='birthday-mamamouth-2026-11-08';
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select owner_role,null,bonus_key,available_at,expires_at from public.tcg_birthday_booster_window(day_at)
  on conflict(owner_role,bonus_key) where bonus_key is not null do nothing;
  assert first_count=1 and (select count(*)=1 from public.tcg_boosters where bonus_key='birthday-mamamouth-2026-11-08');
  assert not exists(select 1 from public.tcg_boosters where bonus_key='birthday-mamamouth-2026-11-08' and (owner_role<>'AG' or release_date is not null));
  assert cards_before=(select count(*) from public.tcg_cards),'no draw';
  assert not has_function_privilege('anon','public.tcg_challenge_finish(text,timestamptz,double precision,boolean)','execute');
end;
$test$;
rollback;
