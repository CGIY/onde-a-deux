select pg_advisory_xact_lock(hashtext('tcg:main'));
alter table public.tcg_boosters add column if not exists bonus_key text;
alter table public.tcg_boosters alter column release_date drop not null;
alter table public.tcg_boosters add constraint tcg_boosters_source_check
  check ((release_date is not null and bonus_key is null) or (release_date is null and bonus_key is not null));
create unique index tcg_boosters_bonus_once_idx on public.tcg_boosters(owner_role,bonus_key) where bonus_key is not null;
comment on column public.tcg_boosters.bonus_key is 'One-off additive gift key. NULL for daily boosters; never changes the daily release clock.';
notify pgrst, 'reload schema';

