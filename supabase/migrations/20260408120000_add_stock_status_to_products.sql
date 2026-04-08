-- Add stock_status column to products for simplified 3-state tracking
alter table public.products
  add column if not exists stock_status text check (stock_status in ('PIENO', 'A_META', 'TERMINATO')) default null;
