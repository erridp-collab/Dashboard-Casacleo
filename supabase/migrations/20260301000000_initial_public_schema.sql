


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."_checklist_items"("p_action_type" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_action_type
    when 'PULIZIA' then array[
      'Bagno: WC/bidet/doccia + lavandino/specchio',
      'Cucina: piano/lavello + controllo stoviglie',
      'Rifiuti: svuota e sostituisci sacchetti',
      'Camera/Soggiorno: spolvero superfici',
      'Pavimenti: aspira/lava',
      'Biancheria: cambio set letto + set asciugamani',
      'Controlli: luci/telecomandi/chiavi + eventuali danni'
    ]
    when 'LAVATRICI' then array[
      'Raccolta biancheria sporca',
      'Lavatrice: lenzuola/federe (60°)',
      'Lavatrice: asciugamani (60°)',
      'Asciugatrice / stendi',
      'Piega e riponi biancheria pulita',
      'Controlla detersivo/ammorbidente'
    ]
    when 'PREPARA_LETTO' then array[
      'Coprimaterasso pulito',
      'Lenzuolo sotto',
      'Lenzuolo sopra / copripiumino',
      'Federe cuscini',
      'Asciugamani puliti in bagno',
      'Controllo visivo finale'
    ]
    when 'MANUT3' then array[
      'Controllo interruttori/prese',
      'Verifica perdite rubinetti/scarichi',
      'Test rilevatore fumo/CO',
      'Controllo estintore',
      'Verifica serrature'
    ]
    when 'MANUT4' then array[
      'Ispezione caldaia/boiler',
      'Pulizia filtri A/C',
      'Controllo kit pronto soccorso',
      'Verifica materassi/reti',
      'Test elettrodomestici'
    ]
    else array[]::text[]
  end;
$$;


ALTER FUNCTION "public"."_checklist_items"("p_action_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_create_action"("p_booking_id" "uuid", "p_action_date" "date", "p_action_type" "text", "p_details" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_action_id uuid;
  v_items text[];
begin
  insert into public.actions(booking_id, action_date, action_type, status, details, amount)
  values (p_booking_id, p_action_date, p_action_type, 'DA_FARE', p_details, 0)
  returning id into v_action_id;

  v_items := public._checklist_items(p_action_type);

  if array_length(v_items, 1) is not null then
    insert into public.action_checklist(action_id, item, done)
    select v_action_id, x, false
    from unnest(v_items) as x;
  end if;

  return v_action_id;
end;
$$;


ALTER FUNCTION "public"."_create_action"("p_booking_id" "uuid", "p_action_date" "date", "p_action_type" "text", "p_details" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_product_quantity_deltas_atomic"("p_deltas" "jsonb", "p_cap_to_max_qty" boolean DEFAULT false, "p_floor_at_zero" boolean DEFAULT true) RETURNS TABLE("product_id" "text", "previous_qty" numeric, "next_qty" numeric, "applied_delta" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  id_col text;
  qty_col text;
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

    execute format(
      'select coalesce(%1$I, 0)::numeric, max_qty::numeric from public.products where %2$I = $1 for update',
      qty_col,
      id_col
    )
    into v_previous_qty, v_max_qty
    using v_product_id;

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

    execute format(
      'update public.products set %1$I = $1 where %2$I = $2',
      qty_col,
      id_col
    )
    using v_next_qty, v_product_id;

    product_id := v_product_id;
    previous_qty := v_previous_qty;
    next_qty := v_next_qty;
    applied_delta := round(v_next_qty - v_previous_qty, 2);
    return next;
  end loop;

  return;
end;
$_$;


ALTER FUNCTION "public"."apply_product_quantity_deltas_atomic"("p_deltas" "jsonb", "p_cap_to_max_qty" boolean, "p_floor_at_zero" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_check_in date := (payload->>'check_in')::date;
  v_check_out date := (payload->>'check_out')::date;
  v_guests int := (payload->>'guests')::int;
  v_channel text := nullif(payload->>'channel','');
  v_notes text := nullif(payload->>'notes','');

  v_booking_id uuid;
  v_counter int;

  v_prev_day date := v_check_in - 1;

  -- consumo biancheria (regole come nel tuo codice Python)
  v_used_completi int := ceiling(v_guests / 2.0);
  v_used_corpo int := v_guests;
  v_used_doccia int := v_guests;
  v_used_bidet int := v_guests;

  v_need_lav boolean := false;
begin
  if v_check_out <= v_check_in then
    raise exception 'check_out must be after check_in';
  end if;

  insert into public.bookings(check_in, check_out, guests, channel, notes, revenue)
  values (v_check_in, v_check_out, v_guests, v_channel, v_notes, 0)
  returning id into v_booking_id;

  -- increment booking_counter
  update public.counters
  set value = ((value::int) + 1)::text
  where key = 'booking_counter';

  select value::int into v_counter
  from public.counters
  where key = 'booking_counter';

  -- Azione: PULIZIA al check_out
  perform public._create_action(v_booking_id, v_check_out, 'PULIZIA', null);

  -- Azione: PREPARA_LETTO al check_in solo se NON c'è check-out il check_in o il giorno prima
  if not exists (
    select 1
    from public.bookings b
    where b.id <> v_booking_id
      and b.check_out in (v_check_in, v_prev_day)
  ) then
    perform public._create_action(v_booking_id, v_check_in, 'PREPARA_LETTO', null);
  end if;

  -- Serve LAVATRICI se (qty - used) <= threshold su uno degli sku biancheria_auto
  with b as (
    select sku, qty, threshold
    from public.products
    where category = 'biancheria_auto'
      and sku in ('completi_letto','asciug_corpo','asciug_doccia','asciug_bidet')
  ),
  chk as (
    select
      sku,
      qty,
      threshold,
      case sku
        when 'completi_letto' then v_used_completi::numeric
        when 'asciug_corpo' then v_used_corpo::numeric
        when 'asciug_doccia' then v_used_doccia::numeric
        when 'asciug_bidet' then v_used_bidet::numeric
        else 0::numeric
      end as used
    from b
  )
  select exists (
    select 1
    from chk
    where (qty - used) <= threshold
  ) into v_need_lav;

  if v_need_lav then
    perform public._create_action(v_booking_id, v_check_out, 'LAVATRICI', null);
  end if;

  -- Applica consumo biancheria (clamp a >= 0)
  update public.products set qty = greatest(qty - v_used_completi, 0) where sku = 'completi_letto';
  update public.products set qty = greatest(qty - v_used_corpo, 0) where sku = 'asciug_corpo';
  update public.products set qty = greatest(qty - v_used_doccia, 0) where sku = 'asciug_doccia';
  update public.products set qty = greatest(qty - v_used_bidet, 0) where sku = 'asciug_bidet';

  -- Manutenzioni ogni 3 / ogni 4
  if (v_counter % 3) = 0 then
    perform public._create_action(v_booking_id, v_check_out, 'MANUT3', null);
  end if;

  if (v_counter % 4) = 0 then
    perform public._create_action(v_booking_id, v_check_out, 'MANUT4', null);
  end if;

  return jsonb_build_object('booking_id', v_booking_id);
end;
$$;


ALTER FUNCTION "public"."create_booking"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_booking_atomic"("p_booking_id" "uuid", "p_linen_restore" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."delete_booking_atomic"("p_booking_id" "uuid", "p_linen_restore" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_auth_rate_limits_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_auth_rate_limits_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "done" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."action_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "action_date" "date" NOT NULL,
    "action_type" "text" NOT NULL,
    "status" "text" DEFAULT 'DA_FARE'::"text" NOT NULL,
    "details" "text",
    "amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "actions_status_check" CHECK (("status" = ANY (ARRAY['DA_FARE'::"text", 'FATTO'::"text"])))
);


ALTER TABLE "public"."actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_rate_limits" (
    "ip" "text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "guests" integer NOT NULL,
    "channel" "text",
    "notes" "text",
    "revenue" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_amount" numeric,
    CONSTRAINT "booking_dates_ok" CHECK (("check_out" > "check_in")),
    CONSTRAINT "bookings_guests_check" CHECK (("guests" >= 1))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."counters" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_date" "date" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "origin" "text" DEFAULT 'manuale'::"text",
    "source_action_id" "uuid"
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" DEFAULT 'pz'::"text" NOT NULL,
    "category" "text" NOT NULL,
    "qty" numeric DEFAULT 0 NOT NULL,
    "threshold" numeric DEFAULT 0 NOT NULL,
    "max_qty" numeric DEFAULT 0 NOT NULL,
    "consumption_per_checkout" numeric DEFAULT 0 NOT NULL,
    "stock_status" "text",
    CONSTRAINT "products_stock_status_check" CHECK (("stock_status" = ANY (ARRAY['PIENO'::"text", 'A_META'::"text", 'TERMINATO'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_checklist"
    ADD CONSTRAINT "action_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_rate_limits"
    ADD CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("ip");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."counters"
    ADD CONSTRAINT "counters_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("sku");



CREATE INDEX "auth_rate_limits_reset_at_idx" ON "public"."auth_rate_limits" USING "btree" ("reset_at");



CREATE INDEX "idx_actions_date" ON "public"."actions" USING "btree" ("action_date");



CREATE INDEX "idx_actions_type" ON "public"."actions" USING "btree" ("action_type");



CREATE INDEX "idx_bookings_dates" ON "public"."bookings" USING "btree" ("check_in", "check_out");



CREATE INDEX "idx_checklist_action" ON "public"."action_checklist" USING "btree" ("action_id");



CREATE OR REPLACE TRIGGER "auth_rate_limits_set_updated_at" BEFORE UPDATE ON "public"."auth_rate_limits" FOR EACH ROW EXECUTE FUNCTION "public"."touch_auth_rate_limits_updated_at"();



ALTER TABLE ONLY "public"."action_checklist"
    ADD CONSTRAINT "action_checklist_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "actions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_checklist_items"("p_action_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_checklist_items"("p_action_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_checklist_items"("p_action_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_create_action"("p_booking_id" "uuid", "p_action_date" "date", "p_action_type" "text", "p_details" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_create_action"("p_booking_id" "uuid", "p_action_date" "date", "p_action_type" "text", "p_details" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_create_action"("p_booking_id" "uuid", "p_action_date" "date", "p_action_type" "text", "p_details" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_product_quantity_deltas_atomic"("p_deltas" "jsonb", "p_cap_to_max_qty" boolean, "p_floor_at_zero" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_product_quantity_deltas_atomic"("p_deltas" "jsonb", "p_cap_to_max_qty" boolean, "p_floor_at_zero" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_product_quantity_deltas_atomic"("p_deltas" "jsonb", "p_cap_to_max_qty" boolean, "p_floor_at_zero" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking"("payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_booking_atomic"("p_booking_id" "uuid", "p_linen_restore" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_booking_atomic"("p_booking_id" "uuid", "p_linen_restore" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_booking_atomic"("p_booking_id" "uuid", "p_linen_restore" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_auth_rate_limits_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_auth_rate_limits_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_auth_rate_limits_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."action_checklist" TO "anon";
GRANT ALL ON TABLE "public"."action_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."action_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."actions" TO "anon";
GRANT ALL ON TABLE "public"."actions" TO "authenticated";
GRANT ALL ON TABLE "public"."actions" TO "service_role";



GRANT ALL ON TABLE "public"."auth_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."auth_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."counters" TO "anon";
GRANT ALL ON TABLE "public"."counters" TO "authenticated";
GRANT ALL ON TABLE "public"."counters" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







