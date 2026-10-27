select set_config('tcg.rebalance_before',jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x))::text,true);
-- Only rules change. No wallet, inventory, receipt or historical event is rewritten.
DO $rebalance$
declare definition text;
begin
 definition:=pg_get_functiondef('public.tcg_economy_action(text,text,jsonb)'::regprocedure);
 if position('recycle_incomplete_group' in definition)=0 then
  if position($old$    for c in select * from public.tcg_cards where id=any(ids) and owner_role=p_role for update loop
      v_price:=public.tcg_sale_price(c.finish,c.expires_at);$old$ in definition)=0 then raise exception 'Recycling implementation changed'; end if;
  definition:=replace(definition,$old$    for c in select * from public.tcg_cards where id=any(ids) and owner_role=p_role for update loop
      v_price:=public.tcg_sale_price(c.finish,c.expires_at);$old$,$new$    select count(*) into standard_count from public.tcg_cards where id=any(ids) and finish='standard';
    if standard_count%3<>0 then raise exception 'recycle_incomplete_group'; end if;
    energy_count:=0;
    for c in select * from public.tcg_cards where id=any(ids) and owner_role=p_role order by id for update loop
      if c.finish='standard' then energy_count:=energy_count+1; end if;
      v_price:=case when c.finish='standard' then case when energy_count%3=0 then 1 else 0 end
        else public.tcg_sale_price(c.finish,c.expires_at) end;$new$);
  definition:=replace(definition,$old$    v_price:=public.tcg_sale_price(c.finish,c.expires_at);
    update public.tcg_cards set status='destroyed'$old$,$new$    if c.finish='standard' then raise exception 'recycle_incomplete_group'; end if;
    v_price:=public.tcg_sale_price(c.finish,c.expires_at);
    update public.tcg_cards set status='destroyed'$new$);
 end if;
 definition:=replace(definition,'when v_kind=''classic'' then 12 else 15','when v_kind=''classic'' then 20 else 25');
 execute definition;
 definition:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
 definition:=replace(definition,'v_reward_amount:=case when v_roll<0.70 then 1 when v_roll<0.95 then 2 else 3 end;','v_reward_amount:=1;');
 execute definition;
 definition:=pg_get_functiondef('public.tcg_helper_action(text,text,jsonb)'::regprocedure);
 definition:=replace(definition,'when p_kind=''voleur'' then 8 else 15','when p_kind=''voleur'' then 8 when p_kind=''assassin'' then 25 else 18');
 execute definition;
end;
$rebalance$;
CREATE OR REPLACE FUNCTION public.tcg_sale_price(p_finish text,p_expires timestamptz,p_at timestamptz default now()) returns integer
language sql stable set search_path=public,pg_temp as $$
 select case when p_finish='standard' then 0 else greatest(1,ceil((case p_finish when 'foil' then 2 when 'full_art_foil' then 4 when 'legendary' then 7 else 1 end)::numeric
 * case when p_expires-p_at <= interval '24 hours' then 0.5 when p_expires-p_at <= interval '3 days' then 0.75 else 1 end)::integer) end;
$$;
revoke all on function public.tcg_sale_price(text,timestamptz,timestamptz) from public,anon,authenticated;

DO $preserve$ begin if current_setting('tcg.rebalance_before')::jsonb is distinct from jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x)) then raise exception 'Player state changed during rule update'; end if; end; $preserve$;
