-- Multi-tenant foundation: organizations, memberships, tenant-scoped data, and RLS.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  currency_code text not null default 'EUR',
  timezone text not null default 'Europe/Rome',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_key unique (slug),
  constraint organizations_currency_code_check check (char_length(trim(currency_code)) = 3)
);

create table if not exists public.user_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_pkey primary key (organization_id, user_id),
  constraint user_roles_role_check check (role in ('owner', 'admin', 'staff'))
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_org_role_idx on public.user_roles(organization_id, role);

grant all on table public.organizations to authenticated;
grant all on table public.organizations to service_role;
grant all on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

create or replace function public.touch_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.default_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) = 1 then (array_agg(id order by id))[1]
    else null::uuid
  end
  from public.organizations;
$$;

create or replace function public.user_has_organization_access(
  p_organization_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.user_roles ur
      where ur.organization_id = p_organization_id
        and ur.user_id = auth.uid()
        and (
          p_roles is null
          or ur.role = any (p_roles)
        )
    );
$$;

grant execute on function public.default_organization_id() to authenticated;
grant execute on function public.default_organization_id() to service_role;
grant execute on function public.user_has_organization_access(uuid, text[]) to authenticated;
grant execute on function public.user_has_organization_access(uuid, text[]) to service_role;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.touch_updated_at_column();

drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at
before update on public.user_roles
for each row
execute function public.touch_updated_at_column();

insert into public.organizations (name, slug, settings)
select
  'Legacy Workspace',
  'legacy-workspace',
  jsonb_build_object('source', 'multi-tenant-bootstrap')
where not exists (
  select 1
  from public.organizations
);

alter table public.products
  add column if not exists id uuid;

update public.products
set id = gen_random_uuid()
where id is null;

alter table public.products
  alter column id set default gen_random_uuid();

alter table public.bookings
  add column if not exists organization_id uuid;

alter table public.actions
  add column if not exists organization_id uuid;

alter table public.action_checklist
  add column if not exists organization_id uuid;

alter table public.expenses
  add column if not exists organization_id uuid;

alter table public.products
  add column if not exists organization_id uuid;

alter table public.counters
  add column if not exists organization_id uuid;

update public.bookings
set organization_id = public.default_organization_id()
where organization_id is null;

update public.actions a
set organization_id = b.organization_id
from public.bookings b
where a.organization_id is null
  and a.booking_id = b.id;

update public.actions
set organization_id = public.default_organization_id()
where organization_id is null;

update public.action_checklist ac
set organization_id = a.organization_id
from public.actions a
where ac.organization_id is null
  and ac.action_id = a.id;

update public.expenses e
set organization_id = a.organization_id
from public.actions a
where e.organization_id is null
  and e.source_action_id = a.id;

update public.expenses
set organization_id = public.default_organization_id()
where organization_id is null;

update public.products
set organization_id = public.default_organization_id()
where organization_id is null;

update public.counters
set organization_id = public.default_organization_id()
where organization_id is null;

alter table public.bookings
  alter column organization_id set not null;

alter table public.actions
  alter column organization_id set not null;

alter table public.action_checklist
  alter column organization_id set not null;

alter table public.expenses
  alter column organization_id set not null;

alter table public.products
  alter column organization_id set not null;

alter table public.products
  alter column id set not null;

alter table public.counters
  alter column organization_id set not null;

alter table public.bookings
  drop constraint if exists bookings_organization_id_fkey;

alter table public.bookings
  add constraint bookings_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.actions
  drop constraint if exists actions_organization_id_fkey;

alter table public.actions
  add constraint actions_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.action_checklist
  drop constraint if exists action_checklist_organization_id_fkey;

alter table public.action_checklist
  add constraint action_checklist_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.expenses
  drop constraint if exists expenses_organization_id_fkey;

alter table public.expenses
  add constraint expenses_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.products
  drop constraint if exists products_organization_id_fkey;

alter table public.products
  add constraint products_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.counters
  drop constraint if exists counters_organization_id_fkey;

alter table public.counters
  add constraint counters_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.products
  drop constraint if exists products_pkey;

alter table public.products
  add constraint products_pkey primary key (id);

create unique index if not exists products_organization_id_sku_key
  on public.products(organization_id, sku);

create index if not exists idx_products_org_name
  on public.products(organization_id, name);

create index if not exists idx_bookings_org_dates
  on public.bookings(organization_id, check_in, check_out);

create index if not exists idx_actions_org_date
  on public.actions(organization_id, action_date);

create index if not exists idx_actions_org_booking
  on public.actions(organization_id, booking_id);

create index if not exists idx_action_checklist_org_action
  on public.action_checklist(organization_id, action_id);

create index if not exists idx_expenses_org_date
  on public.expenses(organization_id, expense_date);

alter table public.counters
  drop constraint if exists counters_pkey;

alter table public.counters
  add constraint counters_pkey primary key (organization_id, key);

create or replace function public.ensure_booking_organization_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.default_organization_id();
  end if;

  if new.organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_action_organization_id()
returns trigger
language plpgsql
as $$
declare
  v_booking_org_id uuid;
begin
  if new.booking_id is not null then
    select b.organization_id
    into v_booking_org_id
    from public.bookings b
    where b.id = new.booking_id;

    if not found then
      raise exception 'booking % not found while resolving organization_id', new.booking_id;
    end if;

    if new.organization_id is null then
      new.organization_id := v_booking_org_id;
    elsif new.organization_id <> v_booking_org_id then
      raise exception 'action organization_id must match booking organization_id';
    end if;
  end if;

  if new.organization_id is null then
    new.organization_id := public.default_organization_id();
  end if;

  if new.organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_action_checklist_organization_id()
returns trigger
language plpgsql
as $$
declare
  v_action_org_id uuid;
begin
  select a.organization_id
  into v_action_org_id
  from public.actions a
  where a.id = new.action_id;

  if not found then
    raise exception 'action % not found while resolving organization_id', new.action_id;
  end if;

  if new.organization_id is null then
    new.organization_id := v_action_org_id;
  elsif new.organization_id <> v_action_org_id then
    raise exception 'checklist organization_id must match action organization_id';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_expense_organization_id()
returns trigger
language plpgsql
as $$
declare
  v_action_org_id uuid;
begin
  if new.source_action_id is not null then
    select a.organization_id
    into v_action_org_id
    from public.actions a
    where a.id = new.source_action_id;

    if not found then
      raise exception 'action % not found while resolving expense organization_id', new.source_action_id;
    end if;

    if new.organization_id is null then
      new.organization_id := v_action_org_id;
    elsif new.organization_id <> v_action_org_id then
      raise exception 'expense organization_id must match source action organization_id';
    end if;
  end if;

  if new.organization_id is null then
    new.organization_id := public.default_organization_id();
  end if;

  if new.organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_product_organization_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.default_organization_id();
  end if;

  if new.organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_counter_organization_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.default_organization_id();
  end if;

  if new.organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_ensure_organization_id on public.bookings;
create trigger bookings_ensure_organization_id
before insert or update on public.bookings
for each row
execute function public.ensure_booking_organization_id();

drop trigger if exists actions_ensure_organization_id on public.actions;
create trigger actions_ensure_organization_id
before insert or update on public.actions
for each row
execute function public.ensure_action_organization_id();

drop trigger if exists action_checklist_ensure_organization_id on public.action_checklist;
create trigger action_checklist_ensure_organization_id
before insert or update on public.action_checklist
for each row
execute function public.ensure_action_checklist_organization_id();

drop trigger if exists expenses_ensure_organization_id on public.expenses;
create trigger expenses_ensure_organization_id
before insert or update on public.expenses
for each row
execute function public.ensure_expense_organization_id();

drop trigger if exists products_ensure_organization_id on public.products;
create trigger products_ensure_organization_id
before insert or update on public.products
for each row
execute function public.ensure_product_organization_id();

drop trigger if exists counters_ensure_organization_id on public.counters;
create trigger counters_ensure_organization_id
before insert or update on public.counters
for each row
execute function public.ensure_counter_organization_id();

create or replace function public.bootstrap_organization_defaults()
returns trigger
language plpgsql
as $$
begin
  insert into public.counters (organization_id, key, value)
  values (new.id, 'booking_counter', '0')
  on conflict (organization_id, key) do nothing;

  return new;
end;
$$;

drop trigger if exists organizations_bootstrap_defaults on public.organizations;
create trigger organizations_bootstrap_defaults
after insert on public.organizations
for each row
execute function public.bootstrap_organization_defaults();

insert into public.counters (organization_id, key, value)
select o.id, 'booking_counter', '0'
from public.organizations o
where not exists (
  select 1
  from public.counters c
  where c.organization_id = o.id
    and c.key = 'booking_counter'
);

create or replace function public._create_action(
  p_booking_id uuid,
  p_action_date date,
  p_action_type text,
  p_details text default null
)
returns uuid
language plpgsql
as $$
declare
  v_action_id uuid;
  v_items text[];
  v_organization_id uuid;
begin
  if p_booking_id is not null then
    select b.organization_id
    into v_organization_id
    from public.bookings b
    where b.id = p_booking_id;
  end if;

  v_organization_id := coalesce(v_organization_id, public.default_organization_id());

  if v_organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  insert into public.actions(organization_id, booking_id, action_date, action_type, status, details, amount)
  values (v_organization_id, p_booking_id, p_action_date, p_action_type, 'DA_FARE', p_details, 0)
  returning id into v_action_id;

  v_items := public._checklist_items(p_action_type);

  if array_length(v_items, 1) is not null then
    insert into public.action_checklist(organization_id, action_id, item, done)
    select v_organization_id, v_action_id, x, false
    from unnest(v_items) as x;
  end if;

  return v_action_id;
end;
$$;

create or replace function public.create_booking(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_check_in date := (payload->>'check_in')::date;
  v_check_out date := (payload->>'check_out')::date;
  v_guests int := (payload->>'guests')::int;
  v_channel text := nullif(payload->>'channel','');
  v_notes text := nullif(payload->>'notes','');
  v_organization_id uuid := nullif(payload->>'organization_id', '')::uuid;

  v_booking_id uuid;
  v_counter int;

  v_prev_day date := v_check_in - 1;

  v_used_completi int := ceiling(v_guests / 2.0);
  v_used_corpo int := v_guests;
  v_used_doccia int := v_guests;
  v_used_bidet int := v_guests;

  v_need_lav boolean := false;
begin
  if v_check_out <= v_check_in then
    raise exception 'check_out must be after check_in';
  end if;

  v_organization_id := coalesce(v_organization_id, public.default_organization_id());

  if v_organization_id is null then
    raise exception 'organization_id is required when multiple organizations exist';
  end if;

  insert into public.bookings(organization_id, check_in, check_out, guests, channel, notes, revenue)
  values (v_organization_id, v_check_in, v_check_out, v_guests, v_channel, v_notes, 0)
  returning id into v_booking_id;

  insert into public.counters (organization_id, key, value)
  values (v_organization_id, 'booking_counter', '0')
  on conflict (organization_id, key) do nothing;

  update public.counters
  set value = ((value::int) + 1)::text
  where organization_id = v_organization_id
    and key = 'booking_counter';

  select value::int into v_counter
  from public.counters
  where organization_id = v_organization_id
    and key = 'booking_counter';

  perform public._create_action(v_booking_id, v_check_out, 'PULIZIA', null);

  if not exists (
    select 1
    from public.bookings b
    where b.id <> v_booking_id
      and b.organization_id = v_organization_id
      and b.check_out in (v_check_in, v_prev_day)
  ) then
    perform public._create_action(v_booking_id, v_check_in, 'PREPARA_LETTO', null);
  end if;

  with b as (
    select sku, qty, threshold
    from public.products
    where organization_id = v_organization_id
      and category = 'biancheria_auto'
      and sku in ('completi_letto','asciug_corpo','asciug_doccia','asciug_bidet')
  ),
  chk as (
    select
      sku,
      qty,
      threshold,
      case sku
        when 'completi_letto' then v_used_completi::numeric
        when 'asciug_corpo' then v_used_corpo::numeric
        when 'asciug_doccia' then v_used_doccia::numeric
        when 'asciug_bidet' then v_used_bidet::numeric
        else 0::numeric
      end as used
    from b
  )
  select exists (
    select 1
    from chk
    where (qty - used) <= threshold
  ) into v_need_lav;

  if v_need_lav then
    perform public._create_action(v_booking_id, v_check_out, 'LAVATRICI', null);
  end if;

  update public.products
  set qty = greatest(qty - v_used_completi, 0)
  where organization_id = v_organization_id
    and sku = 'completi_letto';

  update public.products
  set qty = greatest(qty - v_used_corpo, 0)
  where organization_id = v_organization_id
    and sku = 'asciug_corpo';

  update public.products
  set qty = greatest(qty - v_used_doccia, 0)
  where organization_id = v_organization_id
    and sku = 'asciug_doccia';

  update public.products
  set qty = greatest(qty - v_used_bidet, 0)
  where organization_id = v_organization_id
    and sku = 'asciug_bidet';

  if (v_counter % 3) = 0 then
    perform public._create_action(v_booking_id, v_check_out, 'MANUT3', null);
  end if;

  if (v_counter % 4) = 0 then
    perform public._create_action(v_booking_id, v_check_out, 'MANUT4', null);
  end if;

  return jsonb_build_object('booking_id', v_booking_id);
end;
$$;

revoke all on function public._create_action(uuid, date, text, text) from anon;
revoke all on function public._create_action(uuid, date, text, text) from authenticated;
grant execute on function public._create_action(uuid, date, text, text) to service_role;

revoke all on function public.create_booking(jsonb) from anon;
revoke all on function public.create_booking(jsonb) from authenticated;
grant execute on function public.create_booking(jsonb) to service_role;

revoke all on function public.delete_booking_atomic(uuid, jsonb) from anon;
revoke all on function public.delete_booking_atomic(uuid, jsonb) from authenticated;
grant execute on function public.delete_booking_atomic(uuid, jsonb) to service_role;

revoke all on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) from anon;
revoke all on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) from authenticated;
grant execute on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) to service_role;

alter table public.organizations enable row level security;
alter table public.user_roles enable row level security;
alter table public.bookings enable row level security;
alter table public.actions enable row level security;
alter table public.action_checklist enable row level security;
alter table public.expenses enable row level security;
alter table public.products enable row level security;
alter table public.counters enable row level security;
alter table public.auth_rate_limits enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.user_has_organization_access(id));

drop policy if exists organizations_update_owner on public.organizations;
create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (public.user_has_organization_access(id, array['owner']))
with check (public.user_has_organization_access(id, array['owner']));

drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (public.user_has_organization_access(id, array['owner']));

drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.user_has_organization_access(organization_id, array['owner', 'admin'])
);

drop policy if exists user_roles_insert_owner_admin on public.user_roles;
create policy user_roles_insert_owner_admin
on public.user_roles
for insert
to authenticated
with check (public.user_has_organization_access(organization_id, array['owner', 'admin']));

drop policy if exists user_roles_update_owner_admin on public.user_roles;
create policy user_roles_update_owner_admin
on public.user_roles
for update
to authenticated
using (public.user_has_organization_access(organization_id, array['owner', 'admin']))
with check (public.user_has_organization_access(organization_id, array['owner', 'admin']));

drop policy if exists user_roles_delete_owner_admin on public.user_roles;
create policy user_roles_delete_owner_admin
on public.user_roles
for delete
to authenticated
using (public.user_has_organization_access(organization_id, array['owner', 'admin']));

drop policy if exists bookings_member_select on public.bookings;
create policy bookings_member_select
on public.bookings
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists bookings_member_insert on public.bookings;
create policy bookings_member_insert
on public.bookings
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists bookings_member_update on public.bookings;
create policy bookings_member_update
on public.bookings
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists bookings_member_delete on public.bookings;
create policy bookings_member_delete
on public.bookings
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists actions_member_select on public.actions;
create policy actions_member_select
on public.actions
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists actions_member_insert on public.actions;
create policy actions_member_insert
on public.actions
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists actions_member_update on public.actions;
create policy actions_member_update
on public.actions
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists actions_member_delete on public.actions;
create policy actions_member_delete
on public.actions
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists action_checklist_member_select on public.action_checklist;
create policy action_checklist_member_select
on public.action_checklist
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists action_checklist_member_insert on public.action_checklist;
create policy action_checklist_member_insert
on public.action_checklist
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists action_checklist_member_update on public.action_checklist;
create policy action_checklist_member_update
on public.action_checklist
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists action_checklist_member_delete on public.action_checklist;
create policy action_checklist_member_delete
on public.action_checklist
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists expenses_member_select on public.expenses;
create policy expenses_member_select
on public.expenses
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists expenses_member_insert on public.expenses;
create policy expenses_member_insert
on public.expenses
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists expenses_member_update on public.expenses;
create policy expenses_member_update
on public.expenses
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists expenses_member_delete on public.expenses;
create policy expenses_member_delete
on public.expenses
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists products_member_select on public.products;
create policy products_member_select
on public.products
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists products_member_insert on public.products;
create policy products_member_insert
on public.products
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists products_member_update on public.products;
create policy products_member_update
on public.products
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists products_member_delete on public.products;
create policy products_member_delete
on public.products
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists counters_member_select on public.counters;
create policy counters_member_select
on public.counters
for select
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists counters_member_insert on public.counters;
create policy counters_member_insert
on public.counters
for insert
to authenticated
with check (public.user_has_organization_access(organization_id));

drop policy if exists counters_member_update on public.counters;
create policy counters_member_update
on public.counters
for update
to authenticated
using (public.user_has_organization_access(organization_id))
with check (public.user_has_organization_access(organization_id));

drop policy if exists counters_member_delete on public.counters;
create policy counters_member_delete
on public.counters
for delete
to authenticated
using (public.user_has_organization_access(organization_id));

drop policy if exists auth_rate_limits_service_only on public.auth_rate_limits;
create policy auth_rate_limits_service_only
on public.auth_rate_limits
for all
to service_role
using (true)
with check (true);
