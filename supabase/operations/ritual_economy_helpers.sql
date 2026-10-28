-- Additive economy. Existing cards and timed rituals are not repriced retroactively.
alter table public.tcg_cards add column if not exists economy_eligible boolean not null default false;

create table if not exists public.tcg_economy_wallets (
  role text primary key references public.tcg_players(role),
  balance integer not null default 0 check (balance >= -50),
  updated_at timestamptz not null default now()
);
insert into public.tcg_economy_wallets(role) values ('AG'),('CL') on conflict(role) do nothing;
alter table public.tcg_economy_wallets enable row level security;
revoke all on public.tcg_economy_wallets from public,anon,authenticated;

create table if not exists public.tcg_ritual_claims (
  card_id uuid primary key references public.tcg_cards(id),
  owner_role text not null references public.tcg_players(role),
  status text not null check (status in ('pending','approved','rejected','passed','expired','unanswered')),
  claimed_at timestamptz not null default now(),
  resolved_at timestamptz,
  amount integer not null default 0
);
create index if not exists tcg_ritual_claims_owner_idx on public.tcg_ritual_claims(owner_role,status);
alter table public.tcg_ritual_claims enable row level security;
revoke all on public.tcg_ritual_claims from public,anon,authenticated;

create table if not exists public.tcg_economy_events (
  id uuid primary key default gen_random_uuid(),
  role text not null references public.tcg_players(role),
  event_type text not null,
  card_id uuid references public.tcg_cards(id),
  amount integer not null,
  balance_after integer not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tcg_economy_events_role_idx on public.tcg_economy_events(role,created_at desc);
create unique index if not exists tcg_economy_bonus_once_idx on public.tcg_economy_events(role,event_type)
  where event_type='launch_bonus';
alter table public.tcg_economy_events enable row level security;
revoke all on public.tcg_economy_events from public,anon,authenticated;

-- Exactly one launch gift per real profile, without changing any old save.
with locked as (select role,balance from public.tcg_economy_wallets for update),
granted as (
  insert into public.tcg_economy_events(role,event_type,amount,balance_after)
  select role,'launch_bonus',6,balance+6 from locked
  on conflict(role,event_type) where event_type='launch_bonus' do nothing
  returning role
)
update public.tcg_economy_wallets w set balance=w.balance+6,updated_at=now()
from granted g where w.role=g.role;

create table if not exists public.tcg_bank_trades (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null references public.tcg_players(role),
  trade_date date not null,
  recipe text not null,
  input_card_ids uuid[] not null,
  reward_card_id uuid not null references public.tcg_cards(id),
  created_at timestamptz not null default now(),
  unique(owner_role,trade_date)
);
alter table public.tcg_bank_trades enable row level security;
revoke all on public.tcg_bank_trades from public,anon,authenticated;

create or replace function public.tcg_ritual_value(p_finish text) returns integer
language sql immutable set search_path=public,pg_temp as $$
  select case p_finish when 'full_art' then 2 when 'foil' then 3 when 'full_art_foil' then 6 when 'legendary' then 10 else 1 end;
$$;
create or replace function public.tcg_sale_price(p_finish text,p_expires timestamptz,p_at timestamptz default now()) returns integer
language sql stable set search_path=public,pg_temp as $$
  select greatest(1,ceil((case p_finish when 'foil' then 2 when 'full_art_foil' then 4 when 'legendary' then 7 else 1 end)::numeric
    * case when p_expires-p_at <= interval '24 hours' then 0.5 when p_expires-p_at <= interval '3 days' then 0.75 else 1 end)::integer);
$$;
create or replace function public.tcg_economy_apply(p_role text,p_amount integer,p_type text,p_card uuid default null,p_detail jsonb default '{}'::jsonb)
returns integer language plpgsql set search_path=public,pg_temp as $
declare old_balance integer; new_balance integer; applied_amount integer;
begin
  select balance into old_balance from public.tcg_economy_wallets where role=p_role for update;
  if old_balance is null then raise exception 'wallet_unavailable'; end if;
  applied_amount:=case
    when p_amount < 0 and p_type in ('ritual_passed','ritual_rejected','ritual_expired') then p_amount*5
    else p_amount
  end;
  new_balance:=greatest(-50,old_balance+applied_amount);
  update public.tcg_economy_wallets set balance=new_balance,updated_at=now() where role=p_role;
  insert into public.tcg_economy_events(role,event_type,card_id,amount,balance_after,detail)
    values(p_role,p_type,p_card,new_balance-old_balance,new_balance,p_detail);
  return new_balance;
end;
$;
create or replace function public.tcg_economy_tick() returns void
language plpgsql set search_path=public,pg_temp as $$
declare c record; claim record;
begin
  for c in select x.id,x.owner_role,x.finish,t.category from public.tcg_cards x
    join public.tcg_card_templates t on t.id=x.template_id
    where x.status='activated' and x.active_until<=now() and x.economy_eligible
      and not exists(select 1 from public.tcg_ritual_claims r where r.card_id=x.id)
  loop
    insert into public.tcg_ritual_claims(card_id,owner_role,status,claimed_at,resolved_at)
      values(c.id,c.owner_role,'expired',now(),now()) on conflict(card_id) do nothing;
    if found then
      perform public.tcg_economy_apply(c.owner_role,-public.tcg_ritual_value(c.finish),'ritual_expired',c.id);
    end if;
  end loop;
  for claim in select card_id,owner_role from public.tcg_ritual_claims
    where status='pending' and claimed_at+interval '24 hours'<=now()
  loop
    update public.tcg_ritual_claims set status='unanswered',resolved_at=now() where card_id=claim.card_id and status='pending';
    if found then perform public.tcg_economy_apply(claim.owner_role,0,'ritual_unanswered',claim.card_id); end if;
  end loop;
end;
$$;

create or replace function public.tcg_economy_action(p_role text,p_action text,p_payload jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
  c public.tcg_cards%rowtype;
  t public.tcg_card_templates%rowtype;
  claim public.tcg_ritual_claims%rowtype;
  other_role text:=case when p_role='AG' then 'CL' else 'AG' end;
  ids uuid[]; n integer; energy_count integer; standard_count integer; art_count integer; foil_count integer;
  category_count integer; card_type_count integer; v_finish text; v_type text; v_price integer;
  reward_id uuid; v_day date:=(timezone('Europe/Paris',now())-interval '5 hours')::date;
  v_week date:=date_trunc('week',timezone('Europe/Paris',now()))::date;
begin
  if p_action in ('complete_card','ritual_pass') then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
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
    if claim.card_id is null or claim.owner_role<>other_role or claim.status<>'pending' or claim.claimed_at+interval '24 hours'<=now() then raise exception 'ritual_unavailable'; end if;
    if coalesce(p_payload->>'decision','') not in ('approve','reject') then raise exception 'invalid_request'; end if;
    select * into c from public.tcg_cards where id=claim.card_id for update;
    select * into t from public.tcg_card_templates where id=c.template_id;
    v_price:=case when p_payload->>'decision'='approve' then public.tcg_ritual_value(c.finish)
      when not c.economy_eligible then 0 else -public.tcg_ritual_value(c.finish) end;
    update public.tcg_ritual_claims set status=case when v_price>0 then 'approved' else 'rejected' end,
      resolved_at=now(),amount=v_price where card_id=c.id;
    update public.tcg_cards set status='used',consumed_at=now(),active_until=now() where id=c.id and status='activated';
    if v_price>0 then insert into public.tcg_card_events(card_id,actor_role,event_type) values(c.id,claim.owner_role,'complete_card'); end if;
    perform public.tcg_economy_apply(claim.owner_role,v_price,case when v_price>0 then 'ritual_approved' else 'ritual_rejected' end,c.id);
  elsif p_action='sell_card' then
    begin select * into c from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if c.id is null or c.status<>'available' or c.expires_at<=now() then raise exception 'card_unavailable'; end if;
    v_price:=public.tcg_sale_price(c.finish,c.expires_at);
    update public.tcg_cards set status='destroyed',consumed_at=now() where id=c.id;
    perform public.tcg_economy_apply(p_role,v_price,'card_sold',c.id);
  elsif p_action='buy_booster' then
    if exists(select 1 from public.tcg_boosters where owner_role=p_role and bonus_key='economy-'||v_week) then raise exception 'weekly_booster_used'; end if;
    if (select balance from public.tcg_economy_wallets where role=p_role)<12 then raise exception 'not_enough_shards'; end if;
    insert into public.tcg_boosters(owner_role,release_date,bonus_key,available_at,expires_at)
      values(p_role,null,'economy-'||v_week,now(),now()+interval '48 hours');
    perform public.tcg_economy_apply(p_role,-12,'booster_bought');
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
$$;

create or replace function public.tcg_economy_snapshot(p_role text) returns jsonb
language sql stable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'balance',(select balance from public.tcg_economy_wallets where role=p_role),
    'bank_used_today',exists(select 1 from public.tcg_bank_trades where owner_role=p_role and trade_date=(timezone('Europe/Paris',now())-interval '5 hours')::date),
    'weekly_booster_used',exists(select 1 from public.tcg_boosters where owner_role=p_role and bonus_key='economy-'||date_trunc('week',timezone('Europe/Paris',now()))::date),
    'last_bank_trade',(select jsonb_build_object('id',b.id,'recipe',b.recipe,'reward_card_id',b.reward_card_id)
      from public.tcg_bank_trades b where b.owner_role=p_role order by b.created_at desc limit 1),
    'pending_reviews',(select coalesce(jsonb_agg(jsonb_build_object('card_id',r.card_id,'title',coalesce(chosen.title,t.title),
      'owner_role',r.owner_role,'finish',c.finish,'category',t.category,'claimed_at',r.claimed_at)
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
$$;

revoke all on function public.tcg_ritual_value(text) from public,anon,authenticated;
revoke all on function public.tcg_sale_price(text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.tcg_economy_apply(text,integer,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.tcg_economy_tick() from public,anon,authenticated;
revoke all on function public.tcg_economy_action(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.tcg_economy_snapshot(text) from public,anon,authenticated;
