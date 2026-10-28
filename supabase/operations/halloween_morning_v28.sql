-- One morning only: preserve rarity and each reward's type, boost seasonal art.
create or replace function public.tcg_halloween_morning_pick(p_role text,p_current public.tcg_card_templates,p_excluded text[],p_kind text default 'classic') returns public.tcg_card_templates language plpgsql set search_path=public,pg_temp as $$
declare candidate public.tcg_card_templates%rowtype;
begin
 if p_current.card_type not in ('challenge','energy') or random()>=0.5 then return p_current; end if;
 select * into candidate from public.tcg_card_templates t
 where t.active and not t.demo and t.edition='halloween_2026' and t.card_type=p_current.card_type and t.finish_tier=p_current.finish_tier
 and (t.eligible_role is null or t.eligible_role=p_role)
 and (t.draw_from is null or (now()>=t.draw_from and now()<t.draw_until))
 and not(t.id=any(coalesce(p_excluded,array[]::text[])))
 and (p_kind='classic' or (p_kind='pleasure' and t.category='MISE À NUE') or (p_kind='relax' and t.category='POUR L''AUTRE' and (t.title ilike '%MASSAGE%' or t.title ilike '%SOIN%')))
 order by -ln(greatest(random(),0.000001))/case when t.palette='nude' then 0.8 else 1 end limit 1;
 if found then return candidate; end if;
 return p_current;
end;
$$;
revoke all on function public.tcg_halloween_morning_pick(text,public.tcg_card_templates,text[],text) from public,anon,authenticated;
DO $morning$
declare definition text;
begin
 definition:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
 if position('tcg_halloween_morning_pick' in definition)=0 then
  if position($old$      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;$old$ in definition)=0 then raise exception 'Opening changed; review morning integration'; end if;
  definition:=replace(definition,$old$      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;$old$,$new$      if not found then raise exception 'no_active_card'; end if;
      if booster.release_date=date '2026-10-28' or booster.bonus_key='halloween-morning-2026-10-28' then
        template_row:=public.tcg_halloween_morning_pick(v_role,template_row,v_drawn_template_ids,case when v_draw_index=4 then booster.booster_kind else 'classic' end);
      end if;
      v_finish := template_row.finish_tier;$new$);
  definition:=replace(definition,$old$'is_birthday',b.bonus_key=$old$,$new$'is_halloween_morning',(b.bonus_key='halloween-morning-2026-10-28' or b.release_date=date '2026-10-28'),
    'is_birthday',b.bonus_key=$new$);
 end if;
 execute definition;
end;
$morning$;
