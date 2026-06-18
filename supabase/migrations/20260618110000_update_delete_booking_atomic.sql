-- supabase/migrations/20260618110000_update_delete_booking_atomic.sql
-- Aggiorna delete_booking_atomic per usare linen_role invece di match per nome.
-- La firma rimane identica per backward compatibility.

create or replace function public.delete_booking_atomic(
  p_booking_id uuid,
  p_organization_id uuid,
  p_linen_restore jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  qty_col text;
  restore jsonb := coalesce(p_linen_restore, '{}'::jsonb);
  v numeric;
begin
  if not exists (
    select 1
      from public.bookings
     where id = p_booking_id
       and organization_id = p_organization_id
  ) then
    raise exception 'booking not found or access denied';
  end if;

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
    raise exception 'products table has neither quantity nor qty column';
  end if;

  -- Restore biancheria usando linen_role (con fallback name-based se il prodotto non ha ancora un ruolo)
  v := greatest(0, coalesce((restore ->> 'sets_estivo')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'set_estivo',
      array['set letto estivo', 'completi letto completi'];
  end if;

  v := greatest(0, coalesce((restore ->> 'sets_invernale')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'set_invernale',
      array['set letto invernale', 'copripiumini + federe'];
  end if;

  v := greatest(0, coalesce((restore ->> 'towels_bidet')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'asciugamano_bidet',
      array['asciugamani bidet'];
  end if;

  -- towels_viso ripristina sia asciugamano_viso che asciugamano_corpo (comportamento esistente)
  v := greatest(0, coalesce((restore ->> 'towels_viso')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = any($3)
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id,
      array['asciugamano_viso', 'asciugamano_corpo'],
      array['asciugamani viso', 'asciugamani corpo'];
  end if;

  v := greatest(0, coalesce((restore ->> 'towels_doccia')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'asciugamano_doccia',
      array['asciugamani doccia'];
  end if;

  v := greatest(0, coalesce((restore ->> 'tappetino')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'tappetino_doccia',
      array['tappetini doccia'];
  end if;

  v := greatest(0, coalesce((restore ->> 'mappine')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where organization_id = $2
          and (linen_role = $3
            or (linen_role is null and lower(trim(coalesce(name, ''''))) = any($4)))',
      qty_col
    ) using v, p_organization_id, 'mappina_cucina',
      array['mappine cucina'];
  end if;

  -- carta_igienica e spugne_piatti: non hanno linen_role, match per nome come prima
  v := greatest(0, coalesce((restore ->> 'carta_igienica')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where lower(trim(coalesce(name, ''''))) = any($2)
          and organization_id = $3',
      qty_col
    ) using v, array['carta igienica'], p_organization_id;
  end if;

  v := greatest(0, coalesce((restore ->> 'spugne_piatti')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products
          set %1$I = coalesce(%1$I, 0) + $1
        where lower(trim(coalesce(name, ''''))) = any($2)
          and organization_id = $3',
      qty_col
    ) using v, array['spugnette lavapiatti'], p_organization_id;
  end if;

  delete from public.action_checklist
   where action_id in (
     select id
       from public.actions
      where booking_id = p_booking_id
        and organization_id = p_organization_id
   );

  delete from public.actions
   where booking_id = p_booking_id
     and organization_id = p_organization_id;

  delete from public.bookings
   where id = p_booking_id
     and organization_id = p_organization_id;
end;
$$;

grant execute on function public.delete_booking_atomic(uuid, uuid, jsonb) to service_role;
grant execute on function public.delete_booking_atomic(uuid, uuid, jsonb) to authenticated;
