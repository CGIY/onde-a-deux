CREATE OR REPLACE FUNCTION public.tcg_helper_action(p_role text, p_kind text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  victim public.tcg_cards%rowtype;
  saved public.tcg_cards%rowtype;
  other_role text:=case when p_role='AG' then 'CL' else 'AG' end;
  v_cost integer;
  v_amount integer;
  v_title text;
  v_target_balance integer;
begin
  if p_kind not in ('assassin','druide','voleur') then raise exception 'invalid_request'; end if;
  v_cost:=case when p_kind='voleur' then 8 else 15 end;
  if (select balance from public.tcg_economy_wallets where role=p_role)<v_cost then raise exception 'not_enough_shards'; end if;
  if p_kind='assassin' then
    select * into victim from public.tcg_cards
      where owner_role=other_role and status='available' and expires_at>now()
      order by random() limit 1;
    if victim.id is null then raise exception 'no_active_card'; end if;
    select title into v_title from public.tcg_card_templates where id=victim.template_id;
    update public.tcg_cards set status='destroyed',consumed_at=now(),is_pinned=false where id=victim.id;
    perform public.tcg_economy_apply(p_role,-v_cost,'helper_assassin',victim.id,jsonb_build_object('kind','assassin','title',v_title));
    perform public.tcg_economy_apply(other_role,0,'helper_assassin',victim.id,jsonb_build_object('kind','assassin','title',v_title));
    perform public.tcg_push_notify(other_role,'Un Assassin est passé','« '||v_title||' » a été détruite de ta main.','./');
  elsif p_kind='druide' then
    begin select * into saved from public.tcg_cards where id=(p_payload->>'card_id')::uuid and owner_role=p_role for update;
    exception when invalid_text_representation then raise exception 'card_unavailable'; end;
    if saved.id is null or saved.status<>'available' or saved.expires_at<=now() then raise exception 'card_unavailable'; end if;
    select title into v_title from public.tcg_card_templates where id=saved.template_id;
    update public.tcg_cards set acquired_at=now(),expires_at=now()+interval '7 days' where id=saved.id;
    perform public.tcg_economy_apply(p_role,-v_cost,'helper_druide',saved.id,jsonb_build_object('kind','druide','title',v_title));
  else
    select balance into v_target_balance from public.tcg_economy_wallets where role=other_role for update;
    v_amount:=least((1+floor(random()*10))::integer,greatest(0,v_target_balance+12));
    if v_amount=0 then raise exception 'nothing_to_steal'; end if;
    perform public.tcg_economy_apply(p_role,v_amount-v_cost,'helper_voleur',null,jsonb_build_object('kind','voleur','stolen',v_amount,'cost',v_cost));
    perform public.tcg_economy_apply(other_role,-v_amount,'helper_stolen',null,jsonb_build_object('kind','voleur','stolen',v_amount));
    perform public.tcg_push_notify(other_role,'Un Voleur est passé','-'||v_amount||' Éclats ont disparu de ton solde.','./');
  end if;
end;
$function$;


revoke all on function public.tcg_helper_action(text,text,jsonb) from public,anon,authenticated;
alter table public.tcg_push_sent enable row level security;
revoke all on table public.tcg_push_sent from anon,authenticated;
revoke all on function public.tcg_push_daily_booster() from public,anon,authenticated;
revoke all on function public.tcg_push_expirations() from public,anon,authenticated;
revoke all on function public.tcg_push_notify(text,text,text,text) from public,anon,authenticated;
revoke all on function public.tcg_push_purge(text) from public,anon,authenticated;
revoke all on function public.tcg_push_on_activation() from public,anon,authenticated;
revoke all on function public.tcg_push_on_gift() from public,anon,authenticated;
revoke all on function public.tcg_push_on_ritual() from public,anon,authenticated;
revoke all on function public.tcg_push_on_spell() from public,anon,authenticated;
revoke all on function public.tcg_push_on_trade() from public,anon,authenticated;
grant execute on function public.tcg_push_notify(text,text,text,text),public.tcg_push_purge(text),public.tcg_push_daily_booster(),public.tcg_push_expirations() to service_role;

