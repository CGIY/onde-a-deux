begin;
select pg_advisory_xact_lock(hashtext('tcg:main'));
do $$
declare first_insert integer; second_insert integer; tomorrow date := (timezone('Europe/Paris',now())-interval '5 hours')::date+1;
begin
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select role,null,'qa-rollback-independent-bonus',now(),now()+interval '48 hours' from public.tcg_players where role in ('AG','CL')
  on conflict (owner_role,bonus_key) where bonus_key is not null do nothing;
  get diagnostics first_insert = row_count;
  if first_insert <> 2 then raise exception 'Expected two test-only gifts'; end if;
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select role,null,'qa-rollback-independent-bonus',now(),now()+interval '48 hours' from public.tcg_players where role in ('AG','CL')
  on conflict (owner_role,bonus_key) where bonus_key is not null do nothing;
  get diagnostics second_insert = row_count;
  if second_insert <> 0 then raise exception 'Gift idempotency failed'; end if;
  insert into public.tcg_boosters(owner_role,release_date,available_at,expires_at)
  select role,tomorrow,(tomorrow+time '05:00') at time zone 'Europe/Paris',((tomorrow+time '05:00') at time zone 'Europe/Paris')+interval '48 hours'
  from public.tcg_players where role in ('AG','CL') on conflict(owner_role,release_date) do nothing;
  if (select count(*) from public.tcg_boosters where release_date=tomorrow and bonus_key is null) <> 2 then raise exception 'Daily release uniqueness no longer works'; end if;
  if has_table_privilege('anon','public.tcg_boosters','insert') or has_table_privilege('anon','public.tcg_boosters','select') then raise exception 'Direct access accidentally exposed'; end if;
end;
$$;
select 'OK: un cadeau par profil et par campagne, répétition sans doublon, sortie quotidienne indépendante et droits inchangés. Tous les ajouts de test sont annulés.' as checks;
rollback;

