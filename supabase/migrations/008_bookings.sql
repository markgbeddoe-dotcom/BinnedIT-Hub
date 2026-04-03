-- 008_bookings.sql
-- Public customer booking form — bookings table
-- Sprint 8: Customer Booking Form

create table if not exists public.bookings (
  id              uuid        primary key default gen_random_uuid(),
  customer_name   text        not null,
  customer_email  text        not null,
  customer_phone  text        not null,
  address         text        not null,
  suburb          text        not null,
  postcode        text        not null,
  bin_size        text        not null check (bin_size in ('2m3','4m3','6m3','8m3')),
  waste_type      text        not null,
  delivery_date   date        not null,
  collection_date date        not null,
  special_instructions text,
  price           numeric(10,2) not null,
  status          text        not null default 'pending'
                    check (status in ('pending','confirmed','scheduled','completed','cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Enforce collection must be after delivery at the DB level
alter table public.bookings
  add constraint bookings_collection_after_delivery
  check (collection_date > delivery_date);

-- RLS: public can INSERT (anon), authenticated users can read/update
alter table public.bookings enable row level security;

create policy "Public can create bookings"
  on public.bookings for insert
  to anon, authenticated
  with check (true);

create policy "Authenticated users can view bookings"
  on public.bookings for select
  to authenticated
  using (true);

create policy "Authenticated users can update bookings"
  on public.bookings for update
  to authenticated
  using (true);

-- updated_at trigger (reuse function if already exists from other tables)
create or replace function public.handle_bookings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.handle_bookings_updated_at();

-- Indexes for common dashboard queries
create index if not exists bookings_status_idx    on public.bookings (status);
create index if not exists bookings_delivery_idx  on public.bookings (delivery_date);
create index if not exists bookings_created_idx   on public.bookings (created_at desc);
