create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text null,
  organization_name text not null,
  status text not null default 'pending',
  notes text null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  organization_id uuid null references public.organizations(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_requests_status_check check (status in ('pending', 'approved', 'rejected', 'failed'))
);

create index if not exists signup_requests_status_created_at_idx
  on public.signup_requests(status, created_at desc);

create unique index if not exists signup_requests_pending_email_key
  on public.signup_requests ((lower(email)))
  where status = 'pending';

grant all on table public.signup_requests to service_role;

alter table public.signup_requests enable row level security;

drop trigger if exists signup_requests_set_updated_at on public.signup_requests;
create trigger signup_requests_set_updated_at
before update on public.signup_requests
for each row
execute function public.touch_updated_at_column();
