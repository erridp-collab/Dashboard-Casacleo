do $$
begin
  update public.products
     set sku = 'set_letto_estivo',
         name = 'Set letto estivo',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where lower(trim(coalesce(sku, ''))) = 'completi_letto'
      or lower(trim(coalesce(name, ''))) = 'completi letto completi';

  update public.products
     set sku = 'set_letto_invernale',
         name = 'Set letto invernale',
         category = coalesce(category, 'Lenzuola e coperte'),
         unit = coalesce(unit, 'set')
   where lower(trim(coalesce(sku, ''))) = 'copripiumini_federe'
      or lower(trim(coalesce(name, ''))) = 'copripiumini + federe';

  insert into public.products (sku, name, category, unit, quantity, threshold, max_qty, consumption_per_checkout)
  select 'set_letto_estivo', 'Set letto estivo', 'Lenzuola e coperte', 'set', 4, 2, 4, 0
   where not exists (
     select 1
       from public.products
      where lower(trim(coalesce(sku, ''))) = 'set_letto_estivo'
         or lower(trim(coalesce(name, ''))) = 'set letto estivo'
   );

  insert into public.products (sku, name, category, unit, quantity, threshold, max_qty, consumption_per_checkout)
  select 'set_letto_invernale', 'Set letto invernale', 'Lenzuola e coperte', 'set', 4, 2, 4, 0
   where not exists (
     select 1
       from public.products
      where lower(trim(coalesce(sku, ''))) = 'set_letto_invernale'
         or lower(trim(coalesce(name, ''))) = 'set letto invernale'
   );
end $$;
