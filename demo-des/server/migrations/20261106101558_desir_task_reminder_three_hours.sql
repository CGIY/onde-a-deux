-- The reminder lead follows the validated-action lifetime (now 24 hours): fire at H-3.
create or replace function public.desir_due_task_reminders(p_state jsonb,p_actor text,p_at timestamptz default now())
returns table(task_id text,expires_at timestamptz) language sql stable security invoker set search_path='' as $$
  select task->>'id',(task->>'expiresAt')::timestamptz
  from jsonb_array_elements(coalesce(p_state->'tasks','[]'::jsonb)) task
  where p_actor in ('a','b') and task->'checks'->>p_actor='false'
    and (task->>'expiresAt')::timestamptz>p_at
    and (task->>'expiresAt')::timestamptz<=p_at+interval '3 hours';
$$;
revoke all on function public.desir_due_task_reminders(jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.desir_due_task_reminders(jsonb,text,timestamptz) to service_role;
