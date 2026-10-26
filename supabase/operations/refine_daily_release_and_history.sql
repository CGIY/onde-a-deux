-- Pure schedule calculation: no inventory changes or new public API.
create or replace function public.tcg_daily_release_window(p_now timestamptz)
returns table(release_date date,available_at timestamptz,expires_at timestamptz)
language sql stable set search_path = '' as $function$
  select d.day, d.at, d.at + interval '48 hours'
  from (
    select ((p_now at time zone 'Europe/Paris' - interval '5 hours')::date - n) as day,
      (((p_now at time zone 'Europe/Paris' - interval '5 hours')::date - n) + time '05:00') at time zone 'Europe/Paris' as at
    from generate_series(0,2) n
  ) d where d.at <= p_now and d.at + interval '48 hours' > p_now;
$function$;
revoke all on function public.tcg_daily_release_window(timestamptz) from public,anon,authenticated;

do $patch$
declare body text := pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
begin
  if md5(body) <> 'd06f4a34c0ad5b8d6ab50c6b9be32bd5' then raise exception 'tcg_api_changed_review_required'; end if;
  body := replace(body,$old$  insert into public.tcg_boosters(owner_role, release_date, available_at, expires_at)
  select role, v_release_date, v_available_at, v_available_at + interval '48 hours'
  from public.tcg_players
  on conflict (owner_role, release_date) do nothing;$old$,$new$  insert into public.tcg_boosters(owner_role, release_date, available_at, expires_at)
  select p.role, d.release_date, d.available_at, d.expires_at
  from public.tcg_players p cross join public.tcg_daily_release_window(now()) d
  on conflict (owner_role, release_date) do nothing;$new$);
  body := replace(body,'  v_token_hash text;', '  v_history_limit integer := case when coalesce(p_payload->>''history_limit'','''') ~ ''^[0-9]{1,3}$'' then greatest(20,least(500,(p_payload->>''history_limit'')::integer)) else 40 end;' || chr(10) || '  v_token_hash text;');
  body := replace(body,'order by created_at desc limit 40','order by created_at desc limit v_history_limit');
  body := replace(body,'order by created_at desc,id desc limit 40','order by created_at desc,id desc limit v_history_limit');
  body := replace(body,'''created_at'',e.created_at,''title'',t.title,''finish'',c.finish','''created_at'',e.created_at,''title'',coalesce(chosen.title,t.title),''finish'',c.finish');
  body := replace(body,'''edition'',t.edition,''target_title'',target.title','''edition'',t.edition,''target_title'',coalesce(target_choice.title,target.title)');
  body := replace(body,'left join public.tcg_card_templates target on target.id=target_card.template_id', 'left join public.tcg_card_templates target on target.id=target_card.template_id' || chr(10) || '      left join public.tcg_card_templates chosen on chosen.id=c.selected_template_id' || chr(10) || '      left join public.tcg_card_templates target_choice on target_choice.id=target_card.selected_template_id');
  if position('tcg_daily_release_window(now())' in body)=0 or position('limit v_history_limit' in body)=0 then raise exception 'tcg_patch_incomplete'; end if;
  execute body;
end;
$patch$;
