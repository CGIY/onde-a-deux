-- Rollback-only verification. Never persists a device, booster or game transition.
begin;
do $test$
declare snapshot jsonb; before_cards bigint; after_cards bigint; first_boosters bigint; token text := repeat('a',48);
begin
  assert (select count(*)=2 from public.tcg_daily_release_window('2026-10-26 05:00:00 Europe/Paris')),'daily window';
  assert (select count(*)=1 from public.tcg_daily_release_window('2026-10-26 04:59:59 Europe/Paris')),'before release';
  assert (select count(*)=3 from public.tcg_daily_release_window('2026-03-29 05:00:00 Europe/Paris')),'spring elapsed 48h';
  assert (select count(*)=2 from public.tcg_daily_release_window('2026-10-25 05:00:00 Europe/Paris')),'autumn elapsed 48h';
  assert not has_function_privilege('anon','public.tcg_daily_release_window(timestamptz)','execute'),'private helper';
  insert into public.tcg_player_devices(role,device_token_hash) values('AG',encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex')) on conflict do nothing;
  select count(*) into before_cards from public.tcg_cards;
  snapshot:=public.tcg_exchange('AG',token,null,'sync','{"history_limit":80}'::jsonb);
  assert snapshot->'my_cards' is not null and snapshot->'known_cards' is not null,'compatible snapshot';
  assert (snapshot->>'catalogue_total')::integer=100,'catalogue untouched';
  select count(*) into first_boosters from public.tcg_boosters;
  perform public.tcg_exchange('AG',token,null,'sync','{"history_limit":99999999999999999}'::jsonb);
  select count(*) into after_cards from public.tcg_cards;
  assert before_cards=after_cards,'sync never draws';
  assert first_boosters=(select count(*) from public.tcg_boosters),'daily releases idempotent';
end;
$test$;
rollback;
