-- Calendar-only helpers: private, deterministic for a supplied instant.
create or replace function public.tcg_birthday_multiplier(p_role text,p_now timestamptz)
returns double precision language sql stable set search_path='' as $fn$
  select case when p_role='AG' and p_now >= timestamptz '2026-11-08 00:00 Europe/Paris'
    and p_now < timestamptz '2026-11-09 00:00 Europe/Paris' then 2.0 else 1.0 end;
$fn$;
create or replace function public.tcg_challenge_finish(p_role text,p_now timestamptz,p_roll double precision,p_allow_legendary boolean default true)
returns text language sql stable set search_path='' as $fn$
  select case when p_roll < .005*m and p_allow_legendary then 'legendary'
    when p_roll < .025*m then 'full_art_foil'
    when p_roll < .105*m then 'foil'
    when p_roll < .305*m then 'full_art' else 'standard' end
  from (select public.tcg_birthday_multiplier(p_role,p_now) m) b;
$fn$;
create or replace function public.tcg_birthday_booster_window(p_now timestamptz)
returns table(owner_role text,bonus_key text,available_at timestamptz,expires_at timestamptz)
language sql stable set search_path='' as $fn$
  select 'AG'::text,'birthday-mamamouth-2026-11-08'::text,
    timestamptz '2026-11-08 00:00 Europe/Paris',timestamptz '2026-11-10 00:00 Europe/Paris'
  where p_now >= timestamptz '2026-11-08 00:00 Europe/Paris'
    and p_now < timestamptz '2026-11-10 00:00 Europe/Paris';
$fn$;
revoke all on function public.tcg_birthday_multiplier(text,timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_challenge_finish(text,timestamptz,double precision,boolean) from public,anon,authenticated;
revoke all on function public.tcg_birthday_booster_window(timestamptz) from public,anon,authenticated;

do $patch$
declare body text:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
begin
  if md5(body)<>'e2748d7fed5f25db67fcd4f88bd30af0' then raise exception 'tcg_api_changed_review_required'; end if;
  body:=replace(body,$part$        v_desired_finish := case
          when v_roll < 0.005 and booster.bonus_key is distinct from 'spells-legends-test-2026-10-25' then 'legendary'
          when v_roll < (0.005+0.02) then 'full_art_foil'
          when v_roll < (0.005+0.10) then 'foil'
          when v_roll < (0.005+0.30) then 'full_art'
          else 'standard'
        end;$part$,$part$        v_desired_finish := public.tcg_challenge_finish(v_role,now(),v_roll,
          booster.bonus_key is distinct from 'spells-legends-test-2026-10-25');$part$);
  body:=replace(body,$part$  if p_action = 'open_booster' then$part$,$part$  -- One birthday gift, additive to daily releases; its original 48h clock never moves.
  insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
  select w.owner_role,null,w.bonus_key,w.available_at,w.expires_at
  from public.tcg_birthday_booster_window(now()) w
  on conflict(owner_role,bonus_key) where bonus_key is not null do nothing;

  if p_action = 'open_booster' then$part$);
  body:=replace(body,$part$    'is_test', b.bonus_key='spells-legends-test-2026-10-25',$part$,$part$    'is_test', b.bonus_key='spells-legends-test-2026-10-25',
    'is_birthday',b.bonus_key='birthday-mamamouth-2026-11-08',$part$);
  body:=replace(body,$part$'legendary_chance',0.005)$part$,$part$'legendary_chance',0.005*public.tcg_birthday_multiplier(v_role,now()),'birthday_role','AG','birthday_multiplier',public.tcg_birthday_multiplier(v_role,now()))$part$);
  if position('tcg_challenge_finish(v_role,now(),v_roll' in body)=0 then raise exception 'birthday_patch_incomplete'; end if;
  execute body;
end;
$patch$;
