select set_config('tcg.rebalance_before',jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x))::text,true);
-- Correct actor roles; existing balances and resolved history remain untouched.
CREATE OR REPLACE FUNCTION public.tcg_economy_tick()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c record; claim record;
begin
  for c in select x.id,x.owner_role,x.finish,t.category from public.tcg_cards x
    join public.tcg_card_templates t on t.id=x.template_id
    where x.status='activated' and x.active_until<=now() and x.economy_eligible
      and not exists(select 1 from public.tcg_ritual_claims r where r.card_id=x.id)
  loop
    insert into public.tcg_ritual_claims(card_id,owner_role,status,claimed_at,resolved_at)
      values(c.id,case when c.owner_role='AG' then 'CL' else 'AG' end,'expired',now(),now()) on conflict(card_id) do nothing;
    if found then
      perform public.tcg_economy_apply(case when c.owner_role='AG' then 'CL' else 'AG' end,-public.tcg_ritual_value(c.finish),'ritual_expired',c.id);
    end if;
  end loop;
  for claim in select r.card_id,case when owned.owner_role='AG' then 'CL' else 'AG' end as performer_role from public.tcg_ritual_claims r join public.tcg_cards owned on owned.id=r.card_id
    where r.status='pending' and r.claimed_at+interval '24 hours'<=now()
  loop
    update public.tcg_ritual_claims set status='unanswered',resolved_at=now() where card_id=claim.card_id and status='pending';
    if found then perform public.tcg_economy_apply(claim.performer_role,0,'ritual_unanswered',claim.card_id); end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tcg_economy_action(p_role text, p_action text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  c public.tcg_cards%rowtype;
  t public.tcg_card_templates%rowtype;
  claim public.tcg_ritual_claims%rowtype;
  other_role text:=case when p_role='AG' then 'CL' else 'AG' end;
  ids uuid[]; n integer; energy_count integer; standard_count integer; art_count integer; foil_count integer;
  category_count integer; card_type_count integer; v_finish text; v_type text; v_price integer;
  reward_id uuid; v_day date:=(timezone('Europe/Paris',now())-interval '5 hours')::date;
  v_week date:=date_trunc('week',timezone('Europe/Paris',now()))::date;
  v_kind text; v_cost integer;
begin
  if p_action in ('complete_card','ritual_pass') then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=other_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if c.id is null or c.status<>'activated' or c.active_until<=now() then raise exception 'card_unavailable'; end if;
    if exists(select 1 from public.tcg_ritual_claims where card_id=c.id) then raise exception 'ritual_already_claimed'; end if;
    select * into t from public.tcg_card_templates where id=c.template_id;
    if p_action='complete_card' then
      insert into public.tcg_ritual_claims(card_id,owner_role,status) values(c.id,p_role,'pending');
    else
      insert into public.tcg_ritual_claims(card_id,owner_role,status,resolved_at) values(c.id,p_role,'passed',now());
      update public.tcg_cards set status='used',consumed_at=now(),active_until=now() where id=c.id;
      perform public.tcg_economy_apply(p_role,case when not c.economy_eligible then 0 else -public.tcg_ritual_value(c.finish) end,'ritual_passed',c.id);
    end if;
  elsif p_action='ritual_review' then
    begin select * into claim from public.tcg_ritual_claims where card_id=(p_payload->>'card_id')::uuid for update;
    exception when invalid_text_representation then raise exception 'ritual_unavailable'; end;
    select * into c from public.tcg_cards where id=claim.card_id for update;
    if claim.card_id is null or c.owner_role<>p_role or claim.status<>'pending' or claim.claimed_at+interval '24 hours'<=now() then raise exception 'ritual_unavailable'; end if;
    if coalesce(p_payload->>'decision','') not in ('approve','reject') then raise exception 'invalid_request'; end if;
    select * into t from public.tcg_card_templates where id=c.template_id;
    v_price:=case when p_payload->>'decision'='approve' then public.tcg_ritual_value(c.finish)
      when not c.economy_eligible then 0 else -public.tcg_ritual_value(c.finish) end;
    update public.tcg_ritual_claims set status=case when v_price>0 then 'approved' else 'rejected' end,
      resolved_at=now(),amount=v_price where card_id=c.id;
    update public.tcg_cards set status='used',consumed_at=now(),active_until=now() where id=c.id and status='activated';
    if v_price>0 then insert into public.tcg_card_events(card_id,actor_role,event_type) values(c.id,other_role,'complete_card'); end if;
    perform public.tcg_economy_apply(other_role,v_price,case when v_price>0 then 'ritual_approved' else 'ritual_rejected' end,c.id);
  elsif p_action='sell_cards' then
    if jsonb_typeof(p_payload->'card_ids')<>'array' then raise exception 'invalid_request'; end if;
    begin select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_payload->'card_ids') x(value);
    exception when invalid_text_representation then raise exception 'invalid_request'; end;
    n:=coalesce(cardinality(ids),0);
    if n<2 or n>50 or n<>coalesce((select count(distinct x) from unnest(ids) x),0) then raise exception 'invalid_request'; end if;
    if (select count(*) from public.tcg_cards where id=any(ids) and owner_role=p_role and status='available' and expires_at>now())<>n then raise exception 'card_unavailable'; end if;
    select count(*) into standard_count from public.tcg_cards where id=any(ids) and finish='standard';
    if standard_count%3<>0 then raise exception 'recycle_incomplete_group'; end if;
    energy_count:=0;
    for c in select * from public.tcg_cards where id=any(ids) and owner_role=p_role order by id for update loop
      if c.finish='standard' then energy_count:=energy_count+1; end if;
      v_price:=case when c.finish='standard' then case when energy_count%3=0 then 1 else 0 end
        else public.tcg_sale_price(c.finish,c.expires_at) end;
      update public.tcg_cards set status='destroyed',consumed_at=now() where id=c.id;
      perform public.tcg_economy_apply(p_role,v_price,'card_sold',c.id);
    end loop;
  elsif p_action='sell_card' then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if c.id is null or c.status<>'available' or c.expires_at<=now() then raise exception 'card_unavailable'; end if;
    if c.finish='standard' then raise exception 'recycle_incomplete_group'; end if;
    v_price:=public.tcg_sale_price(c.finish,c.expires_at);
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=c.id;
    perform public.tcg_economy_apply(p_role,v_price,'card_sold',c.id);
  elsif p_action='buy_booster' then
    v_kind:=coalesce(p_payload->>'kind','classic');
    if v_kind not in ('classic','magician','pleasure','relax') then raise exception 'invalid_request'; end if;
    v_cost:=case when v_kind='classic' then 20 else 25 end;
    if (select count(*) from public.tcg_boosters where owner_role=p_role
      and (bonus_key='economy-'||v_week or bonus_key like 'economy-'||v_week||'-%'))>=3 then
      raise exception 'weekly_booster_used';
    end if;
    if (select balance from public.tcg_economy_wallets where role=p_role)<v_cost then raise exception 'not_enough_shards'; end if;
    insert into public.tcg_boosters(owner_role,release_date,bonus_key,booster_kind,available_at,expires_at)
      values(p_role,null,'economy-'||v_week||'-'||gen_random_uuid(),v_kind,now(),now()+interval '48 hours');
    perform public.tcg_economy_apply(p_role,-v_cost,'booster_bought',null,jsonb_build_object('kind',v_kind));
  elsif p_action='bank_exchange' then
    if exists(select 1 from public.tcg_bank_trades where owner_role=p_role and trade_date=v_day) then raise exception 'bank_used_today'; end if;
    if jsonb_typeof(p_payload->'card_ids')<>'array' then raise exception 'invalid_request'; end if;
    begin select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_payload->'card_ids') x(value);
    exception when invalid_text_representation then raise exception 'invalid_request'; end;
    n:=coalesce(cardinality(ids),0);
    if n<>coalesce((select count(distinct x) from unnest(ids) x),0) then raise exception 'invalid_request'; end if;
    if n not in (4,5,6,8,15) then raise exception 'invalid_request'; end if;
    if (select count(*) from public.tcg_cards where id=any(ids) and owner_role=p_role and status='available' and expires_at>now())<>n then raise exception 'card_unavailable'; end if;
    select count(*) filter(where template_row.card_type='energy'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='standard'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='full_art'),
      count(*) filter(where template_row.card_type='challenge' and owned_card.finish='foil')
      into energy_count,standard_count,art_count,foil_count
      from public.tcg_cards owned_card join public.tcg_card_templates template_row on template_row.id=owned_card.template_id where owned_card.id=any(ids);
    case p_payload->>'recipe'
      when 'draw' then
        if n<>5 or energy_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        if random()<0.10 then select * into t from public.tcg_pick_template(p_role,'joker','standard',array[]::text[]); end if;
        if t.id is null then
          v_finish:=public.tcg_challenge_finish(p_role,now(),random());
          select * into t from public.tcg_pick_template(p_role,'challenge_or_spell',v_finish,array[]::text[]);
        end if;
      when 'reforge' then
        if n<>4 or energy_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        select owned_card.* into c from public.tcg_cards owned_card where owned_card.id=any(ids) and owned_card.template_id not in
          (select id from public.tcg_card_templates where card_type='energy');
        select * into t from public.tcg_card_templates where id=c.template_id;
        select * into t from public.tcg_card_templates x where x.active and not x.demo and x.category=t.category
          and x.card_type=t.card_type and x.finish_tier=c.finish
          and (x.eligible_role is null or x.eligible_role=p_role)
          and (x.draw_from is null or (now()>=x.draw_from and now()<x.draw_until))
          order by -ln(greatest(random(),0.000000000001))/case when x.category='MISE À NUE' then 0.8 else 1 end limit 1;
      when 'common_to_art' then
        if n<>8 or energy_count<>3 or standard_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='full_art';
      when 'art_to_foil' then
        if n<>6 or energy_count<>3 or art_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='foil';
      when 'foil_to_artfoil' then
        if n<>6 or energy_count<>3 or foil_count<>3 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='full_art_foil';
      when 'legendary' then
        if n<>15 or energy_count<>5 or art_count<>5 or foil_count<>5 then raise exception 'bank_invalid_ingredients'; end if;
        v_finish:='legendary';
      else raise exception 'invalid_request';
    end case;
    if t.id is null then select * into t from public.tcg_pick_template(p_role,'challenge',v_finish,array[]::text[]); end if;
    if t.id is null then raise exception 'bank_no_offer'; end if;
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=any(ids);
    insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,acquired_at,expires_at)
      values(t.id,p_role,t.finish_tier,floor(random()*1000000)::integer,now(),now()+interval '7 days') returning id into reward_id;
    insert into public.tcg_discoveries(role,template_id) values(p_role,t.id)
      on conflict(role,template_id) do update set last_seen_at=now(),times_seen=public.tcg_discoveries.times_seen+1;
    insert into public.tcg_bank_trades(owner_role,trade_date,recipe,input_card_ids,reward_card_id)
      values(p_role,v_day,p_payload->>'recipe',ids,reward_id);
    perform public.tcg_economy_apply(p_role,0,'bank_exchange',reward_id,jsonb_build_object('recipe',p_payload->>'recipe','input_card_ids',ids));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tcg_economy_snapshot(p_role text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'balance',(select balance from public.tcg_economy_wallets where role=p_role),
    'bank_used_today',exists(select 1 from public.tcg_bank_trades where owner_role=p_role and trade_date=(timezone('Europe/Paris',now())-interval '5 hours')::date),
    'weekly_boosters_bought',(select count(*) from public.tcg_boosters where owner_role=p_role and (bonus_key='economy-'||date_trunc('week',timezone('Europe/Paris',now()))::date or bonus_key like 'economy-'||date_trunc('week',timezone('Europe/Paris',now()))::date||'-%')),
    'last_bank_trade',(select jsonb_build_object('id',b.id,'recipe',b.recipe,'reward_card_id',b.reward_card_id)
      from public.tcg_bank_trades b where b.owner_role=p_role order by b.created_at desc limit 1),
    'pending_reviews',(select coalesce(jsonb_agg(jsonb_build_object('card_id',r.card_id,'title',coalesce(chosen.title,t.title),
      'owner_role',case when c.owner_role='AG' then 'CL' else 'AG' end,'reviewer_role',c.owner_role,'finish',c.finish,'category',t.category,'claimed_at',r.claimed_at)
      order by r.claimed_at),'[]'::jsonb)
      from public.tcg_ritual_claims r join public.tcg_cards c on c.id=r.card_id
      join public.tcg_card_templates t on t.id=c.template_id
      left join public.tcg_card_templates chosen on chosen.id=c.selected_template_id
      where r.status='pending'),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'amount',e.amount,
      'balance_after',e.balance_after,'card_id',e.card_id,'detail',e.detail,'created_at',e.created_at)
      order by e.created_at desc),'[]'::jsonb)
      from (select * from public.tcg_economy_events where role=p_role order by created_at desc limit 40) e)
  );
$function$;
CREATE OR REPLACE FUNCTION public.tcg_push_on_ritual() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
declare card_owner text; performer text;
begin
 select owner_role into card_owner from public.tcg_cards where id=new.card_id;
 performer:=case when card_owner='AG' then 'CL' else 'AG' end;
 if new.status='pending' then
  perform public.tcg_push_notify(card_owner,'Les Cartes à deux','Un défi attend ta validation.','/cartes/');
 elsif new.status in ('approved','rejected') then
  perform public.tcg_push_notify(performer,'Les Cartes à deux',case when new.status='approved' then 'Défi validé ! Éclats versés.' else 'Défi non validé.' end,'/cartes/');
 end if;
 return new;
end;
$function$;
revoke all on function public.tcg_push_on_ritual() from public,anon,authenticated;
DO $pending$
declare definition text;
begin
 definition:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
 definition:=replace(definition,$old$where c.status = 'activated' and c.active_until > now();$old$,$new$where c.status = 'activated' and (c.active_until > now() or exists(select 1 from public.tcg_ritual_claims r where r.card_id=c.id and r.status='pending' and r.claimed_at+interval '24 hours'>now()));$new$);
 definition:=replace(definition,$old$where status = 'activated' and active_until <= now();$old$,$new$where status = 'activated' and active_until <= now() and not exists(select 1 from public.tcg_ritual_claims r where r.card_id=tcg_cards.id and r.status='pending' and r.claimed_at+interval '24 hours'>now());$new$);
 execute definition;
end;
$pending$;

DO $preserve$ begin if current_setting('tcg.rebalance_before')::jsonb is distinct from jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x)) then raise exception 'Player state changed during rule update'; end if; end; $preserve$;
