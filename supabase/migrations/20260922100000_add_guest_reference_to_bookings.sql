-- supabase/migrations/20260922100000_add_guest_reference_to_bookings.sql

alter table public.bookings
  add column if not exists guest_reference text default null;
