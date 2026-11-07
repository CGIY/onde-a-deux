-- One draw per clock hour instead of three fixed six-hour daily slots.
-- The window key keeps the 'YYYY-MM-DDTHH:MI' shape already stored in
-- desir_draw_usage, so past rows simply stop matching new keys and every
-- player gets a fresh ticket in the hour the change lands.
create or replace function public.desir_quota_window(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  local_at timestamp:=p_at at time zone 'Europe/Paris';
  start_at timestamp;
  finish_at timestamp;
  window_label text;
begin
  start_at:=date_trunc('hour',local_at);
  finish_at:=start_at+interval '1 hour';
  window_label:=to_char(start_at,'HH24')||' h';
  return jsonb_build_object('window',to_char(start_at,'YYYY-MM-DD"T"HH24:MI'),'label',window_label,
    'nextAt',to_char((finish_at at time zone 'Europe/Paris') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

revoke all on function public.desir_quota_window(timestamptz) from public,anon,authenticated;
grant execute on function public.desir_quota_window(timestamptz) to service_role;
