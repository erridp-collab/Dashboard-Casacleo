alter table public.products
add column if not exists category text;

alter table public.products
add column if not exists max_qty numeric;

alter table public.products
add column if not exists consumption_per_checkout numeric;

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

  create temporary table tmp_seed_products (
    sku text,
    name text,
    category text,
    unit text,
    quantity numeric,
    threshold numeric,
    max_qty numeric,
    consumption_per_checkout numeric
  ) on commit drop;

  insert into tmp_seed_products (sku, name, category, unit, quantity, threshold, max_qty, consumption_per_checkout)
  values
    ('asciug_bidet', 'Asciugamani bidet', 'Asciugamani e bagno', 'pezzi', 6, 2, 6, null),
    ('asciug_viso', 'Asciugamani viso', 'Asciugamani e bagno', 'pezzi', 8, 3, 8, null),
    ('asciug_doccia', 'Asciugamani doccia', 'Asciugamani e bagno', 'pezzi', 8, 3, 8, null),
    ('asciug_corpo', 'Asciugamani corpo', 'Asciugamani e bagno', 'pezzi', 8, 3, 8, null),
    ('tappetini_doccia', 'Tappetini doccia', 'Asciugamani e bagno', 'pezzi', 4, 2, 4, null),
    ('mappine_cucina', 'Mappine cucina', 'Cucina', 'pezzi', 4, 2, 4, null),
    ('coperte_divano', 'Coperte divano', 'Lenzuola e coperte', 'pezzi', 2, 1, 2, null),
    ('piumino_pesante', 'Piumino pesante', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('piumino_primaverile', 'Piumino primaverile', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('completi_letto', 'Completi letto completi', 'Lenzuola e coperte', 'set', 4, 2, 4, null),
    ('copripiumini_federe', 'Copripiumini + federe', 'Lenzuola e coperte', 'set', 4, 2, 4, null),
    ('lenzuolo_sotto_extra', 'Lenzuolo sotto extra', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('cambio_teli_divano', 'Cambio teli divano', 'Lenzuola e coperte', 'set', 1, 0, 1, null),
    ('caffe_cialde', 'Caffe cialde', 'Caffe', 'cialde', 36, 10, 36, null),
    ('sapone_mani_corpo', 'Sapone liquido mani/corpo', 'Prodotti per pulizia', 'lt', 5, 2, 5, null),
    ('sapone_piatti', 'Sapone piatti', 'Prodotti per pulizia', 'lt', 5, 2, 5, null),
    ('lavapavimenti', 'Lavapavimenti', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('wc_net', 'WC Net', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('carta_igienica', 'Carta igienica', 'Prodotti per pulizia', 'rotoli', 20, 6, 20, null),
    ('spugnette_lavapiatti', 'Spugnette lavapiatti', 'Prodotti per pulizia', 'pezzi', 11, 3, 11, 1),
    ('multiuso_vetri', 'Multiuso vetri', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('candeggina', 'Candeggina', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('spugnette_morbide', 'Spugnette morbide', 'Prodotti per pulizia', 'pezzi', 5, 2, 5, 1),
    ('anticalcare', 'Anticalcare', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('sgrassatore', 'Sgrassatore', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('disgorgante', 'Disgorgante', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('viakal_vetro_doccia', 'Viakal vetro doccia', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null);

  execute format(
    'update public.products p
       set name = s.name,
           category = s.category,
           unit = s.unit,
           %I = s.quantity,
           threshold = s.threshold,
           max_qty = s.max_qty,
           consumption_per_checkout = coalesce(s.consumption_per_checkout, 0)
      from tmp_seed_products s
     where lower(trim(p.sku)) = lower(trim(s.sku))
        or lower(trim(p.name)) = lower(trim(s.name))',
    qty_col
  );

  execute format(
    'insert into public.products (sku, name, category, unit, %I, threshold, max_qty, consumption_per_checkout)
     select s.sku, s.name, s.category, s.unit, s.quantity, s.threshold, s.max_qty, coalesce(s.consumption_per_checkout, 0)
     from tmp_seed_products s
     where not exists (
       select 1
       from public.products p
       where lower(trim(p.sku)) = lower(trim(s.sku))
          or lower(trim(p.name)) = lower(trim(s.name))
     )',
    qty_col
  );
end $$;
