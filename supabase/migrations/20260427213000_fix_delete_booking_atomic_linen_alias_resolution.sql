create or replace function public.delete_booking_atomic(
  p_booking_id uuid,
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

  v := greatest(0, coalesce((restore ->> 'sets_estivo')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc,
                    case lower(trim(coalesce(candidate.name, '''')))
                      when ''set letto estivo'' then 0
                      when ''completi letto completi'' then 1
                      else 99
                    end
           limit 1
        )',
      qty_col
    ) using v, array['set letto estivo', 'completi letto completi'];
  end if;

  v := greatest(0, coalesce((restore ->> 'sets_invernale')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc,
                    case lower(trim(coalesce(candidate.name, '''')))
                      when ''set letto invernale'' then 0
                      when ''copripiumini + federe'' then 1
                      else 99
                    end
           limit 1
        )',
      qty_col
    ) using v, array['set letto invernale', 'copripiumini + federe'];
  end if;

  v := greatest(0, coalesce((restore ->> 'towels_bidet')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['asciugamani bidet'];
  end if;

  v := greatest(0, coalesce((restore ->> 'towels_viso')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['asciugamani viso'];
  end if;

  v := greatest(0, coalesce((restore ->> 'towels_doccia')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['asciugamani doccia'];
  end if;

  v := greatest(0, coalesce((restore ->> 'tappetino')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['tappetini doccia'];
  end if;

  v := greatest(0, coalesce((restore ->> 'mappine')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['mappine cucina'];
  end if;

  v := greatest(0, coalesce((restore ->> 'carta_igienica')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['carta igienica'];
  end if;

  v := greatest(0, coalesce((restore ->> 'spugne_piatti')::numeric, 0));
  if v > 0 then
    execute format(
      'update public.products p
          set %1$I = coalesce(p.%1$I, 0) + $1
        where p.ctid = (
          select candidate.ctid
            from public.products candidate
           where lower(trim(coalesce(candidate.name, ''''))) = any($2)
           order by coalesce(candidate.%1$I, 0) desc
           limit 1
        )',
      qty_col
    ) using v, array['spugnette lavapiatti'];
  end if;

  delete from public.action_checklist
   where action_id in (
     select id
       from public.actions
      where booking_id = p_booking_id
   );

  delete from public.actions
   where booking_id = p_booking_id;

  delete from public.bookings
   where id = p_booking_id;
end;
$$;
