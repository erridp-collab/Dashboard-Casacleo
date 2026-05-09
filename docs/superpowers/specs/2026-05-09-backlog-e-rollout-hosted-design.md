# Spec: Backlog Tecnico + Rollout Hosted
**Data:** 2026-05-09  
**Progetto:** Alva Host Manager  
**Autore:** Enrico + Claude Code

---

## Contesto per chi inizia da zero

Questo documento è un brief autonomo per chi deve eseguire il lavoro senza conoscere la storia del progetto.

### Cos'è il progetto

**Alva Host Manager** è un gestionale operativo per affitti brevi (Airbnb). Le aree funzionali sono: prenotazioni, azioni operative (pulizie, check-in/out), inventario/scorte, biancheria, finanze/spese.

Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Supabase Postgres, Vitest.

### Situazione attuale

Esistono **due ambienti distinti** che devono essere allineati:

#### Ambiente locale (moderno — `alva-host-manager`)
- Codice sorgente completo e aggiornato
- Auth: Supabase Auth con cookie server-side (sb-access-token, sb-refresh-token)
- Multi-tenancy completa: tabelle `organizations` + `user_roles` + `organization_id` su tutte le tabelle operative
- Platform admin separato: flag `app_metadata.is_platform_admin` su Supabase Auth
- Flusso utenti: request access → approvazione admin → onboarding → dashboard
- 17 migration SQL applicate (fino a `20260508140000_add_signup_requests.sql`)
- Tutti i test passano in locale

#### Ambiente hosted in produzione (`Dashboard-Casacleo` su Vercel + Supabase hosted)
- Stesso codice sorgente del locale (stesso repo GitHub, stesso commit `6ceda53`)
- **Database diverso** — schema legacy pre-multi-tenancy:
  - Solo 9 migration applicate (fino a `20260507123000`)
  - **NON esistono:** `organizations`, `user_roles`, `signup_requests`
  - Nessun `organization_id` sulle tabelle operative
  - Nessuna RLS per tenant
- **Auth diversa** — ancora HMAC custom (vecchia password condivisa), NON Supabase Auth
- **Dati reali da preservare:** 14 bookings, 47 azioni, 10 spese, 29 prodotti, + action_checklist, counters

### Il problema

Il codice moderno (locale) si aspetta un database multi-tenant con Supabase Auth. Il database hosted è pre-multi-tenancy con auth legacy. Finché il database hosted non viene allineato, l'app in produzione non funziona correttamente con il codice attuale.

### Approccio scelto

**Prima chiudiamo il backlog tecnico nel codice locale, poi eseguiamo il cutover del database hosted.**

Ragione: il piano di migrazione hosted è uno script SQL da eseguire una volta sola — va progettato ora ma eseguito solo dopo che il codice locale è pulito. Così quello che va in produzione è già corretto.

---

## Parte 1 — Backlog Tecnico (da fare nel codice locale)

Queste sono 5 voci di debito tecnico residuo identificate nell'audit. Vanno chiuse **con rigore massimo** — nessuna regressione, nessuna modifica a comportamenti funzionanti.

### BT-1: FK mancante su `expenses.source_action_id`

**Problema:** La colonna `expenses.source_action_id` non ha un foreign key constraint verso `actions.id`. Se un'azione viene cancellata, le spese collegate rimangono orfane senza errore.

**Fix:** Aggiungere una migration SQL con FK + `ON DELETE SET NULL` (non CASCADE, perché le spese storiche devono restare).

**File coinvolti:**
- `supabase/migrations/` — nuova migration
- Nessuna modifica al codice applicativo necessaria

**Vincolo:** verificare prima se esistono righe in `expenses` con `source_action_id` che non puntano a nessuna `actions.id` valida (dati inconsistenti bloccherebbero l'aggiunta del FK).

---

### BT-2: `PATCH /api/products` con loop non transazionale

**Problema:** `app/api/products/route.ts` gestisce aggiornamenti bulk con un loop di UPDATE separati. Se uno fallisce a metà, il database resta in stato parzialmente aggiornato senza rollback.

**Fix:** Sostituire il loop con la RPC atomica `apply_product_quantity_deltas` già esistente nel database, oppure wrappare le operazioni in una transazione esplicita.

**File coinvolti:**
- `app/api/products/route.ts`
- `lib/product-quantity.ts`

**Vincolo:** non cambiare la firma dell'API né il comportamento dal punto di vista del client — solo rendere l'operazione atomica lato server.

---

### BT-3: Rimozione fallback schema legacy

**Problema:** Alcune route handler hanno fallback per lo schema legacy (colonne storiche, nomi alternativi) che erano necessari durante la migrazione ma ora sono codice morto che oscura la logica reale.

**File coinvolti (da verificare e pulire):**
- `app/api/bookings/route.ts`
- `app/api/actions/route.ts`
- `app/api/finance/route.ts`

**Approccio:** Leggere ogni file, identificare i fallback legacy espliciti (commenti tipo "legacy compat", branch su colonne vecchie), rimuoverli solo se il database hosted sarà allineato prima del deploy. **ATTENZIONE:** questa voce va eseguita DOPO il cutover hosted, oppure i fallback vanno lasciati fino a quel momento. Segnarla come "pianificata post-cutover".

---

### BT-4: 6 varianti checklist insert in `booking-automation.ts`

**Problema:** `lib/booking-automation.ts` contiene 6 varianti di logica insert per la checklist — codice relitto della migrazione da schema legacy a moderno. È codice duplicato/morto che rende difficile la manutenzione.

**Fix:** Consolidare in un'unica path che usa lo schema moderno con `organization_id`.

**File coinvolti:**
- `lib/booking-automation.ts`
- `tests/booking-automation.test.ts` (verificare che i test coprano il comportamento post-cleanup)

**Vincolo:** i test esistenti devono continuare a passare senza modifiche semantiche.

---

### BT-5: Test di tenant isolation end-to-end

**Problema:** Non esistono test che verificano che i dati di un tenant non siano visibili a un altro tenant. Questo è il gap più critico per un sistema multi-tenant.

**Fix:** Aggiungere test di integration che:
1. Creano due organizzazioni distinte con dati separati
2. Verificano che le query di org A non restituiscano dati di org B
3. Coprono almeno: bookings, actions, expenses, products

**File coinvolti:**
- `tests/integration/` — nuovi file
- `tests/integration/helpers.ts` — estendere con helper multi-org

**Vincolo:** i test devono usare il database locale Docker (come gli altri integration test esistenti), non mock.

---

## Parte 2 — Piano di Migrazione Database Hosted

Questo è il piano operativo per portare il database hosted in produzione al livello del locale senza perdere i dati reali esistenti.

### Stato attuale hosted (verificato 2026-05-09)

Tabelle esistenti: `bookings`, `actions`, `action_checklist`, `expenses`, `products`, `counters`, `auth_rate_limits`  
Tabelle mancanti: `organizations`, `user_roles`, `signup_requests`  
Auth: HMAC custom (nessun utente in `auth.users`)  
Dati reali: 14 bookings, 47 azioni, 10 spese, 29 prodotti

### Migration SQL da applicare in ordine

Le 8 migration mancanti vanno applicate nell'ordine esatto. Alcune modificano tabelle esistenti con dati reali — vanno eseguite con attenzione.

```
20260507150000_add_multi_tenant_foundation.sql   ← CRITICA: aggiunge organizations, user_roles, organization_id
20260507154000_fix_atomic_product_uuid_lookup.sql
20260507160000_add_upsert_rate_limit_atomic.sql
20260508100000_fix_delete_booking_atomic_org_filter.sql
20260508120000_drop_create_booking_function.sql
20260508130000_add_booking_overlap_exclusion.sql
20260508140000_add_signup_requests.sql
```

**ATTENZIONE sulla migration `20260507150000`:** Aggiunge la colonna `organization_id` alle tabelle operative. Se usa `NOT NULL` senza default, fallirà sulle righe esistenti. Verificare il contenuto della migration prima di applicarla — potrebbe richiedere:
1. Creare prima l'organizzazione "Legacy Workspace"
2. Applicare la migration con un default temporaneo
3. Aggiornare i dati esistenti con l'`organization_id` corretto
4. Rimuovere il default temporaneo

### Procedura di cutover

**Step 1 — Backup**
- Esportare dump completo del database hosted prima di qualsiasi modifica
- Salvare lista utenti Auth (anche se vuota, per conferma)

**Step 2 — Leggere il contenuto di `20260507150000_add_multi_tenant_foundation.sql`**
Prima di applicare qualsiasi cosa, leggere questa migration per capire se aggiunge `organization_id NOT NULL` con o senza default. Se non ha default, le righe esistenti bloccheranno la migration — in quel caso applicarla in due fasi (vedi nota sotto).

**Step 3 — Applicare le 8 migration mancanti**
Usare `npx supabase db push` puntando all'ambiente hosted, oppure eseguire gli script SQL manualmente dall'editor Supabase.

Se la migration `20260507150000` fallisce per righe esistenti senza `organization_id`:
1. Modificare temporaneamente la migration per aggiungere `DEFAULT NULL` sulla colonna
2. Applicare la migration
3. Procedere con lo Step 4 (assegnazione org_id ai dati)
4. Poi aggiungere il constraint NOT NULL con una migration separata

**Step 4 — Creare organizzazione legacy**
```sql
INSERT INTO organizations (name, slug, currency_code, timezone, settings)
VALUES ('Casa Cleo', 'casa-cleo', 'EUR', 'Europe/Rome', '{"onboarding_completed": true}')
RETURNING id;
```
Annotare l'`id` restituito — servirà nei passi successivi.

**Step 5 — Assegnare organization_id ai dati esistenti**
```sql
-- Sostituire <ORG_ID> con l'id dell'organizzazione creata al Step 2
UPDATE bookings SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE actions SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE action_checklist SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE counters SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
```

**Step 6 — Creare utente Supabase Auth**
Dall'area Auth della dashboard Supabase hosted:
- Creare nuovo utente con l'email dell'utente attivo
- Impostare password
- Annotare l'`auth_user_id`

**Step 7 — Creare membership owner**
```sql
INSERT INTO user_roles (organization_id, user_id, role)
VALUES ('<ORG_ID>', '<AUTH_USER_ID>', 'owner');
```

**Step 8 — Configurare platform admin**
Dalla dashboard Supabase hosted → Authentication → Users → seleziona utente admin:
- Aggiungere in `app_metadata`: `{"is_platform_admin": true}`

**Step 9 — Verifica finale**
```sql
-- Verificare che tutti i dati abbiano organization_id
SELECT 
  (SELECT COUNT(*) FROM bookings WHERE organization_id IS NULL) as bookings_senza_org,
  (SELECT COUNT(*) FROM actions WHERE organization_id IS NULL) as actions_senza_org,
  (SELECT COUNT(*) FROM expenses WHERE organization_id IS NULL) as expenses_senza_org,
  (SELECT COUNT(*) FROM products WHERE organization_id IS NULL) as products_senza_org;
-- Deve restituire tutti 0

-- Verificare membership
SELECT u.email, r.role, o.name 
FROM user_roles r
JOIN organizations o ON o.id = r.organization_id
JOIN auth.users u ON u.id = r.user_id;
```

**Step 10 — Test end-to-end**
- Login con le nuove credenziali Supabase Auth
- Verificare che la dashboard mostri i dati storici
- Verificare che bookings/actions/finance/inventory funzionino
- Verificare che `/platform` sia accessibile con l'account admin

### Rollback

Se qualcosa va storto:
- Ripristinare il dump del database dal Step 1
- Il codice non va toccato (è già compatibile con entrambi i modelli durante la transizione)

---

## Ordine di esecuzione consigliato

```
1. BT-5  Test tenant isolation       ← prima i test, così hai copertura
2. BT-1  FK expenses.source_action_id
3. BT-2  PATCH /api/products atomico
4. BT-4  Cleanup checklist legacy
5. Parte 2  Cutover database hosted
6. BT-3  Rimozione fallback legacy    ← solo dopo cutover hosted
```

---

## Definizione di done

**Backlog tecnico:**
- Tutti i test passano (`npm test`)
- TypeScript compila senza errori (`npx tsc --noEmit`)
- Lint pulito (`npm run lint`)
- Nessun comportamento funzionante rotto

**Rollout hosted:**
- L'utente storico entra senza attrito
- Vede tutti i suoi dati precedenti (14 bookings, 47 azioni, 10 spese, 29 prodotti)
- Nessuna area restituisce `Forbidden` o dati vuoti per mismatch tenant
- `/platform` accessibile per l'admin

---

## File chiave da leggere prima di iniziare

```
lib/booking-automation.ts       ← BT-4
lib/action-effects.ts           ← contesto side effects
lib/product-quantity.ts         ← BT-2
app/api/products/route.ts       ← BT-2
app/api/bookings/route.ts       ← BT-3
app/api/actions/route.ts        ← BT-3
app/api/finance/route.ts        ← BT-3
tests/integration/helpers.ts    ← BT-5
supabase/migrations/20260507150000_add_multi_tenant_foundation.sql  ← Parte 2
```
