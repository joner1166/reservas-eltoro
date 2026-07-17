/* =========================================================
   0) EXTENSION
   ========================================================= */
create extension if not exists "pgcrypto";

/* =========================================================
   1) Crear tabla reservations
   ========================================================= */
create table if not exists public.reservations (
  id            bigserial primary key,
  "firstName"   text not null,
  "lastName"    text not null,
  guests        integer not null default 2,
  "dateISO"     text not null,
  "timeHHMM"    text not null,
  phone         text not null,
  email         text null,
  celebration   text not null default 'None',
  dietary       text not null default 'None',
  notes         text null,
  status        text not null default 'reserved',
  source        text not null default 'reservation',
  seated_at     timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

/* =========================================================
   2) Asegurar columnas
   ========================================================= */
alter table public.reservations
  add column if not exists "firstName"        text,
  add column if not exists "lastName"         text,
  add column if not exists guests             integer not null default 2,
  add column if not exists "dateISO"          text,
  add column if not exists "timeHHMM"         text,
  add column if not exists phone              text,
  add column if not exists email              text,
  add column if not exists celebration        text not null default 'None',
  add column if not exists dietary            text not null default 'None',
  add column if not exists notes              text,
  add column if not exists status             text not null default 'reserved',
  add column if not exists source             text not null default 'reservation',
  add column if not exists seated_at          timestamptz,
  add column if not exists created_at         timestamptz not null default now(),
  add column if not exists updated_at         timestamptz not null default now(),
  add column if not exists "sms_opt_in"       boolean default false,
  add column if not exists "cancel_token"     text,
  add column if not exists "reminder_sent_at" timestamptz null,
  add column if not exists "confirmed_at"     timestamptz default null,
  add column if not exists notified_at        timestamptz null,
  add column if not exists estimated_wait     integer null;

/* =========================================================
   3) Limpieza de datos
   ========================================================= */
update public.reservations set status = 'reserved'
where status is null or btrim(status) = ''
   or lower(btrim(status)) not in ('reserved','waitlist','seated','cancelled','no_show');

update public.reservations set source = 'reservation'
where source is null or btrim(source) = ''
   or lower(btrim(source)) not in ('reservation','walkin');

update public.reservations set status = lower(btrim(status)) where status is not null;
update public.reservations set source = lower(btrim(source)) where source is not null;

/* =========================================================
   4) Constraints
   ========================================================= */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_status_check') then
    execute $c$ alter table public.reservations add constraint reservations_status_check
      check (status in ('reserved','waitlist','seated','cancelled','no_show')) not valid $c$;
    execute 'alter table public.reservations validate constraint reservations_status_check';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_source_check') then
    execute $c$ alter table public.reservations add constraint reservations_source_check
      check (source in ('reservation','walkin')) not valid $c$;
    execute 'alter table public.reservations validate constraint reservations_source_check';
  end if;
end $$;

/* =========================================================
   5) Trigger updated_at
   ========================================================= */
create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

/* =========================================================
   6) Índices
   ========================================================= */
create index if not exists reservations_date_status_idx   on public.reservations ("dateISO", status);
create index if not exists reservations_status_idx         on public.reservations (status);
create index if not exists reservations_created_at_idx     on public.reservations (created_at desc);
create index if not exists reservations_cancel_token_idx   on public.reservations ("cancel_token");
create index if not exists reservations_notified_at_idx    on public.reservations (notified_at);

/* =========================================================
   7) Realtime reservations
   ========================================================= */
alter table public.reservations replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations'
  ) then execute 'alter publication supabase_realtime add table public.reservations'; end if;
end $$;

/* =========================================================
   8) RLS reservations
   ========================================================= */
alter table public.reservations enable row level security;
drop policy if exists "reservations_select_all" on public.reservations;
drop policy if exists "reservations_insert_all" on public.reservations;
drop policy if exists "reservations_update_all" on public.reservations;
drop policy if exists "reservations_delete_all" on public.reservations;
create policy "reservations_select_all" on public.reservations for select using (true);
create policy "reservations_insert_all" on public.reservations for insert with check (true);
create policy "reservations_update_all" on public.reservations for update using (true) with check (true);
create policy "reservations_delete_all" on public.reservations for delete using (true);

/* =========================================================
   9) Tabla table_status
   ========================================================= */
create table if not exists public.table_status (
  id     text primary key,
  status text not null default 'av' check (status in ('av', 'occ'))
);
alter table public.table_status enable row level security;
drop policy if exists "ts_select" on public.table_status;
drop policy if exists "ts_insert" on public.table_status;
drop policy if exists "ts_update" on public.table_status;
create policy "ts_select" on public.table_status for select using (true);
create policy "ts_insert" on public.table_status for insert with check (true);
create policy "ts_update" on public.table_status for update using (true) with check (true);
alter table public.table_status replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'table_status'
  ) then execute 'alter publication supabase_realtime add table public.table_status'; end if;
end $$;

insert into public.table_status (id, status) values
  ('BAR-B1','av'),('BAR-B2','av'),('BAR-B3','av'),('BAR-B4','av'),('BAR-B5','av'),
  ('BAR-B6','av'),('BAR-B7','av'),('BAR-B8','av'),('BAR-B9','av'),
  ('BAR-B10','av'),('BAR-B11','av'),('BAR-B12','av'),
  ('BAR-B13','av'),('BAR-B14','av'),('BAR-B15','av'),('BAR-B16','av'),('BAR-B17','av'),
  ('ROOM1-1','av'),('ROOM1-2','av'),('ROOM1-3','av'),('ROOM1-4','av'),
  ('ROOM1-5','av'),('ROOM1-6','av'),('ROOM1-7','av'),('ROOM1-8','av'),
  ('ROOM1-9','av'),('ROOM1-10','av'),('ROOM1-11','av'),
  ('ROOM1-12','av'),('ROOM1-14','av'),('ROOM1-16','av'),
  ('ROOM2-21','av'),('ROOM2-22','av'),('ROOM2-23','av'),('ROOM2-24','av'),
  ('ROOM2-25','av'),('ROOM2-26','av'),('ROOM2-27','av'),('ROOM2-28','av'),
  ('ROOM2-29','av'),('ROOM2-30','av'),('ROOM2-31','av'),('ROOM2-32','av'),
  ('ROOM3-43','av'),('ROOM3-44','av'),('ROOM3-45','av'),('ROOM3-46','av'),
  ('ROOM3-47','av'),('ROOM3-48','av'),('ROOM3-49','av'),('ROOM3-50','av'),
  ('ROOM3-51','av'),('ROOM3-52','av'),('ROOM3-53','av'),('ROOM3-54','av'),
  ('ROOM3-55','av'),('ROOM3-56','av'),
  ('ROOM3-57','av'),('ROOM3-58','av'),('ROOM3-59','av'),('ROOM3-60','av'),('ROOM3-61','av')
on conflict (id) do nothing;

/* =========================================================
   10) Tabla blackout_dates
   ========================================================= */
create table if not exists public.blackout_dates (
  date_iso text primary key
);
alter table public.blackout_dates enable row level security;
drop policy if exists "bd_select" on public.blackout_dates;
drop policy if exists "bd_insert" on public.blackout_dates;
drop policy if exists "bd_delete" on public.blackout_dates;
create policy "bd_select" on public.blackout_dates for select using (true);
create policy "bd_insert" on public.blackout_dates for insert with check (true);
create policy "bd_delete" on public.blackout_dates for delete using (true);
alter table public.blackout_dates replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blackout_dates'
  ) then execute 'alter publication supabase_realtime add table public.blackout_dates'; end if;
end $$;
alter table public.blackout_dates add column if not exists notes text;
alter table public.blackout_dates add column if not exists type text default 'closed';
alter table public.table_status  add column if not exists server_names text[] default '{}';

/* =========================================================
   11) Tabla table_events
   ========================================================= */
create table if not exists public.table_events (
  id          bigserial primary key,
  table_id    text not null,
  server_name text null,
  date_iso    text not null,
  created_at  timestamptz not null default now()
);
alter table public.table_events enable row level security;
drop policy if exists "te_select" on public.table_events;
drop policy if exists "te_insert" on public.table_events;
create policy "te_select" on public.table_events for select using (true);
create policy "te_insert" on public.table_events for insert with check (true);
alter table public.table_events replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'table_events'
  ) then execute 'alter publication supabase_realtime add table public.table_events'; end if;
end $$;

create index if not exists te_table_date_idx on public.table_events (table_id, date_iso);
create index if not exists te_date_idx       on public.table_events (date_iso);
