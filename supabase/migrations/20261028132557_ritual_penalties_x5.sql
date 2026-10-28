alter table public.tcg_economy_wallets
  drop constraint if exists tcg_economy_wallets_balance_check;
alter table public.tcg_economy_wallets
  add constraint tcg_economy_wallets_balance_check check (balance >= -50);

create or replace function public.tcg_economy_apply(
  p_role text,
  p_amount integer,
  p_type text,
  p_card uuid default null,
  p_detail jsonb default '{}'::jsonb
) returns integer
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  old_balance integer;
  new_balance integer;
  applied_amount integer;
begin
  select balance into old_balance
    from public.tcg_economy_wallets
    where role=p_role
    for update;
  if old_balance is null then
    raise exception 'wallet_unavailable';
  end if;
  applied_amount:=case
    when p_amount < 0 and p_type in ('ritual_passed','ritual_rejected','ritual_expired')
      then p_amount * 5
    else p_amount
  end;
  new_balance:=greatest(-50,old_balance+applied_amount);
  update public.tcg_economy_wallets
    set balance=new_balance,updated_at=now()
    where role=p_role;
  insert into public.tcg_economy_events(role,event_type,card_id,amount,balance_after,detail)
    values(p_role,p_type,p_card,new_balance-old_balance,new_balance,p_detail);
  return new_balance;
end;
$function$;