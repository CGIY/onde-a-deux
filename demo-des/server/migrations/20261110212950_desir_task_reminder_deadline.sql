-- A prolonged mission can be reminded at its new deadline. Other scheduled
-- events keep their original deduplication keys.
create unique index if not exists desir_push_outbox_scheduled_once_unique
  on public.desir_push_outbox(room_id,target_actor,kind,dedupe_key)
  where dedupe_key is not null and kind<>'task-reminder';
create unique index if not exists desir_push_outbox_reminder_deadline_unique
  on public.desir_push_outbox(room_id,target_actor,kind,dedupe_key,expires_at)
  where dedupe_key is not null and kind='task-reminder';
drop index if exists public.desir_push_outbox_scheduled_unique;
