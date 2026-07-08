-- supabase/migrations/20260708110000_drop_products_sku_not_null.sql
--
-- products.sku was the original primary key before the multi-tenant migration
-- (20260507150000_add_multi_tenant_foundation.sql) introduced the surrogate
-- `id` uuid column and moved the primary key to it. That migration never
-- relaxed the NOT NULL constraint on `sku`, leaving it as a required column
-- that the application no longer populates on insert (app/api/products/route.ts
-- only sets `sku` when resolveProductSchema() detects the legacy schema shape,
-- which never happens now that `id` exists). This caused every new product
-- creation ("Aggiungi biancheria" / "Aggiungi consumabile") to fail with:
--   null value in column "sku" of relation "products" violates not-null constraint

alter table public.products
  alter column sku drop not null;
