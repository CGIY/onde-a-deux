create table public.desir_room_rhythm (
  room_id uuid primary key references public.desir_rooms(id) on delete cascade,
  started_on date not null,
  ended_on date not null check (ended_on > started_on),
  with_penetration integer not null check (with_penetration >= 0),
  without_penetration integer not null check (without_penetration >= 0),
  anal integer not null check (anal between 0 and with_penetration)
);

alter table public.desir_room_rhythm enable row level security;
revoke all on public.desir_room_rhythm from public,anon,authenticated,service_role;
grant select on public.desir_room_rhythm to service_role;
