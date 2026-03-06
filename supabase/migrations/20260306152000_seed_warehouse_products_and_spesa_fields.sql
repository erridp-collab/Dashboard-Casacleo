alter table public.products
add column if not exists category text;

alter table public.products
add column if not exists max_qty numeric;

alter table public.products
add column if not exists consumption_per_checkout numeric;

with seed(name, category, unit, quantity, threshold, max_qty, consumption_per_checkout) as (
  values
    ('Asciugamani bidet', 'Asciugamani e bagno', 'pezzi', 6, 2, 6, null),
    ('Asciugamani doccia', 'Asciugamani e bagno', 'pezzi', 8, 3, 8, null),
    ('Asciugamani corpo', 'Asciugamani e bagno', 'pezzi', 8, 3, 8, null),
    ('Tappetini doccia', 'Asciugamani e bagno', 'pezzi', 4, 2, 4, null),
    ('Mappine cucina', 'Cucina', 'pezzi', 4, 2, 4, null),
    ('Coperte divano', 'Lenzuola e coperte', 'pezzi', 2, 1, 2, null),
    ('Piumino pesante', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('Piumino primaverile', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('Completi letto completi', 'Lenzuola e coperte', 'set', 4, 2, 4, null),
    ('Copripiumini + federe', 'Lenzuola e coperte', 'set', 4, 2, 4, null),
    ('Lenzuolo sotto extra', 'Lenzuola e coperte', 'pezzi', 1, 0, 1, null),
    ('Cambio teli divano', 'Lenzuola e coperte', 'set', 1, 0, 1, null),
    ('Caffe cialde', 'Caffe', 'cialde', 36, 10, 36, null),
    ('Sapone liquido mani/corpo', 'Prodotti per pulizia', 'lt', 5, 2, 5, null),
    ('Sapone piatti', 'Prodotti per pulizia', 'lt', 5, 2, 5, null),
    ('Lavapavimenti', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('WC Net', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Carta igienica', 'Prodotti per pulizia', 'rotoli', 20, 6, 20, null),
    ('Spugnette lavapiatti', 'Prodotti per pulizia', 'pezzi', 11, 3, 11, 1),
    ('Multiuso vetri', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Candeggina', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Spugnette morbide', 'Prodotti per pulizia', 'pezzi', 5, 2, 5, 1),
    ('Anticalcare', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Sgrassatore', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Disgorgante', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null),
    ('Viakal vetro doccia', 'Prodotti per pulizia', 'lt', 1, 0.3, 1, null)
),
updated as (
  update public.products p
  set
    category = s.category,
    unit = s.unit,
    quantity = s.quantity,
    threshold = s.threshold,
    max_qty = s.max_qty,
    consumption_per_checkout = s.consumption_per_checkout
  from seed s
  where lower(trim(p.name)) = lower(trim(s.name))
  returning 1
)
insert into public.products (name, category, unit, quantity, threshold, max_qty, consumption_per_checkout)
select s.name, s.category, s.unit, s.quantity, s.threshold, s.max_qty, s.consumption_per_checkout
from seed s
where not exists (
  select 1
  from public.products p
  where lower(trim(p.name)) = lower(trim(s.name))
);
