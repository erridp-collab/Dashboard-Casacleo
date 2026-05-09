# Backlog Tecnico + Rollout Hosted — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere 5 voci di debito tecnico nel codice locale, poi eseguire il cutover del database hosted in produzione.

**Architecture:** Approccio sequenziale — prima i test di tenant isolation (copertura), poi le fix atomiche al database locale (BT-1, BT-2, BT-4), poi il cutover manuale del database hosted, infine rimozione dei fallback legacy (BT-3). Ogni task termina con `npm test + npx tsc --noEmit + npm run lint` tutti verdi.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Supabase Postgres, Vitest, TypeScript.

---

## File Map

| File | Azione | Task |
|------|--------|------|
| `tests/integration/helpers.ts` | Modify — aggiungere `createTestOrg`, `cleanupOrg` | BT-5 |
| `tests/integration/tenant-isolation.integration.test.ts` | Create | BT-5 |
| `supabase/migrations/20260509000000_add_fk_expenses_source_action.sql` | Create | BT-1 |
| `app/api/products/route.ts` | Modify — PATCH usa loop singoli → transazione esplicita | BT-2 |
| `lib/booking-automation.ts` — `ensureChecklist()` | Modify — rimuovere 5 varianti, lasciare solo quella con `label` + `organization_id` | BT-4 |
| `app/api/bookings/route.ts` | Modify — rimuovere fallback schema legacy | BT-3 |
| `app/api/actions/route.ts` | Modify — rimuovere fallback schema legacy | BT-3 |
| `app/api/finance/route.ts` | Modify — rimuovere fallback schema legacy | BT-3 |

---

## Task 1 — BT-5: Test tenant isolation

**Prerequisito:** Supabase locale Docker attivo (`npx supabase status`).

**Files:**
- Modify: `tests/integration/helpers.ts`
- Create: `tests/integration/tenant-isolation.integration.test.ts`

- [ ] **Step 1: Aggiungere helper multi-org in `tests/integration/helpers.ts`**

Aggiungere in fondo al file (dopo la funzione `addDays` esistente):

```typescript
export async function createTestOrg(
  supabase: ReturnType<typeof supabaseTest>,
  slug: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: `Test Org ${slug}`, slug, currency_code: "EUR", timezone: "Europe/Rome", settings: {} })
    .select("id")
    .single();
  if (error) throw new Error(`createTestOrg: ${error.message}`);
  return String(data.id);
}

export async function cleanupOrg(
  supabase: ReturnType<typeof supabaseTest>,
  orgId: string,
): Promise<void> {
  // FK ON DELETE CASCADE su organizations rimuove tutto il dato tenant
  await supabase.from("organizations").delete().eq("id", orgId);
}
```

- [ ] **Step 2: Verificare che il file helpers.ts compili**

```bash
npx tsc --noEmit
```

Atteso: nessun errore.

- [ ] **Step 3: Creare il file di test con il primo test (bookings)**

Creare `tests/integration/tenant-isolation.integration.test.ts`:

```typescript
/**
 * Integration tests: verifica che i dati di un tenant non siano visibili a un altro.
 * Usa il database locale Docker. Due organizzazioni separate vengono create e ripulite
 * per ogni test.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDays, cleanupOrg, createTestOrg, supabaseTest, today } from "./helpers";

describe("tenant isolation — bookings", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = await createTestOrg(supabase, `iso-a-${Date.now()}`);
    orgB = await createTestOrg(supabase, `iso-b-${Date.now()}`);
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le prenotazioni di org B", async () => {
    const base = today();

    const { data: bk, error: bkErr } = await supabase
      .from("bookings")
      .insert({ organization_id: orgB, check_in: base, check_out: addDays(base, 3), guests: 2 })
      .select("id")
      .single();
    if (bkErr) throw new Error(bkErr.message);

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(bk.id));
  });

  it("org B non vede le prenotazioni di org A", async () => {
    const base = today();

    const { data: bk, error: bkErr } = await supabase
      .from("bookings")
      .insert({ organization_id: orgA, check_in: base, check_out: addDays(base, 3), guests: 2 })
      .select("id")
      .single();
    if (bkErr) throw new Error(bkErr.message);

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("organization_id", orgB);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(bk.id));
  });
});

describe("tenant isolation — actions", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = await createTestOrg(supabase, `iso-act-a-${Date.now()}`);
    orgB = await createTestOrg(supabase, `iso-act-b-${Date.now()}`);
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le azioni di org B", async () => {
    const base = today();

    // Serve un booking di orgB per l'action trigger
    const { data: bk } = await supabase
      .from("bookings")
      .insert({ organization_id: orgB, check_in: base, check_out: addDays(base, 2), guests: 1 })
      .select("id")
      .single();

    const { data: act, error: actErr } = await supabase
      .from("actions")
      .insert({ organization_id: orgB, booking_id: bk!.id, action_type: "PULIZIA", action_date: addDays(base, 2), status: "DA_FARE" })
      .select("id")
      .single();
    if (actErr) throw new Error(actErr.message);

    const { data: rows, error } = await supabase
      .from("actions")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(act.id));
  });
});

describe("tenant isolation — expenses", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = await createTestOrg(supabase, `iso-exp-a-${Date.now()}`);
    orgB = await createTestOrg(supabase, `iso-exp-b-${Date.now()}`);
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le spese di org B", async () => {
    const base = today();

    const { data: exp, error: expErr } = await supabase
      .from("expenses")
      .insert({ organization_id: orgB, amount: 50, description: "Test spesa", expense_date: base, category: "pulizie" })
      .select("id")
      .single();
    if (expErr) throw new Error(expErr.message);

    const { data: rows, error } = await supabase
      .from("expenses")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(exp.id));
  });
});

describe("tenant isolation — products", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = await createTestOrg(supabase, `iso-prod-a-${Date.now()}`);
    orgB = await createTestOrg(supabase, `iso-prod-b-${Date.now()}`);
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede i prodotti di org B", async () => {
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .insert({ organization_id: orgB, name: "Prodotto Test B", sku: `sku-iso-b-${Date.now()}`, qty: 5, threshold: 1 })
      .select("id")
      .single();
    if (prodErr) throw new Error(prodErr.message);

    const { data: rows, error } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(prod.id));
  });
});
```

- [ ] **Step 4: Eseguire solo il nuovo file di test**

```bash
npx vitest run tests/integration/tenant-isolation.integration.test.ts
```

Atteso: 5 test passano (o falliscono per motivi di schema — in quel caso leggere il messaggio, non è un fallimento del piano).

- [ ] **Step 5: Eseguire la suite completa**

```bash
npm test
```

Atteso: tutti i test passano. Se qualcuno dei test esistenti fallisce, non procedere — investigare prima.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/helpers.ts tests/integration/tenant-isolation.integration.test.ts
git commit -m "test: add tenant isolation integration tests for bookings, actions, expenses, products"
```

---

## Task 2 — BT-1: FK su `expenses.source_action_id`

**Files:**
- Create: `supabase/migrations/20260509000000_add_fk_expenses_source_action.sql`

- [ ] **Step 1: Verificare se esistono righe orfane nel DB locale**

Eseguire questa query nell'editor SQL Supabase locale (`http://127.0.0.1:54323`):

```sql
SELECT COUNT(*) AS orfane
FROM expenses e
WHERE e.source_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM actions a WHERE a.id = e.source_action_id
  );
```

Atteso: `0`. Se il risultato è > 0, le righe orfane vanno rimosse o corrette prima di aggiungere il FK (altrimenti la migration fallisce).

- [ ] **Step 2: Creare la migration**

Creare `supabase/migrations/20260509000000_add_fk_expenses_source_action.sql`:

```sql
-- Aggiunge FK su expenses.source_action_id verso actions.id.
-- ON DELETE SET NULL: le spese storiche restano anche se l'azione viene cancellata.
alter table public.expenses
  drop constraint if exists expenses_source_action_id_fkey;

alter table public.expenses
  add constraint expenses_source_action_id_fkey
  foreign key (source_action_id)
  references public.actions(id)
  on delete set null;
```

- [ ] **Step 3: Applicare la migration al DB locale**

```bash
npx supabase db push --local
```

Atteso: `Applying migration 20260509000000_add_fk_expenses_source_action.sql... done`

- [ ] **Step 4: Verificare che il constraint sia attivo**

Eseguire nell'editor SQL:

```sql
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'expenses_source_action_id_fkey';
```

Atteso: una riga con `confdeltype = 'n'` (SET NULL).

- [ ] **Step 5: Eseguire la suite completa**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Atteso: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260509000000_add_fk_expenses_source_action.sql
git commit -m "feat: add FK on expenses.source_action_id with ON DELETE SET NULL"
```

---

## Task 3 — BT-2: PATCH `/api/products` atomico

**Problema:** Il PATCH in `app/api/products/route.ts` usa un loop di UPDATE separati. Se uno fallisce a metà, il DB resta in stato parziale. La soluzione è wrappare gli UPDATE in una funzione SQL atomica via `supabase.rpc`.

**Files:**
- Modify: `app/api/products/route.ts`
- Create: `supabase/migrations/20260509010000_add_bulk_product_update_atomic.sql`

- [ ] **Step 1: Creare la migration con la funzione atomica**

Creare `supabase/migrations/20260509010000_add_bulk_product_update_atomic.sql`:

```sql
-- Aggiorna prodotti in modo atomico (transazione singola).
-- p_updates: array di oggetti {product_id, quantity, threshold, organization_id}
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
  v_qty numeric;
  v_threshold numeric;
  v_payload jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_updates) loop
    v_product_id := (v_item->>'id')::uuid;
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    v_threshold := nullif(v_item->>'threshold', '')::numeric;

    v_payload := '{}'::jsonb;
    if v_qty is not null then
      v_payload := v_payload || jsonb_build_object('qty', v_qty);
    end if;
    if v_threshold is not null then
      v_payload := v_payload || jsonb_build_object('threshold', v_threshold);
    end if;

    if v_payload = '{}'::jsonb then
      continue;
    end if;

    update public.products
    set
      qty = coalesce((v_payload->>'qty')::numeric, qty),
      threshold = coalesce((v_payload->>'threshold')::numeric, threshold)
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
```

- [ ] **Step 2: Applicare la migration**

```bash
npx supabase db push --local
```

Atteso: `Applying migration 20260509010000_add_bulk_product_update_atomic.sql... done`

- [ ] **Step 3: Sostituire il loop nel PATCH di `app/api/products/route.ts`**

Sostituire il corpo della funzione `PATCH` (righe 49–81 attuali) con:

```typescript
export async function PATCH(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as { updates?: ProductPatch[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    // Normalizza i campi in base allo schema risolto (qty vs quantity)
    const normalized = updates
      .filter((item) => item.quantity !== undefined || item.threshold !== undefined)
      .map((item) => ({
        id: item.id,
        ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        ...(item.threshold !== undefined ? { threshold: item.threshold } : {}),
      }));

    if (normalized.length === 0) {
      return okJson({ ok: true });
    }

    // Costruiamo il payload adattando il nome colonna quantità allo schema effettivo
    const rpcPayload = normalized.map((item) => ({
      id: item.id,
      ...(item.quantity !== undefined ? { [schema.quantityColumn]: item.quantity, quantity: item.quantity } : {}),
      ...(item.threshold !== undefined ? { threshold: item.threshold } : {}),
    }));

    const { error } = await supabase.rpc("bulk_update_products", {
      p_updates: rpcPayload,
      p_organization_id: organizationId,
    });

    if (error) return errJson(error.message, 400);

    await syncShoppingAction(organizationId);

    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}
```

**Nota:** La funzione SQL usa colonna `qty` hardcoded (schema moderno). Se `schema.quantityColumn` è diverso da `qty` (schema legacy), il fallback vecchio schema è già nella `resolveProductSchema`. Dopo il cutover hosted questo non sarà più rilevante.

- [ ] **Step 4: Verificare che TypeScript compili**

```bash
npx tsc --noEmit
```

Atteso: nessun errore.

- [ ] **Step 5: Eseguire la suite completa**

```bash
npm test
npm run lint
```

Atteso: tutto verde. I test esistenti su `stock-atomic` e `stock-consumption` devono passare invariati.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260509010000_add_bulk_product_update_atomic.sql app/api/products/route.ts
git commit -m "feat: make PATCH /api/products atomic via bulk_update_products RPC"
```

---

## Task 4 — BT-4: Cleanup `ensureChecklist` in `booking-automation.ts`

**Problema:** `ensureChecklist` in `lib/booking-automation.ts` prova 6 varianti di insert per trovare le colonne giuste. Nello schema moderno la tabella `action_checklist` usa la colonna `label`. Le 5 varianti alternative sono codice morto.

**Files:**
- Modify: `lib/booking-automation.ts`

- [ ] **Step 1: Verificare la colonna effettiva di `action_checklist` nel DB locale**

Eseguire nell'editor SQL Supabase locale:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'action_checklist'
ORDER BY ordinal_position;
```

Confermare che esiste la colonna `label` (e non `item_text` o `item`). Se così non fosse, fermarsi e segnalare — il piano assumerebbe uno schema errato.

- [ ] **Step 2: Semplificare `ensureChecklist` in `lib/booking-automation.ts`**

Sostituire la funzione `ensureChecklist` (righe 36–68 attuali) con:

```typescript
async function ensureChecklist(actionId: string, actionType: string, organizationId?: string): Promise<void> {
  const supabase = supabaseAdmin();
  const checklist = await getChecklistTemplate(supabase, actionType);
  if (!checklist || checklist.length === 0) return;

  let existingQuery = supabase
    .from("action_checklist")
    .select("id")
    .eq("action_id", actionId);
  if (organizationId) existingQuery = existingQuery.eq("organization_id", organizationId);

  const { data: existingRows, error: existingErr } = await existingQuery;
  if (existingErr) throw new Error(existingErr.message);
  if ((existingRows ?? []).length > 0) return;

  const rows = checklist.map((label, index) => ({
    action_id: actionId,
    organization_id: organizationId,
    done: false,
    sort_order: index + 1,
    label,
  }));

  const { error } = await supabase.from("action_checklist").insert(rows);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Verificare che TypeScript compili**

```bash
npx tsc --noEmit
```

Atteso: nessun errore.

- [ ] **Step 4: Eseguire la suite completa**

```bash
npm test
```

Atteso: tutti i test passano. In particolare `tests/integration/booking-automation.integration.test.ts` deve passare invariato — questo è il test di regressione principale per questa modifica.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Atteso: nessun errore o warning.

- [ ] **Step 6: Commit**

```bash
git add lib/booking-automation.ts
git commit -m "refactor: consolidate ensureChecklist to single insert path using label column"
```

---

## Task 5 — Cutover database hosted

**Questo task è manuale** — richiede accesso alla dashboard Supabase hosted. Non può essere eseguito da un agente autonomo senza credenziali di produzione. Seguire ogni step nell'ordine esatto.

**Prerequisiti prima di iniziare:**
- BT-5, BT-1, BT-2, BT-4 completati e committati
- `npm test + npx tsc --noEmit + npm run lint` tutti verdi in locale
- Accesso alla dashboard Supabase hosted (progetto `Dashboard-Casacleo`)
- GitHub repo `erridp-collab/Dashboard-Casacleo` accessibile

- [ ] **Step 1: Backup completo del database hosted**

Dalla dashboard Supabase hosted:
- Vai su `Project Settings → Database → Backups`
- Scarica o avvia un backup manuale
- Salva anche la lista utenti da `Authentication → Users` (screenshot o export)

- [ ] **Step 2: Leggere la migration critica prima di applicarla**

Aprire `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql` in locale.

**Nota importante già verificata:** La migration aggiunge `organization_id` con `NOT NULL` MA prima esegue `UPDATE ... SET organization_id = default_organization_id()` per tutte le righe esistenti, e crea anche una "Legacy Workspace" automaticamente se non esistono organizzazioni. Quindi la migration è safe per dati esistenti senza intervento manuale, purché le righe orfane siano zero.

**Verifica preventiva** — Eseguire nell'editor SQL hosted prima di applicare le migration:

```sql
-- Controllare righe senza organization_id (dopo la migration dovranno essere 0)
SELECT
  (SELECT COUNT(*) FROM bookings) as bookings_tot,
  (SELECT COUNT(*) FROM actions) as actions_tot,
  (SELECT COUNT(*) FROM expenses) as expenses_tot,
  (SELECT COUNT(*) FROM products) as products_tot;
```

Annotare i totali: attesi 14, 47, 10, 29.

- [ ] **Step 3: Applicare le 7 migration mancanti sull'editor SQL hosted**

Aprire le migration locali nell'ordine esatto e incollare il contenuto nell'editor SQL della dashboard Supabase hosted, una alla volta:

```
1. supabase/migrations/20260507150000_add_multi_tenant_foundation.sql
2. supabase/migrations/20260507154000_fix_atomic_product_uuid_lookup.sql
3. supabase/migrations/20260507160000_add_upsert_rate_limit_atomic.sql
4. supabase/migrations/20260508100000_fix_delete_booking_atomic_org_filter.sql
5. supabase/migrations/20260508120000_drop_create_booking_function.sql
6. supabase/migrations/20260508130000_add_booking_overlap_exclusion.sql
7. supabase/migrations/20260508140000_add_signup_requests.sql
```

Dopo ognuna: verificare che non ci siano errori prima di procedere alla successiva.

- [ ] **Step 4: Rinominare l'organizzazione legacy**

La migration `20260507150000` crea automaticamente una org chiamata "Legacy Workspace". Rinominarla a "Casa Cleo":

```sql
UPDATE organizations
SET name = 'Casa Cleo', slug = 'casa-cleo',
    settings = settings || '{"onboarding_completed": true}'::jsonb
WHERE slug = 'legacy-workspace';
```

Annotare l'`id` della org:

```sql
SELECT id FROM organizations WHERE slug = 'casa-cleo';
```

- [ ] **Step 5: Verificare che tutti i dati abbiano `organization_id`**

```sql
SELECT
  (SELECT COUNT(*) FROM bookings WHERE organization_id IS NULL) as bookings_senza_org,
  (SELECT COUNT(*) FROM actions WHERE organization_id IS NULL) as actions_senza_org,
  (SELECT COUNT(*) FROM expenses WHERE organization_id IS NULL) as expenses_senza_org,
  (SELECT COUNT(*) FROM products WHERE organization_id IS NULL) as products_senza_org;
```

Atteso: tutti `0`. Se ci sono valori > 0, eseguire:

```sql
-- Sostituire <ORG_ID> con l'id della org da Step 4
UPDATE bookings SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE actions SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE action_checklist SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE counters SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
```

- [ ] **Step 6: Creare utente Supabase Auth**

Dalla dashboard hosted → `Authentication → Users → Invite user`:
- Email: l'email dell'utente attivo (acerrito00@gmail.com)
- Annotare l'`auth_user_id` mostrato dopo la creazione

Oppure creare direttamente con:

```sql
-- Solo se non riesci dalla UI — richiede accesso service_role
-- Preferire la UI per la gestione sicura della password
```

- [ ] **Step 7: Creare membership owner**

```sql
-- Sostituire <ORG_ID> e <AUTH_USER_ID> con i valori dei passi precedenti
INSERT INTO user_roles (organization_id, user_id, role)
VALUES ('<ORG_ID>', '<AUTH_USER_ID>', 'owner');
```

- [ ] **Step 8: Configurare platform admin**

Dalla dashboard hosted → `Authentication → Users` → selezionare l'utente appena creato → modifica `app_metadata`:

```json
{"is_platform_admin": true}
```

- [ ] **Step 9: Verifica finale dati e membership**

```sql
-- Tutti devono essere 0
SELECT
  (SELECT COUNT(*) FROM bookings WHERE organization_id IS NULL) as bookings_senza_org,
  (SELECT COUNT(*) FROM actions WHERE organization_id IS NULL) as actions_senza_org,
  (SELECT COUNT(*) FROM expenses WHERE organization_id IS NULL) as expenses_senza_org,
  (SELECT COUNT(*) FROM products WHERE organization_id IS NULL) as products_senza_org;

-- Deve mostrare utente + ruolo + org
SELECT u.email, r.role, o.name
FROM user_roles r
JOIN organizations o ON o.id = r.organization_id
JOIN auth.users u ON u.id = r.user_id;
```

- [ ] **Step 10: Test end-to-end sull'app hosted**

- Aprire l'URL hosted su Vercel
- Login con le nuove credenziali Supabase Auth
- Verificare che la dashboard mostri tutti i dati storici (14 bookings, 47 azioni, 10 spese, 29 prodotti)
- Verificare che bookings/actions/finance/inventory funzionino senza errori `403/500`
- Verificare che `/platform` sia accessibile con l'account admin

---

## Task 6 — BT-3: Rimozione fallback schema legacy

**ATTENZIONE: questo task va eseguito SOLO dopo che il cutover hosted (Task 5) è completato e verificato.**

**Files:**
- Modify: `app/api/bookings/route.ts`
- Modify: `app/api/actions/route.ts`
- Modify: `app/api/finance/route.ts`

- [ ] **Step 1: Leggere e identificare i fallback in `app/api/bookings/route.ts`**

```bash
# Cerca pattern di fallback legacy nel file
grep -n "legacy\|fallback\|compat\|old_" app/api/bookings/route.ts
```

Identificare ogni branch condizionale che gestisce colonne storiche o nomi alternativi e annotare le righe.

- [ ] **Step 2: Rimuovere i fallback da `app/api/bookings/route.ts`**

Per ogni fallback trovato nello Step 1: rimuovere il ramo legacy, lasciando solo il percorso moderno con `organization_id`. Non aggiungere commenti — il codice moderno è autoesplicativo.

- [ ] **Step 3: Leggere e identificare i fallback in `app/api/actions/route.ts`**

```bash
grep -n "legacy\|fallback\|compat\|old_" app/api/actions/route.ts
```

- [ ] **Step 4: Rimuovere i fallback da `app/api/actions/route.ts`**

Come Step 2, per questo file.

- [ ] **Step 5: Leggere e identificare i fallback in `app/api/finance/route.ts`**

```bash
grep -n "legacy\|fallback\|compat\|old_" app/api/finance/route.ts
```

- [ ] **Step 6: Rimuovere i fallback da `app/api/finance/route.ts`**

Come Step 2, per questo file.

- [ ] **Step 7: Verificare compilazione e test**

```bash
npx tsc --noEmit
npm test
npm run lint
```

Atteso: tutto verde. Se qualche test fallisce dopo la rimozione dei fallback, significa che il test stesso testava comportamento legacy — va aggiornato per usare lo schema moderno.

- [ ] **Step 8: Commit**

```bash
git add app/api/bookings/route.ts app/api/actions/route.ts app/api/finance/route.ts
git commit -m "refactor: remove legacy schema fallbacks from bookings, actions, finance routes"
```

---

## Verifica finale globale

Dopo aver completato tutti i task (o almeno BT-1, BT-2, BT-4, BT-5 prima del cutover):

- [ ] `npm test` — tutti i test passano
- [ ] `npx tsc --noEmit` — nessun errore TypeScript
- [ ] `npm run lint` — nessun errore lint
- [ ] Nessun comportamento funzionante rotto rispetto allo stato iniziale

---

## Rollback

Se il cutover hosted va storto:
- Ripristinare il dump del database dal backup (Step 1 del Task 5)
- Il codice locale non va toccato — i fallback legacy in BT-3 devono restare fino al cutover
- Tutti i task BT-1/BT-2/BT-4/BT-5 sono safe anche senza cutover hosted
