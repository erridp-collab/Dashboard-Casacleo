# Product Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere CRUD completo per prodotti e biancheria con sistema di ruoli che mantiene l'automazione prenotazioni, accessibile da onboarding e impostazioni.

**Architecture:** Una colonna `linen_role` TEXT nullable sulla tabella `products` sostituisce i match hardcoded su nome/SKU sia nel SQL (`delete_booking_atomic`) che nel TypeScript (`lib/stock.ts`). Un componente `ProductCatalogEditor` client-side gestisce il CRUD ed è riutilizzato in onboarding e settings.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), TypeScript, Tailwind CSS. Pattern esistenti: `requireRouteContext()` per auth, `errJson`/`okJson` per API responses, `clientFetchJson` per fetch client, `toast` per feedback, `Card`/`CardHeader` per layout.

**Vincolo:** Rispettare i pattern del codice esistente. Non modificare logiche fuori scope (prenotazioni, spese, azioni, checklist).

---

## Mappa file

| File | Tipo | Responsabilità |
|---|---|---|
| `supabase/migrations/20260618100000_add_linen_role.sql` | Nuovo | Colonna linen_role + index unicità + mapping retroattivo |
| `supabase/migrations/20260618110000_update_delete_booking_atomic.sql` | Nuovo | Aggiorna delete_booking_atomic per usare linen_role |
| `lib/linen-roles.ts` | Nuovo | Costanti: tipo LinenRole, array LINEN_ROLES con label e formula |
| `lib/stock.ts` | Modifica | Aggiorna getBookingConsumptionMap e shouldIncludeInShoppingList |
| `lib/refill.ts` | Modifica | Aggiorna isQuantityManagedRefillProduct per riconoscere linen_role |
| `app/api/products/route.ts` | Modifica | Aggiunge handler POST + linen_role nel GET response |
| `app/api/products/[id]/route.ts` | Nuovo | Handler PATCH (metadati) e DELETE |
| `components/product-catalog-editor.tsx` | Nuovo | Componente CRUD tab Biancheria/Consumabili |
| `app/onboarding/page.tsx` | Modifica | Aggiunge sezione prodotti sotto il form workspace |
| `app/settings/page.tsx` | Modifica | Aggiunge card "Prodotti & Biancheria" |

---

## Task 1: Migration — colonna linen_role

**Files:**
- Create: `supabase/migrations/20260618100000_add_linen_role.sql`

- [ ] **Step 1.1: Crea il file di migrazione**

```sql
-- supabase/migrations/20260618100000_add_linen_role.sql

alter table public.products
  add column if not exists linen_role text default null;

alter table public.products
  drop constraint if exists products_linen_role_check;

alter table public.products
  add constraint products_linen_role_check check (
    linen_role is null or linen_role = any(array[
      'set_estivo',
      'set_invernale',
      'asciugamano_corpo',
      'asciugamano_doccia',
      'asciugamano_bidet',
      'asciugamano_viso',
      'tappetino_doccia',
      'mappina_cucina'
    ])
  );

drop index if exists public.products_linen_role_org_unique;

create unique index products_linen_role_org_unique
  on public.products (organization_id, linen_role)
  where linen_role is not null;

-- Mapping retroattivo: assegna linen_role ai prodotti esistenti per nome/sku
update public.products set linen_role = 'set_estivo'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) in ('set_letto_estivo', 'completi_letto')
      or lower(trim(coalesce(name, ''))) in ('set letto estivo', 'completi letto completi')
    );

update public.products set linen_role = 'set_invernale'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) in ('set_letto_invernale', 'copripiumini_federe')
      or lower(trim(coalesce(name, ''))) in ('set letto invernale', 'copripiumini + federe')
    );

update public.products set linen_role = 'asciugamano_corpo'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_corpo'
      or lower(trim(coalesce(name, ''))) = 'asciugamani corpo'
    );

update public.products set linen_role = 'asciugamano_doccia'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_doccia'
      or lower(trim(coalesce(name, ''))) = 'asciugamani doccia'
    );

update public.products set linen_role = 'asciugamano_bidet'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_bidet'
      or lower(trim(coalesce(name, ''))) = 'asciugamani bidet'
    );

update public.products set linen_role = 'asciugamano_viso'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'asciug_viso'
      or lower(trim(coalesce(name, ''))) = 'asciugamani viso'
    );

update public.products set linen_role = 'tappetino_doccia'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'tappetini_doccia'
      or lower(trim(coalesce(name, ''))) = 'tappetini doccia'
    );

update public.products set linen_role = 'mappina_cucina'
  where linen_role is null
    and (
      lower(trim(coalesce(sku, ''))) = 'mappine_cucina'
      or lower(trim(coalesce(name, ''))) = 'mappine cucina'
    );
```

- [ ] **Step 1.2: Applica la migrazione a Supabase**

```bash
npx supabase db push
```

Verifica che non ci siano errori. Se il DB locale non è in esecuzione, applicala dalla dashboard Supabase via SQL editor.

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/20260618100000_add_linen_role.sql
git commit -m "feat(db): add linen_role column with retroactive mapping"
```

---

## Task 2: Migration — aggiorna delete_booking_atomic

**Files:**
- Create: `supabase/migrations/20260618110000_update_delete_booking_atomic.sql`

- [ ] **Step 2.1: Crea il file di migrazione**

```sql
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
```

- [ ] **Step 2.2: Applica la migrazione**

```bash
npx supabase db push
```

- [ ] **Step 2.3: Commit**

```bash
git add supabase/migrations/20260618110000_update_delete_booking_atomic.sql
git commit -m "feat(db): update delete_booking_atomic to use linen_role"
```

---

## Task 3: lib/linen-roles.ts — costanti

**Files:**
- Create: `lib/linen-roles.ts`

- [ ] **Step 3.1: Crea il file**

```typescript
// lib/linen-roles.ts

export type LinenRole =
  | "set_estivo"
  | "set_invernale"
  | "asciugamano_corpo"
  | "asciugamano_doccia"
  | "asciugamano_bidet"
  | "asciugamano_viso"
  | "tappetino_doccia"
  | "mappina_cucina";

export const LINEN_ROLE_VALUES: ReadonlySet<string> = new Set<LinenRole>([
  "set_estivo",
  "set_invernale",
  "asciugamano_corpo",
  "asciugamano_doccia",
  "asciugamano_bidet",
  "asciugamano_viso",
  "tappetino_doccia",
  "mappina_cucina",
]);

export type LinenRoleInfo = {
  value: LinenRole;
  label: string;
  formulaLabel: string;
  consumption: (guests: number) => number;
};

export const LINEN_ROLES: LinenRoleInfo[] = [
  {
    value: "set_estivo",
    label: "Set letto estivo",
    formulaLabel: "1 ogni 2 ospiti per prenotazione",
    consumption: (guests) => Math.ceil(guests / 2),
  },
  {
    value: "set_invernale",
    label: "Set letto invernale",
    formulaLabel: "1 ogni 2 ospiti per prenotazione",
    consumption: (guests) => Math.ceil(guests / 2),
  },
  {
    value: "asciugamano_corpo",
    label: "Asciugamano corpo",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_doccia",
    label: "Asciugamano doccia",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_bidet",
    label: "Asciugamano bidet",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_viso",
    label: "Asciugamano viso",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "tappetino_doccia",
    label: "Tappetino doccia",
    formulaLabel: "1 fisso per prenotazione",
    consumption: () => 1,
  },
  {
    value: "mappina_cucina",
    label: "Mappina cucina",
    formulaLabel: "1 fisso per prenotazione",
    consumption: () => 1,
  },
];

export function isLinenRole(value: unknown): value is LinenRole {
  return typeof value === "string" && LINEN_ROLE_VALUES.has(value);
}
```

- [ ] **Step 3.2: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Atteso: zero errori.

- [ ] **Step 3.3: Commit**

```bash
git add lib/linen-roles.ts
git commit -m "feat: add linen-roles constants"
```

---

## Task 4: lib/stock.ts — aggiorna consumption logic

**Files:**
- Modify: `lib/stock.ts`

Il file attualmente usa `getBookingConsumptionMap` che mappa nomi prodotto → quantità. Aggiorniamo `applyBookingConsumptionDelta` per usare prima i ruoli (linen_role), poi cadere sul match per nome come fallback.

- [ ] **Step 4.1: Aggiungi import e funzione getLinenRoleConsumptionMap**

Dopo l'import esistente di `parseLocalDateIT, todayLocalIT` in cima a `lib/stock.ts`, aggiungi:

```typescript
import { LINEN_ROLES, isLinenRole, type LinenRole } from "@/lib/linen-roles";
```

Dopo la funzione `getBookingConsumptionMap` esistente, aggiungi la nuova funzione:

```typescript
export function getLinenRoleConsumptionMap(guests: number): Map<LinenRole, number> {
  const map = new Map<LinenRole, number>();
  if (guests <= 0) return map;
  for (const role of LINEN_ROLES) {
    const qty = role.consumption(guests);
    if (qty > 0) map.set(role.value, qty);
  }
  return map;
}
```

- [ ] **Step 4.2: Aggiorna applyBookingConsumptionDelta per usare linen_role**

Sostituisci il body di `applyBookingConsumptionDelta` con la versione aggiornata che cerca prima per `linen_role`, poi fallback su nome:

La funzione `applyBookingConsumptionDelta` (da riga ~251 in `lib/stock.ts`) diventa:

```typescript
export async function applyBookingConsumptionDelta(
  checkIn: string,
  checkOut: string,
  guests: number,
  direction: 1 | -1,
  organizationId?: string,
): Promise<void> {
  const consumptionByName = getBookingConsumptionMap(checkIn, checkOut, guests);
  const consumptionByRole = getLinenRoleConsumptionMap(guests);

  const supabase = supabaseAdmin();
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  if (!resolvedOrganizationId) throw new Error("Unable to resolve organization");
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, category, ${schema.quantityColumn}, consumption_per_checkout, linen_role`)
    .eq("organization_id", resolvedOrganizationId);
  if (error) throw new Error(error.message);

  const deltas: Array<{ id: string; currentQty: number; delta: number }> = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const rawName = String(row.name ?? "");
    const normalized = normalizeProductName(rawName);
    const category = row.category === null || row.category === undefined ? null : String(row.category);
    const rawRole = row.linen_role;

    let consume = 0;

    if (isLinenRole(rawRole)) {
      consume = consumptionByRole.get(rawRole) ?? 0;
    } else {
      consume = consumptionByName.get(normalized) ?? 0;
    }

    const perCheckoutConsume = isQuantityManagedRefillProduct({ name: rawName, category })
      ? toFixedNumber(row.consumption_per_checkout, 0)
      : 0;
    consume += Math.max(0, perCheckoutConsume);

    if (consume <= 0) continue;

    const productId = getProductId(row, schema);
    if (!productId) continue;

    const currentQty = getProductQuantity(row, schema);
    deltas.push({
      id: productId,
      currentQty,
      delta: Number((-consume * direction).toFixed(2)),
    });
  }

  await applyProductQuantityDeltas(supabase, schema, deltas, {
    floorAtZero: true,
  });

  await syncShoppingAction(resolvedOrganizationId);
}
```

- [ ] **Step 4.3: Aggiorna shouldIncludeInShoppingList per escludere prodotti con linen_role**

La firma della funzione diventa:

```typescript
export function shouldIncludeInShoppingList(product: Pick<StockProduct, "name" | "unit"> & { category?: string | null; linen_role?: string | null }): boolean {
  if (product.linen_role && LINEN_ROLE_VALUES.has(product.linen_role)) return false;

  const category = String(product.category ?? "").toUpperCase();
  const name = String(product.name ?? "").toUpperCase();

  if (name === "LENZUOLO SOTTO EXTRA") return false;

  if (
    category === "ASCIUGAMANI E BAGNO" ||
    category === "LENZUOLA E COPERTE" ||
    category === "TESSILI E BIANCHERIA"
  ) {
    return false;
  }
  if (
    name.includes("ASCIUGAMANI") ||
    name.includes("LENZUO") ||
    name.includes("FEDER") ||
    name.includes("COPRIPIUM") ||
    name.includes("TAPPETINI") ||
    name.includes("PIUMINO")
  ) {
    return false;
  }

  return true;
}
```

Aggiungi l'import mancante in cima a `lib/stock.ts`:

```typescript
import { LINEN_ROLES, LINEN_ROLE_VALUES, isLinenRole, type LinenRole } from "@/lib/linen-roles";
```

- [ ] **Step 4.4: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Atteso: zero errori.

- [ ] **Step 4.5: Commit**

```bash
git add lib/stock.ts
git commit -m "feat: update booking consumption to use linen_role"
```

---

## Task 5: lib/refill.ts — riconosce linen_role

**Files:**
- Modify: `lib/refill.ts`

- [ ] **Step 5.1: Aggiorna RefillProduct type e isQuantityManagedRefillProduct**

In `lib/refill.ts`, aggiungi `linen_role` al tipo `RefillProduct` e aggiorna la funzione:

```typescript
import { LINEN_ROLE_VALUES } from "@/lib/linen-roles";

export type RefillProduct = {
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
  stockStatus?: StockStatus | null;
  linen_role?: string | null;
};

// ...

export function isQuantityManagedRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  if (product.linen_role && LINEN_ROLE_VALUES.has(product.linen_role)) return true;

  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;

  const categoryKey = normalizeCategory(product.category);
  if (QUANTITY_MANAGED_CATEGORIES.has(categoryKey)) return true;

  return (
    nameKey.includes("ASCIUGAMANI") ||
    nameKey.includes("LENZUO") ||
    nameKey.includes("FEDER") ||
    nameKey.includes("COPRIPIUM") ||
    nameKey.includes("TAPPETINI") ||
    nameKey.includes("MAPPIN") ||
    nameKey.includes("SET LETTO") ||
    nameKey.includes("PIUMINO")
  );
}
```

Aggiorna anche `isStatusManagedRefillProduct` per passare `linen_role`:

```typescript
export function isStatusManagedRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;
  return !isQuantityManagedRefillProduct(product);
}

export function isMonitoredRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;
  return isQuantityManagedRefillProduct(product) || isStatusManagedRefillProduct(product);
}
```

- [ ] **Step 5.2: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Atteso: zero errori. Se ci sono errori in `app/inventory/page.tsx` per il tipo `RefillProduct`, aggiungi `linen_role: product.linen_role ?? null` dove necessario.

- [ ] **Step 5.3: Commit**

```bash
git add lib/refill.ts
git commit -m "feat: update refill classification to use linen_role"
```

---

## Task 6: GET e POST /api/products

**Files:**
- Modify: `app/api/products/route.ts`

- [ ] **Step 6.1: Aggiungi linen_role al mapping GET**

Nel handler `GET`, aggiorna l'array `products` per includere `linen_role`:

```typescript
const products = (data ?? []).map((raw) => {
  const row = raw as Record<string, unknown>;
  return {
    id: getProductId(row, schema),
    name: String(row.name ?? ""),
    category: row.category === null || row.category === undefined ? null : String(row.category),
    unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
    quantity: getProductQuantity(row, schema),
    threshold: Number(row.threshold ?? 0) || 0,
    max_qty: row.max_qty === null || row.max_qty === undefined ? null : Number(row.max_qty),
    consumption_per_checkout:
      row.consumption_per_checkout === null || row.consumption_per_checkout === undefined
        ? null
        : Number(row.consumption_per_checkout),
    stock_status: row.stock_status === null || row.stock_status === undefined ? null : row.stock_status,
    linen_role: row.linen_role === null || row.linen_role === undefined ? null : String(row.linen_role),
    updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
  };
});
```

- [ ] **Step 6.2: Aggiungi handler POST**

Aggiungi in cima al file gli import necessari:

```typescript
import { isLinenRole } from "@/lib/linen-roles";
```

Aggiungi l'handler POST alla fine di `app/api/products/route.ts`:

```typescript
type CreateProductBody = {
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  linen_role?: unknown;
  quantity?: unknown;
  threshold?: unknown;
};

function generateSku(name: string): string {
  const slug = String(name)
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${slug}_${Date.now().toString(36)}`;
}

export async function POST(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as CreateProductBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return errJson("Il nome del prodotto è obbligatorio", 400);

    const linenRole = body.linen_role ?? null;
    if (linenRole !== null && !isLinenRole(linenRole)) {
      return errJson("Ruolo biancheria non valido", 400);
    }

    const supabase = supabaseAdmin();

    if (linenRole !== null) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("linen_role", linenRole)
        .limit(1)
        .maybeSingle();
      if (existing) return errJson("Ruolo già assegnato a un altro prodotto", 409);
    }

    const schema = await resolveProductSchema(supabase);
    const quantity = body.quantity !== undefined && body.quantity !== null
      ? Math.max(0, Number(body.quantity) || 0)
      : 0;
    const threshold = body.threshold !== undefined && body.threshold !== null
      ? Math.max(0, Number(body.threshold) || 0)
      : 0;
    const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "pz";
    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : (linenRole ? "Lenzuola e coperte" : "Generale");

    const record: Record<string, unknown> = {
      organization_id: organizationId,
      name,
      category,
      unit,
      threshold,
      linen_role: linenRole,
    };

    record[schema.quantityColumn] = quantity;
    record.max_qty = quantity;

    if (schema.idColumn === "sku") {
      record.sku = generateSku(name);
    }

    const { data: created, error } = await supabase
      .from("products")
      .insert(record)
      .select(`${schema.idColumn}, name, linen_role, category, unit`)
      .single();

    if (error) {
      if (error.code === "23505") return errJson("Prodotto già esistente", 409);
      return errJson(error.message, 400);
    }

    await syncShoppingAction(organizationId);
    return okJson({ product: created }, 201);
  } catch (e: unknown) {
    console.error("[POST /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}
```

Aggiungi `syncShoppingAction` agli import esistenti se non c'è già (è già importato nel file corrente).

- [ ] **Step 6.3: Verifica TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6.4: Commit**

```bash
git add app/api/products/route.ts
git commit -m "feat(api): add linen_role to GET products, add POST create product"
```

---

## Task 7: PATCH e DELETE /api/products/[id]

**Files:**
- Create: `app/api/products/[id]/route.ts`

- [ ] **Step 7.1: Crea il file**

```typescript
// app/api/products/[id]/route.ts
import { errJson, okJson } from "@/lib/http/apiResponse";
import { isLinenRole } from "@/lib/linen-roles";
import { requireRouteContext } from "@/lib/routeAuth";
import { resolveProductSchema } from "@/lib/products-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type PatchProductBody = {
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  linen_role?: unknown;
  threshold?: unknown;
  max_qty?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { id } = await params;
    if (!id) return errJson("Missing product id", 400);

    const body = (await req.json()) as PatchProductBody;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return errJson("Il nome non può essere vuoto", 400);
      updates.name = name;
    }

    if (body.category !== undefined) {
      updates.category = typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
    }

    if (body.unit !== undefined) {
      updates.unit = typeof body.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : null;
    }

    if ("linen_role" in body) {
      const role = body.linen_role;
      if (role !== null && role !== undefined && !isLinenRole(role)) {
        return errJson("Ruolo biancheria non valido", 400);
      }
      updates.linen_role = role ?? null;
    }

    if (body.threshold !== undefined) {
      const t = Number(body.threshold);
      if (!Number.isFinite(t) || t < 0) return errJson("Soglia non valida", 400);
      updates.threshold = t;
    }

    if (body.max_qty !== undefined) {
      const m = Number(body.max_qty);
      if (!Number.isFinite(m) || m < 0) return errJson("max_qty non valido", 400);
      updates.max_qty = m;
    }

    if (Object.keys(updates).length === 0) return errJson("Nessun campo da aggiornare", 400);

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    if ("linen_role" in updates && updates.linen_role !== null) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("linen_role", updates.linen_role as string)
        .neq(schema.idColumn, id)
        .limit(1)
        .maybeSingle();
      if (existing) return errJson("Ruolo già assegnato a un altro prodotto", 409);
    }

    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("organization_id", organizationId)
      .eq(schema.idColumn, id);

    if (error) return errJson(error.message, 400);

    await syncShoppingAction(organizationId);
    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { id } = await params;
    if (!id) return errJson("Missing product id", 400);

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("organization_id", organizationId)
      .eq(schema.idColumn, id);

    if (error) return errJson(error.message, 400);

    await syncShoppingAction(organizationId);
    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[DELETE /api/products/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}
```

- [ ] **Step 7.2: Verifica TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7.3: Commit**

```bash
git add "app/api/products/[id]/route.ts"
git commit -m "feat(api): add PATCH and DELETE /api/products/[id]"
```

---

## Task 8: ProductCatalogEditor component

**Files:**
- Create: `components/product-catalog-editor.tsx`

- [ ] **Step 8.1: Crea il componente**

```typescript
// components/product-catalog-editor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { toast } from "@/components/toast";
import { LINEN_ROLES, LINEN_ROLE_VALUES, type LinenRole } from "@/lib/linen-roles";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  threshold: number;
  max_qty: number | null;
  linen_role: LinenRole | null;
  stock_status: string | null;
};

type ProductsResponse = {
  products?: Array<Record<string, unknown>>;
};

type ModalState =
  | { mode: "closed" }
  | { mode: "add-linen" }
  | { mode: "add-consumable" }
  | { mode: "edit-linen"; product: ProductRow }
  | { mode: "edit-consumable"; product: ProductRow }
  | { mode: "delete"; product: ProductRow };

function isLinenProduct(p: ProductRow): boolean {
  return p.linen_role !== null || (p.max_qty !== null && p.max_qty > 0 && p.stock_status === null);
}

function normalizeProduct(raw: Record<string, unknown>): ProductRow {
  const qty = Number(raw.quantity ?? 0);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Prodotto"),
    category: raw.category == null ? null : String(raw.category),
    unit: raw.unit == null ? null : String(raw.unit),
    quantity: Number.isFinite(qty) ? qty : 0,
    threshold: Number(raw.threshold ?? 0) || 0,
    max_qty: raw.max_qty == null ? null : Number(raw.max_qty),
    linen_role: (raw.linen_role != null && LINEN_ROLE_VALUES.has(String(raw.linen_role)))
      ? (raw.linen_role as LinenRole)
      : null,
    stock_status: raw.stock_status == null ? null : String(raw.stock_status),
  };
}

export function ProductCatalogEditor() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"biancheria" | "consumabili">("biancheria");
  const abortRef = useRef<AbortController | null>(null);

  async function loadProducts(signal?: AbortSignal) {
    setLoading(true);
    const result = await clientFetchJson<ProductsResponse>("/api/products", { signal });
    if (!result.ok) {
      if (!result.aborted) toast(result.error ?? "Errore caricamento prodotti", "error");
      setLoading(false);
      return;
    }
    const rows = (result.data.products ?? []).map((p) => normalizeProduct(p as Record<string, unknown>));
    setProducts(rows);
    setLoading(false);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void loadProducts(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const linenProducts = products.filter(isLinenProduct);
  const consumableProducts = products.filter((p) => !isLinenProduct(p));
  const assignedRoles = new Set(products.map((p) => p.linen_role).filter(Boolean));

  async function handleSaveLinenProduct(data: {
    id?: string;
    name: string;
    linen_role: LinenRole | null;
    quantity: number;
    unit: string;
    threshold: number;
  }) {
    setSaving(true);
    const result = data.id
      ? await clientFetchJson<{ ok: boolean }>(`/api/products/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            linen_role: data.linen_role,
            unit: data.unit,
            threshold: data.threshold,
          }),
        })
      : await clientFetchJson<{ product: unknown }>("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            linen_role: data.linen_role,
            quantity: data.quantity,
            unit: data.unit,
            threshold: data.threshold,
          }),
        });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore salvataggio", "error");
      return;
    }
    toast(data.id ? "Prodotto aggiornato" : "Prodotto aggiunto", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  async function handleSaveConsumable(data: {
    id?: string;
    name: string;
    category: string;
    unit: string;
  }) {
    setSaving(true);
    const result = data.id
      ? await clientFetchJson<{ ok: boolean }>(`/api/products/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name, category: data.category, unit: data.unit }),
        })
      : await clientFetchJson<{ product: unknown }>("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name, category: data.category, unit: data.unit }),
        });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore salvataggio", "error");
      return;
    }
    toast(data.id ? "Prodotto aggiornato" : "Prodotto aggiunto", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  async function handleDelete(product: ProductRow) {
    setSaving(true);
    const result = await clientFetchJson<{ ok: boolean }>(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore eliminazione", "error");
      return;
    }
    toast("Prodotto eliminato", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-[13px] bg-[#f4ede6] p-1">
        <button
          className={`rounded-[10px] py-2 text-sm font-semibold transition-all ${
            activeTab === "biancheria"
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("biancheria")}
        >
          Biancheria{" "}
          <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === "biancheria" ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-500"}`}>
            {linenProducts.length}
          </span>
        </button>
        <button
          className={`rounded-[10px] py-2 text-sm font-semibold transition-all ${
            activeTab === "consumabili"
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("consumabili")}
        >
          Consumabili{" "}
          <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === "consumabili" ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-500"}`}>
            {consumableProducts.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(activeTab === "biancheria" ? linenProducts : consumableProducts).map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{product.name}</p>
                <p className="text-xs text-zinc-500">
                  {activeTab === "biancheria"
                    ? product.linen_role
                      ? LINEN_ROLES.find((r) => r.value === product.linen_role)?.label ?? product.linen_role
                      : "Nessun ruolo"
                    : `${product.category ?? "—"} · ${product.unit ?? "pz"}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setModal(
                      activeTab === "biancheria"
                        ? { mode: "edit-linen", product }
                        : { mode: "edit-consumable", product },
                    )
                  }
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                  aria-label="Modifica"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "delete", product })}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Elimina"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setModal(activeTab === "biancheria" ? { mode: "add-linen" } : { mode: "add-consumable" })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            {activeTab === "biancheria" ? "Aggiungi biancheria" : "Aggiungi consumabile"}
          </button>
        </div>
      )}

      {/* Modal overlay */}
      {modal.mode !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setModal({ mode: "closed" }); }}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.mode === "add-linen" && "Aggiungi biancheria"}
                {modal.mode === "add-consumable" && "Aggiungi consumabile"}
                {modal.mode === "edit-linen" && "Modifica biancheria"}
                {modal.mode === "edit-consumable" && "Modifica consumabile"}
                {modal.mode === "delete" && "Elimina prodotto"}
              </h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "closed" })}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(modal.mode === "add-linen" || modal.mode === "edit-linen") && (
              <LinenForm
                product={modal.mode === "edit-linen" ? modal.product : undefined}
                assignedRoles={assignedRoles}
                saving={saving}
                onSave={handleSaveLinenProduct}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}

            {(modal.mode === "add-consumable" || modal.mode === "edit-consumable") && (
              <ConsumableForm
                product={modal.mode === "edit-consumable" ? modal.product : undefined}
                saving={saving}
                onSave={handleSaveConsumable}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}

            {modal.mode === "delete" && (
              <DeleteConfirm
                product={modal.product}
                saving={saving}
                onConfirm={() => void handleDelete(modal.product)}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function LinenForm({
  product,
  assignedRoles,
  saving,
  onSave,
  onCancel,
}: {
  product?: ProductRow;
  assignedRoles: Set<string | null>;
  saving: boolean;
  onSave: (data: { id?: string; name: string; linen_role: LinenRole | null; quantity: number; unit: string; threshold: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [linenRole, setLinenRole] = useState<LinenRole | null>(product?.linen_role ?? null);
  const [quantity, setQuantity] = useState(String(product?.max_qty ?? product?.quantity ?? ""));
  const [unit, setUnit] = useState(product?.unit ?? "pz");
  const [threshold, setThreshold] = useState(String(product?.threshold ?? ""));

  const formulaLabel = linenRole
    ? LINEN_ROLES.find((r) => r.value === linenRole)?.formulaLabel
    : "Tracciato a quantità, nessun consumo automatico";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: product?.id,
      name: name.trim(),
      linen_role: linenRole,
      quantity: Math.max(0, Number(quantity) || 0),
      unit: unit.trim() || "pz",
      threshold: Math.max(0, Number(threshold) || 0),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Asciugamani Grandi"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Ruolo automazione</label>
        <select
          className="input-base w-full"
          value={linenRole ?? ""}
          onChange={(e) => setLinenRole((e.target.value as LinenRole) || null)}
        >
          <option value="">— nessun ruolo (solo tracciato) —</option>
          {LINEN_ROLES.map((role) => {
            const alreadyAssigned = assignedRoles.has(role.value) && product?.linen_role !== role.value;
            return (
              <option key={role.value} value={role.value} disabled={alreadyAssigned}>
                {role.label}{alreadyAssigned ? " (già assegnato)" : ""}
              </option>
            );
          })}
        </select>
        <p className="mt-1 text-xs text-blue-600">{formulaLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!product && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Qtà iniziale</label>
            <input
              className="input-base w-full"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Unità</label>
          <input
            className="input-base w-full"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pz"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Soglia minima</label>
          <input
            className="input-base w-full"
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </form>
  );
}

function ConsumableForm({
  product,
  saving,
  onSave,
  onCancel,
}: {
  product?: ProductRow;
  saving: boolean;
  onSave: (data: { id?: string; name: string; category: string; unit: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "pz");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: product?.id, name: name.trim(), category: category.trim() || "Generale", unit: unit.trim() || "pz" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Detersivo Pavimenti"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Categoria</label>
        <input
          className="input-base w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Es. Pulizia, Cucina, Bagno..."
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Unità di misura</label>
        <input
          className="input-base w-full"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Es. pz, ml, gr, rotoli..."
        />
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Tracciato a 3 stati: Pieno / A metà / Finito
      </p>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  product,
  saving,
  onConfirm,
  onCancel,
}: {
  product: ProductRow;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-700">
        Vuoi eliminare <span className="font-semibold">{product.name}</span>?
      </p>
      {product.linen_role && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ Questo prodotto ha un ruolo biancheria ({LINEN_ROLES.find((r) => r.value === product.linen_role)?.label}). Eliminandolo l'automazione non consumerà più questo tipo di biancheria nelle prenotazioni future.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Eliminazione..." : "Elimina"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Se `btn-primary` non esiste come classe CSS nel progetto, sostituisci con:

```
className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
```

- [ ] **Step 8.3: Commit**

```bash
git add components/product-catalog-editor.tsx
git commit -m "feat: add ProductCatalogEditor component"
```

---

## Task 9: Onboarding — sezione prodotti

**Files:**
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 9.1: Aggiungi import e sezione prodotti**

In `app/onboarding/page.tsx`, aggiungi l'import:

```typescript
import { ProductCatalogEditor } from "@/components/product-catalog-editor";
```

Dopo la `Card` esistente con `WorkspaceSettingsForm`, aggiungi una seconda card:

```typescript
<Card>
  <CardHeader
    title="Prodotti & Biancheria"
    subtitle="Configura il catalogo prodotti del tuo B&B (puoi modificarlo in qualsiasi momento da Impostazioni)"
  />
  <div className="px-6 pb-6">
    <ProductCatalogEditor />
  </div>
</Card>
```

- [ ] **Step 9.2: Verifica TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.3: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: add products section to onboarding"
```

---

## Task 10: Settings — card prodotti

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 10.1: Aggiungi import e card**

In `app/settings/page.tsx`, aggiungi l'import:

```typescript
import { ProductCatalogEditor } from "@/components/product-catalog-editor";
```

Prima della card "Sezioni avanzate" esistente, aggiungi:

```typescript
<Card>
  <CardHeader
    title="Prodotti & Biancheria"
    subtitle="Gestisci il catalogo prodotti: biancheria con ruoli automazione e consumabili"
  />
  <div className="px-6 pb-6">
    <ProductCatalogEditor />
  </div>
</Card>
```

- [ ] **Step 10.2: Verifica TypeScript finale**

```bash
npx tsc --noEmit
```

Atteso: zero errori su tutti i file modificati.

- [ ] **Step 10.3: Commit finale**

```bash
git add app/settings/page.tsx
git commit -m "feat: add products card to settings page"
```

---

## Verifica manuale

Dopo tutti i task:

1. Avvia il dev server: `npm run dev`
2. Vai a `/settings` → controlla che la card "Prodotti & Biancheria" appaia con i prodotti esistenti nelle due tab
3. Aggiungi un prodotto biancheria con ruolo → verifica che il ruolo appaia nella lista
4. Aggiungi un consumabile → verifica che appaia nella tab Consumabili
5. Modifica un prodotto → verifica che i dati vengano aggiornati
6. Elimina un prodotto senza ruolo → verifica che sparisca
7. Elimina un prodotto con ruolo → verifica che appaia l'avviso prima dell'eliminazione
8. Vai a `/onboarding` → verifica che la sezione prodotti sia presente sotto il form workspace
9. Crea una prenotazione → verifica che le quantità biancheria vengano decrementate correttamente per i prodotti con ruolo
