-- supabase/migrations/20260618100000_add_linen_role.sql

alter table public.products
  add column if not exists linen_role text default null;

alter table public.products
  drop constraint if exists products_linen_role_check;

alter table public.products
  add constraint products_linen_role_check check (
    linen_role is null or linen_role = any(array[
      'set_estivo',
      'set_invernale',
      'asciugamano_corpo',
      'asciugamano_doccia',
      'asciugamano_bidet',
      'asciugamano_viso',
      'tappetino_doccia',
      'mappina_cucina'
    ])
  );

drop index if exists public.products_linen_role_org_unique;

create unique index products_linen_role_org_unique
  on public.products (organization_id, linen_role)
  where linen_role is not null;

-- Mapping retroattivo: assegna linen_role ai prodotti esistenti per nome/sku
update public.products set linen_role = 'set_estivo'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) in ('set_letto_estivo', 'completi_letto')
      or lower(trim(coalesce(name, ''))) in ('set letto estivo', 'completi letto completi')
    );

update public.products set linen_role = 'set_invernale'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) in ('set_letto_invernale', 'copripiumini_federe')
      or lower(trim(coalesce(name, ''))) in ('set letto invernale', 'copripiumini + federe')
    );

update public.products set linen_role = 'asciugamano_corpo'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_corpo'
      or lower(trim(coalesce(name, ''))) = 'asciugamani corpo'
    );

update public.products set linen_role = 'asciugamano_doccia'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_doccia'
      or lower(trim(coalesce(name, ''))) = 'asciugamani doccia'
    );

update public.products set linen_role = 'asciugamano_bidet'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_bidet'
      or lower(trim(coalesce(name, ''))) = 'asciugamani bidet'
    );

update public.products set linen_role = 'asciugamano_viso'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_viso'
      or lower(trim(coalesce(name, ''))) = 'asciugamani viso'
    );

update public.products set linen_role = 'tappetino_doccia'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'tappetini_doccia'
      or lower(trim(coalesce(name, ''))) = 'tappetini doccia'
    );

update public.products set linen_role = 'mappina_cucina'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'mappine_cucina'
      or lower(trim(coalesce(name, ''))) = 'mappine cucina'
    );
