# Security Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correggere i 6 problemi critici e importanti identificati nell'audit di sicurezza e robustezza del 2026-05-07.

**Architecture:** Fix mirati, nessuna riscrittura. Ogni task è indipendente. Ordine: prima i P0 (sicurezza auth, atomicità), poi P1 (redirect sbagliato, filtro org mancante, sync eccessiva).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (service_role lato server), Vitest

**Problemi trattati (in ordine):**
1. `supabaseAuthClient()` usa service_role per auth utente — P0
2. Action update + side effects non atomici — P0
3. `loginAction` redirect fisso a `/onboarding` — P1
4. `upsertShoppingAction` update senza filtro org — P1
5. `syncShoppingAction` eseguita ad ogni GET /actions — P1
6. Race condition rate limiting — P1

---

## Task 1: Fix supabaseAuthClient — usa ANON_KEY invece di SERVICE_ROLE per operazioni utente

**Problema:** `getSupabaseAuthKey()` in `lib/supabaseAuth.ts` restituisce `SERVICE_ROLE_KEY ?? ANON_KEY`. Il client usato per `signInWithPassword` e `signUp` usa quindi service_role, bypassando completamente le protezioni Supabase Auth.

**Files:**
- Modify: `lib/supabaseAuth.ts`

- [ ] **Step 1: Leggere il file corrente**

```bash
# già letto in audit — riconfermato
```

- [ ] **Step 2: Separare le funzioni chiave in supabaseAuth.ts**

In `lib/supabaseAuth.ts`, sostituire:

```typescript
function getSupabaseAuthKey(): string {
  return process.env.SUPABASE_URL ?? "";
}

function getSupabaseAuthKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
}
```

Con due funzioni separate:

```typescript
function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? "";
}

function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY ?? "";
}
```

E aggiornare `supabaseAuthClient()`:

```typescript
export function supabaseAuthClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error("Missing Supabase auth environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

- [ ] **Step 3: Verificare che SUPABASE_ANON_KEY sia presente nelle env**

```bash
# Su locale Docker Supabase la anon key è sempre presente.
# Verificare nel file .env.local o equivalente che SUPABASE_ANON_KEY sia definita.
grep -r "SUPABASE_ANON_KEY" .env* 2>/dev/null || echo "Verificare manualmente .env.local"
```

- [ ] **Step 4: Verificare che verifySessionTokens usi ancora supabaseAuthClient (non admin)**

`verifySessionTokens` chiama `supabaseAuthClient().auth.getUser(token)` — questo è corretto: verificare un JWT non richiede service_role. Il cambio mantiene questa logica intatta.

- [ ] **Step 5: Run type check e test**

```bash
npx tsc --noEmit
npm test
```

Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/supabaseAuth.ts
git commit -m "fix(auth): use anon key for user-facing auth client, not service_role"
```

---

## Task 2: Rendere atomico l'aggiornamento action + side effects

**Problema:** In `PATCH /api/actions`, prima viene fatto `supabase.from("actions").update(patch)`, poi `applyActionStatusEffects(...)`. Se i side effects falliscono, lo stato action è già cambiato nel DB — dati inconsistenti.

**Soluzione:** Invertire l'ordine: applicare prima i side effects, poi aggiornare lo stato action. Se i side effects falliscono, non si tocca l'action. Non è una transazione SQL completa, ma elimina lo stato inconsistente più pericoloso (action=FATTO, inventario non aggiornato).

**Note:** Una vera transazione richiederebbe una RPC SQL. Per ora l'inversione è il fix sicuro e senza riscrittura.

**Files:**
- Modify: `app/api/actions/route.ts` (solo il blocco PATCH con `"id" in body`)

- [ ] **Step 1: Leggere il blocco PATCH in app/api/actions/route.ts (righe 105-176)**

Già letto in audit. Il blocco rilevante è:

```typescript
// riga 143
const { error } = await supabase.from("actions").update(patch).eq("organization_id", organizationId).eq("id", body.id);
if (error) return errJson(error.message, 400);

// riga 148
try {
  await applyActionStatusEffects(body.id, body.status, body.completion, organizationId);
} catch (sideEffectErr: unknown) {
  console.error("applyActionStatusEffects failed", sideEffectErr);
  return errJson("Stato azione aggiornato ma effetti collaterali falliti...", 500);
}
```

- [ ] **Step 2: Invertire l'ordine — side effects prima, DB update dopo**

Sostituire il blocco righe 119-155 in `app/api/actions/route.ts` con:

```typescript
if ("id" in body) {
  if (!body.id || !body.status) {
    return errJson("Missing id/status", 400);
  }

  const patch: Record<string, unknown> = { status: body.status };
  const completedAmount = Number(body.completion?.amount ?? NaN);
  if (Number.isFinite(completedAmount) && completedAmount > 0) {
    patch.amount = completedAmount;
  }

  if (body.completion?.linen || body.completion?.laundry) {
    const { data: actionRow, error: actionErr } = await supabase
      .from("actions")
      .select("id, action_type")
      .eq("organization_id", organizationId)
      .eq("id", body.id)
      .maybeSingle();
    if (actionErr) return errJson(actionErr.message, 400);

    const actionType = String(actionRow?.action_type ?? "").toUpperCase();
    if (actionRow && actionType.includes("BIANCHERIA") && body.completion?.linen) {
      patch.details = JSON.stringify({ linen: body.completion.linen });
    }
    if (actionRow && actionType.includes("LAVATRICI") && body.completion?.laundry) {
      patch.details = JSON.stringify({ laundry: body.completion.laundry });
    }
  }

  // Side effects PRIMA dell'update: se falliscono, l'action non viene toccata.
  try {
    await applyActionStatusEffects(body.id, body.status, body.completion, organizationId);
  } catch (sideEffectErr: unknown) {
    console.error("applyActionStatusEffects failed", sideEffectErr);
    return errJson("Effetti collaterali falliti (inventario/spese). Stato azione non modificato.", 500);
  }

  const { error } = await supabase
    .from("actions")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", body.id);
  if (error) return errJson(error.message, 400);

  return okJson({ ok: true });
}
```

- [ ] **Step 3: Run type check e test**

```bash
npx tsc --noEmit
npm test
```

Expected: nessun errore. I test su action-effects esistenti devono passare.

- [ ] **Step 4: Commit**

```bash
git add app/api/actions/route.ts
git commit -m "fix(actions): apply side effects before DB update to avoid inconsistent state"
```

---

## Task 3: Fix loginAction redirect — da /onboarding a /

**Problema:** `loginAction` in `app/actions/auth.ts` fa sempre `redirect("/onboarding")` dopo login. Il proxy gestisce il redirect automatico, ma è semanticamente sbagliato e produce un redirect inutile ad ogni login.

**Files:**
- Modify: `app/actions/auth.ts` riga 225

- [ ] **Step 1: Cambiare il redirect**

In `app/actions/auth.ts`, riga 225, cambiare:

```typescript
redirect("/onboarding");
```

in:

```typescript
redirect("/");
```

- [ ] **Step 2: Verificare che il proxy gestisca correttamente il caso onboarding incompleto**

In `proxy.ts` righe 48-54: se `isOnboardingComplete(organization.settings)` è false, il proxy ridirige a `/onboarding`. Questo meccanismo rimane invariato e gestisce correttamente i nuovi utenti.

- [ ] **Step 3: Run test**

```bash
npm test
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/auth.ts
git commit -m "fix(auth): redirect to / after login, proxy handles onboarding redirect"
```

---

## Task 4: Fix upsertShoppingAction — aggiungere filtro organization_id all'update

**Problema:** In `lib/stock.ts`, la funzione `upsertShoppingAction` aggiorna l'action SPESA con `.eq("id", primaryId)` senza filtrare per `organization_id`. In multi-tenant, un ID ottenuto da una query filtrata per org è già corretto, ma manca la difesa in profondità.

**Files:**
- Modify: `lib/stock.ts` (funzione `upsertShoppingAction`, righe 148-165)

- [ ] **Step 1: Aggiungere organizationId come parametro e aggiungerlo all'update**

La funzione `upsertShoppingAction` ha già `organizationId: string` come parametro (riga 103). Aggiungere il filtro org all'update:

Sostituire il blocco update (righe 148-165):

```typescript
const primaryId = String(existingIds[0]);
const updateVariants: Record<string, unknown>[] = [
  { action_date: today, details },
  { action_date: today },
  { details },
];

let updated = false;
for (const payload of updateVariants) {
  const updateErr = await supabase
    .from("actions")
    .update(payload)
    .eq("id", primaryId);
  if (!updateErr.error) {
    updated = true;
    break;
  }
}
```

Con:

```typescript
const primaryId = String(existingIds[0]);
const updateVariants: Record<string, unknown>[] = [
  { action_date: today, details },
  { action_date: today },
  { details },
];

let updated = false;
for (const payload of updateVariants) {
  const updateErr = await supabase
    .from("actions")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", primaryId);
  if (!updateErr.error) {
    updated = true;
    break;
  }
}
```

- [ ] **Step 2: Run type check e test**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 3: Commit**

```bash
git add lib/stock.ts
git commit -m "fix(stock): add organization_id filter to SPESA action update"
```

---

## Task 5: Rimuovere syncShoppingAction dal GET /api/actions

**Problema:** `GET /api/actions` chiama `syncShoppingAction(organizationId)` ad ogni lettura. È costoso e non necessario: la sync deve avvenire quando cambiano i dati (restock, checkout), non ad ogni read.

**Files:**
- Modify: `app/api/actions/route.ts` (rimuovere righe 64-67 dal GET)

- [ ] **Step 1: Rimuovere il blocco syncShoppingAction dal GET**

In `app/api/actions/route.ts`, nel `GET`, rimuovere:

```typescript
try {
  await syncShoppingAction(organizationId);
} catch (syncErr: unknown) {
  console.error("Non-blocking shopping sync failed in actions GET", syncErr);
}
```

Il blocco è immediatamente prima della query `supabase.from("actions")...`.

- [ ] **Step 2: Verificare che syncShoppingAction venga chiamata nei punti giusti**

La sync rimane chiamata in:
- `lib/stock.ts` → `applyBookingConsumptionDelta` (post consumo biancheria)
- `lib/action-effects.ts` → `applyActionStatusEffects` (post completamento action)
- `app/api/products/route.ts` → `PATCH /api/products` (post aggiornamento scorte)
- `lib/booking-automation.ts` → `resyncBookingDomainState` (post create/update/delete booking)

Questi sono tutti i punti corretti dove i dati cambiano.

- [ ] **Step 3: Run type check e test**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 4: Commit**

```bash
git add app/api/actions/route.ts
git commit -m "fix(actions): remove syncShoppingAction from GET handler, already called on data mutations"
```

---

## Task 6: Fix race condition rate limiting — update atomico

**Problema:** In `app/actions/auth.ts`, `checkRateLimit` legge `attempt_count` e poi fa un `UPDATE` separato. Due richieste simultanee dallo stesso IP possono entrambi leggere `count < MAX` e passare il blocco.

**Soluzione:** Usare un singolo `UPDATE ... SET attempt_count = attempt_count + 1 WHERE ... RETURNING attempt_count` invece di SELECT + UPDATE separati.

**Files:**
- Modify: `app/actions/auth.ts` (funzione `checkRateLimit`)

- [ ] **Step 1: Riscrivere checkRateLimit per usare upsert atomico**

Sostituire la funzione `checkRateLimit` (righe 126-175) con:

```typescript
async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const nextReset = new Date(now.getTime() + WINDOW_MS).toISOString();

    // Upsert atomico: inserisce o incrementa in una sola operazione.
    // Se la riga non esiste o è scaduta, inserisce con count=1.
    // Se esiste e non è scaduta, incrementa atomicamente.
    const { data, error } = await supabase.rpc("upsert_rate_limit", {
      p_ip: ip,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_ms: WINDOW_MS,
    });

    if (error) {
      if (isMissingRateLimitTable(error)) return checkRateLimitInMemory(ip);
      // Se la funzione RPC non esiste ancora, fallback in-memory
      if (String(error.code) === "42883" || String(error.message).includes("upsert_rate_limit")) {
        return checkRateLimitInMemory(ip);
      }
      throw new Error(error.message);
    }

    const result = data as { blocked: boolean; attempt_count: number } | null;
    if (!result) return checkRateLimitInMemory(ip);

    return {
      blocked: result.blocked,
      remaining: Math.max(0, MAX_ATTEMPTS - result.attempt_count),
    };
  } catch (error) {
    console.error("Rate limit storage failed, using in-memory fallback", error);
    return checkRateLimitInMemory(ip);
  }
}
```

- [ ] **Step 2: Creare la migration SQL per la funzione RPC atomica**

Creare il file `supabase/migrations/20260507160000_add_upsert_rate_limit_atomic.sql`:

```sql
-- Atomic rate limit upsert: insert-or-increment in a single operation.
-- Returns { blocked: bool, attempt_count: int }.
create or replace function public.upsert_rate_limit(
  p_ip text,
  p_max_attempts int,
  p_window_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_attempt_count int;
  v_blocked boolean;
begin
  -- Calcola la finestra di reset
  v_reset_at := v_now + (p_window_ms || ' milliseconds')::interval;

  -- Inserimento o aggiornamento atomico usando ON CONFLICT
  insert into public.auth_rate_limits (ip, attempt_count, reset_at)
  values (p_ip, 1, v_reset_at)
  on conflict (ip) do update
    set
      attempt_count = case
        -- Se la finestra è scaduta, resetta il contatore
        when public.auth_rate_limits.reset_at <= v_now then 1
        -- Altrimenti incrementa (solo se non già bloccato)
        when public.auth_rate_limits.attempt_count >= p_max_attempts then public.auth_rate_limits.attempt_count
        else public.auth_rate_limits.attempt_count + 1
      end,
      reset_at = case
        when public.auth_rate_limits.reset_at <= v_now then v_reset_at
        else public.auth_rate_limits.reset_at
      end
  returning attempt_count, (attempt_count >= p_max_attempts) as blocked
  into v_attempt_count, v_blocked;

  return jsonb_build_object(
    'attempt_count', v_attempt_count,
    'blocked', v_blocked
  );
end;
$$;

-- La funzione è accessibile solo da service_role (usata lato server)
revoke all on function public.upsert_rate_limit(text, int, bigint) from anon;
revoke all on function public.upsert_rate_limit(text, int, bigint) from authenticated;
grant execute on function public.upsert_rate_limit(text, int, bigint) to service_role;

-- Assicurarsi che auth_rate_limits abbia unique constraint su ip per ON CONFLICT
alter table public.auth_rate_limits
  drop constraint if exists auth_rate_limits_ip_key;
alter table public.auth_rate_limits
  add constraint auth_rate_limits_ip_key unique (ip);
```

- [ ] **Step 3: Applicare la migration locale**

```bash
npx.cmd supabase db push --local
```

Expected: migration applicata senza errori.

- [ ] **Step 4: Run type check e test**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts supabase/migrations/20260507160000_add_upsert_rate_limit_atomic.sql
git commit -m "fix(auth): atomic rate limit upsert via SQL RPC to eliminate race condition"
```

---

## Verifica Finale

- [ ] **Run completo test suite**

```bash
npm test
```

Expected: tutti i test passano.

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

Expected: zero errori.

- [ ] **Run lint**

```bash
npm run lint
```

Expected: zero errori.
