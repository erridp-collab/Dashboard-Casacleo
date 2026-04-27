do $$
declare
  qty_col text;
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name = 'quantity'
  ) then
    qty_col := 'quantity';
  elsif exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name = 'qty'
  ) then
    qty_col := 'qty';
  else
    alter table public.products add column quantity numeric default 0;
    qty_col := 'quantity';
  end if;

  -- Normalize rows already migrated.
  update public.products
     set name = 'Set letto estivo',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where lower(trim(coalesce(sku, ''))) = 'set_letto_estivo';

  update public.products
     set name = 'Set letto invernale',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where lower(trim(coalesce(sku, ''))) = 'set_letto_invernale';

  -- Rename legacy summer rows only when the target SKU does not already exist.
  update public.products
     set sku = 'set_letto_estivo',
         name = 'Set letto estivo',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where (
           lower(trim(coalesce(sku, ''))) = 'completi_letto'
        or lower(trim(coalesce(name, ''))) = 'completi letto completi'
         )
     and not exists (
           select 1
             from public.products existing
            where lower(trim(coalesce(existing.sku, ''))) = 'set_letto_estivo'
              and existing.ctid <> public.products.ctid
         );

  -- Rename legacy winter rows only when the target SKU does not already exist.
  update public.products
     set sku = 'set_letto_invernale',
         name = 'Set letto invernale',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where (
           lower(trim(coalesce(sku, ''))) = 'copripiumini_federe'
        or lower(trim(coalesce(name, ''))) = 'copripiumini + federe'
         )
     and not exists (
           select 1
             from public.products existing
            where lower(trim(coalesce(existing.sku, ''))) = 'set_letto_invernale'
              and existing.ctid <> public.products.ctid
         );

  execute format(
    'insert into public.products (sku, name, category, unit, %I, threshold, max_qty, consumption_per_checkout)
     select ''set_letto_estivo'', ''Set letto estivo'', ''Lenzuola e coperte'', ''set'', 4, 2, 4, 0
      where not exists (
        select 1
          from public.products
         where lower(trim(coalesce(sku, ''''))) = ''set_letto_estivo''
            or lower(trim(coalesce(name, ''''))) = ''set letto estivo''
      )',
    qty_col
  );

  execute format(
    'insert into public.products (sku, name, category, unit, %I, threshold, max_qty, consumption_per_checkout)
     select ''set_letto_invernale'', ''Set letto invernale'', ''Lenzuola e coperte'', ''set'', 4, 2, 4, 0
      where not exists (
        select 1
          from public.products
         where lower(trim(coalesce(sku, ''''))) = ''set_letto_invernale''
            or lower(trim(coalesce(name, ''''))) = ''set letto invernale''
      )',
    qty_col
  );
end $$;
