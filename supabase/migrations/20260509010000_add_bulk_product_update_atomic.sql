-- Aggiorna prodotti in modo atomico (transazione singola).
-- p_updates: array di oggetti {id, quantity, threshold, max_qty, consumption_per_checkout}
-- Se uno degli update fallisce, l'intera operazione fa rollback.
create or replace function public.bulk_update_products(
  p_updates jsonb,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_payload jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_updates) loop
    v_product_id := (v_item->>'id')::uuid;
    
    v_payload := '{}'::jsonb;
    
    if v_item ? 'quantity' then
      v_payload := jsonb_set(v_payload, '{qty}', v_item->'quantity');
    end if;
    
    if v_item ? 'threshold' then
      v_payload := jsonb_set(v_payload, '{threshold}', v_item->'threshold');
    end if;
    
    if v_item ? 'max_qty' then
      v_payload := jsonb_set(v_payload, '{max_qty}', v_item->'max_qty');
    end if;
    
    if v_item ? 'consumption_per_checkout' then
      v_payload := jsonb_set(v_payload, '{consumption_per_checkout}', v_item->'consumption_per_checkout');
    end if;

    if v_payload = '{}'::jsonb then
      continue;
    end if;

    update public.products
    set
      qty = case when v_payload ? 'qty' then (v_payload->>'qty')::numeric else qty end,
      threshold = case when v_payload ? 'threshold' then (v_payload->>'threshold')::numeric else threshold end,
      max_qty = case when v_payload ? 'max_qty' then (v_payload->>'max_qty')::numeric else max_qty end,
      consumption_per_checkout = case when v_payload ? 'consumption_per_checkout' then (v_payload->>'consumption_per_checkout')::numeric else consumption_per_checkout end
    where id = v_product_id
      and organization_id = p_organization_id;

    if not found then
      raise exception 'product % not found in organization %', v_product_id, p_organization_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.bulk_update_products(jsonb, uuid) from anon;
revoke all on function public.bulk_update_products(jsonb, uuid) from authenticated;
grant execute on function public.bulk_update_products(jsonb, uuid) to service_role;
