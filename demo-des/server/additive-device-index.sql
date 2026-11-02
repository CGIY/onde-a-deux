-- Additive patch for an existing deployment. The compound room/actor index
-- does not cover the actor-only foreign key lookup.
create index if not exists desir_devices_actor_idx on public.desir_devices(actor);
