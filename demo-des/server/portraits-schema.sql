-- Private assets for the two members of a room. Only the Edge service can read them.
create table if not exists public.desir_room_portraits (
  room_id uuid not null references public.desir_rooms(id) on delete cascade,
  actor text not null check (actor in ('a','b')),
  jpeg_base64 text not null check (
    length(jpeg_base64) between 8 and 65536
    and length(jpeg_base64)%4=0
    and jpeg_base64 ~ '^/9j/[A-Za-z0-9+/]*={0,2}$'
  ),
  primary key(room_id,actor)
);

alter table public.desir_room_portraits enable row level security;
revoke all on public.desir_room_portraits from public,anon,authenticated,service_role;
grant select on public.desir_room_portraits to service_role;
