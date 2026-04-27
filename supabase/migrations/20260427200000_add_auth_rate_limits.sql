create table if not exists public.auth_rate_limits (
  ip text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists auth_rate_limits_reset_at_idx
  on public.auth_rate_limits (reset_at);

create or replace function public.touch_auth_rate_limits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists auth_rate_limits_set_updated_at on public.auth_rate_limits;

create trigger auth_rate_limits_set_updated_at
before update on public.auth_rate_limits
for each row
execute function public.touch_auth_rate_limits_updated_at();
