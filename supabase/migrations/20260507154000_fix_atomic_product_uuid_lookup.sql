create or replace function public.apply_product_quantity_deltas_atomic(
  p_deltas jsonb,
  p_cap_to_max_qty boolean default false,
  p_floor_at_zero boolean default true
)
returns table(product_id text, previous_qty numeric, next_qty numeric, applied_delta numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  id_col text;
  qty_col text;
  id_is_uuid boolean;
  item jsonb;
  v_product_id text;
  v_delta numeric;
  v_previous_qty numeric;
  v_next_qty numeric;
  v_max_qty numeric;
begin
  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = 'id'
    ) then 'id'
    else 'sku'
  end
  into id_col;

  id_is_uuid := id_col = 'id';

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = 'quantity'
    ) then 'quantity'
    else 'qty'
  end
  into qty_col;

  for item in
    select value
    from jsonb_array_elements(coalesce(p_deltas, '[]'::jsonb))
  loop
    v_product_id := nullif(trim(item ->> 'product_id'), '');
    if v_product_id is null then
      continue;
    end if;

    begin
      v_delta := round(coalesce((item ->> 'delta')::numeric, 0), 2);
    exception
      when others then
        continue;
    end;

    if v_delta = 0 then
      continue;
    end if;

    if id_is_uuid then
      execute format(
        'select coalesce(%1$I, 0)::numeric, max_qty::numeric from public.products where %2$I = $1::uuid for update',
        qty_col,
        id_col
      )
      into v_previous_qty, v_max_qty
      using v_product_id;
    else
      execute format(
        'select coalesce(%1$I, 0)::numeric, max_qty::numeric from public.products where %2$I = $1 for update',
        qty_col,
        id_col
      )
      into v_previous_qty, v_max_qty
      using v_product_id;
    end if;

    if not found then
      continue;
    end if;

    v_previous_qty := round(coalesce(v_previous_qty, 0), 2);
    v_next_qty := round(v_previous_qty + v_delta, 2);

    if p_floor_at_zero and v_next_qty < 0 then
      v_next_qty := 0;
    end if;

    if p_cap_to_max_qty and coalesce(v_max_qty, 0) > 0 and v_next_qty > v_max_qty then
      v_next_qty := round(v_max_qty, 2);
    end if;

    if id_is_uuid then
      execute format(
        'update public.products set %1$I = $1 where %2$I = $2::uuid',
        qty_col,
        id_col
      )
      using v_next_qty, v_product_id;
    else
      execute format(
        'update public.products set %1$I = $1 where %2$I = $2',
        qty_col,
        id_col
      )
      using v_next_qty, v_product_id;
    end if;

    product_id := v_product_id;
    previous_qty := v_previous_qty;
    next_qty := v_next_qty;
    applied_delta := round(v_next_qty - v_previous_qty, 2);
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) from anon;
revoke all on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) from authenticated;
grant execute on function public.apply_product_quantity_deltas_atomic(jsonb, boolean, boolean) to service_role;
