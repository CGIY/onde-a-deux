-- Advance Halloween; change only the unique launch gift's first two slots.
DO $launch$
declare definition text;
begin
 update public.tcg_card_templates set draw_from=timestamptz '2026-10-27 00:00:00 Europe/Paris' where edition='halloween_2026';
 definition:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
 definition:=replace(definition,'2026-10-29','2026-10-27');
 if position('halloween-launch-2026-10-27' in definition)=0 then
   if position($old$      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;$old$ in definition)=0 then raise exception 'Opening code changed; review required'; end if;
   definition:=replace(definition,$old$      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;$old$,$new$      if booster.bonus_key='halloween-launch-2026-10-27' and v_draw_index in (1,2) then
        select * into template_row from public.tcg_card_templates t
        where t.active and not t.demo and t.edition='halloween_2026'
          and (t.eligible_role is null or t.eligible_role=v_role)
          and t.card_type=case when v_draw_index=1 then 'energy' else 'challenge' end
          and t.finish_tier=case when v_draw_index=1 then 'standard'
            when v_role='CL' then 'standard' when v_desired_finish in ('full_art','foil') then v_desired_finish else 'standard' end
          and (v_role<>'CL' or v_draw_index<>2 or t.id='hw-nue-photo-horreur')
          and not (t.id=any(v_drawn_template_ids))
        order by -ln(greatest(random(),0.000001))/case when t.palette='nude' then 0.8 else 1 end limit 1;
      end if;
      if not found then raise exception 'no_active_card'; end if;
      v_finish := template_row.finish_tier;$new$);
 end if;
 execute definition;
end;
$launch$;
