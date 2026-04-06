-- Ensure expenses table exists with all required columns.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  amount numeric not null default 0,
  category text,
  description text,
  origin text default 'manuale',
  source_action_id uuid,
  created_at timestamptz default now()
);

-- If the table already existed, ensure optional columns exist.
alter table public.expenses add column if not exists expense_date date;
alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists description text;
alter table public.expenses add column if not exists origin text default 'manuale';
alter table public.expenses add column if not exists source_action_id uuid;

-- Backfill expense_date from "date" column if it exists and expense_date is null.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'date'
  ) then
    update public.expenses set expense_date = date::date where expense_date is null and date is not null;
  end if;
end $$;
