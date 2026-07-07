-- Impedisce duplicati di spese automatiche generate dalla stessa azione
-- (pulizia esterna / lavatrici / rifornimento). Indice parziale: non si
-- applica alle spese manuali ne' a quelle di restock, che hanno sempre
-- source_action_id null.
create unique index if not exists expenses_org_source_action_origin_key
  on public.expenses (organization_id, source_action_id, origin)
  where source_action_id is not null;
