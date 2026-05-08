create extension if not exists btree_gist;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    organization_id with =,
    tsrange(
      check_in::timestamp,
      check_out::timestamp,
      '[)'
    ) with &&
  );
