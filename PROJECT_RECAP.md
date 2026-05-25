# Project Recap

Questo file serve come contesto di continuita per audit, handoff e ripartenza tecnica.
E il documento principale da leggere prima di qualsiasi lavoro sul progetto.

## Audit Brief

Se devi fare un audit di questo progetto, considera questi vincoli reali:

- il prodotto sta passando da tool interno a SaaS in modo graduale
- la fase attuale e `owner-only`
- non ci sono ancora ruoli multipli reali, billing reale o landing pubblica
- il setup verificato degli ultimi lavori e il Supabase locale su Docker
- il database hosted e ancora legacy (pre-multi-tenancy) — vedi sezione "Stato Hosted"
- la priorita attuale e rendere distribuibile e sicuro quello che gia esiste, non completare tutta la piattaforma enterprise

## Executive Summary

`Alva Host Manager` e un gestionale operativo per affitti brevi. Le aree funzionali principali sono:

- prenotazioni
- azioni operative
- inventario e rifornimento
- biancheria
- finanza/spese

L'app era nata come strumento single-tenant per uso interno. Ora e stata portata a una base SaaS multi-tenant, ma con rollout graduale:

- database pronto per multi-tenancy
- auth applicativa migrata a Supabase Auth
- scoping tenant applicato alle API principali
- onboarding interno protetto post-login
- accesso nuovi utenti gestito con richiesta approvata manualmente
- modello di utilizzo attuale: un solo owner per workspace

## Product Scope Right Now

Quello che esiste davvero oggi:

- login email/password
- richiesta accesso pubblica al posto del signup diretto
- forgot password
- reset password
- onboarding iniziale obbligatorio dopo login
- area `/platform` per admin piattaforma
- approvazione/rifiuto richieste accesso
- supporto account admin con resend reset / disable / reactivate
- dashboard operativa
- bookings CRUD
- actions CRUD/parziale workflow
- stock management
- finance tracking
- sync automatiche di dominio su prenotazioni e shopping list

Quello che volutamente non e ancora prioritario:

- ruoli multipli reali
- gestione team
- inviti collaboratori
- billing Stripe reale
- customer portal
- landing page pubblica
- personalizzazioni utente avanzate

## Current Architecture

Stack:

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Postgres
- Vitest

Flusso:

```text
Browser UI
  -> client fetch su /api/*
  -> route handlers Next.js
  -> moduli di dominio in lib/*
  -> Supabase
```

Cartelle chiave:

- `app/` UI e route handlers
- `app/api/` API interne
- `app/actions/` server actions auth
- `app/onboarding/` setup iniziale workspace
- `app/platform/` console admin piattaforma
- `components/` UI condivisa
- `lib/` logica di dominio e integrazione DB
- `supabase/migrations/` schema history
- `tests/` unit + integration

## Current User Flow

Flusso attuale per un nuovo tester:

1. riceve direttamente il link dell'app
2. apre `/signup`
3. invia una richiesta accesso con:
   - email
   - nome opzionale
   - nome organizzazione
4. il sistema salva la richiesta in `signup_requests`
5. un platform admin la approva o la rifiuta da `/platform/requests`
6. in approvazione il sistema crea:
   - utente Supabase Auth
   - `organization`
   - membership `owner` in `user_roles`
7. l'utente riceve link reset/set password
8. al primo accesso entra nel flusso `/onboarding`
9. completa i dati base del workspace
10. poi usa la dashboard normalmente

Flusso validato in locale:

- richiesta accesso inviata da utente anonimo
- approvazione eseguita da `platform admin`
- reset password ricevuto via Mailpit locale
- login riuscito
- utente owner nuovo indirizzato prima a `/onboarding`

Flusso per utente esistente:

1. apre `/login`
2. login email/password
3. il server risolve la membership e l'organizzazione attiva
4. se `onboarding_completed` non e true, redirect automatico a `/onboarding`
5. altrimenti accesso normale alle aree protette

Flusso platform admin:

1. accede con normale sessione Supabase Auth
2. deve avere `app_metadata.is_platform_admin = true`
3. puo entrare in `/platform`
4. da li gestisce:
   - richieste accesso
   - provisioning retry
   - account support

Distinzione confermata:

- `platform admin` puro senza membership org -> `/platform`
- utente approvato con membership `owner` su workspace nuovo -> `/onboarding`

## Authentication Model

Vecchio modello (ancora attivo su hosted):

- password condivisa di squadra
- cookie HMAC custom

Nuovo modello (attivo su locale, da portare su hosted):

- Supabase Auth
- login server-side
- request access server-side
- cookie server-side per access/refresh token
- verifica sessione in `proxy.ts`
- refresh sessione server-side quando necessario
- rate limiting login via tabella `auth_rate_limits` con fallback in-memory
- reset password client-side via `supabaseBrowserClient()`
- hardening form pubblici con honeypot + timing check

Estensione piattaforma:

- `platform admin` separato dal modello tenant
- flag richiesto: `app_metadata.is_platform_admin = true`
- guard dedicata in `lib/platformAdmin.ts`
- area `/platform/*` non dipendente da `requireOrganizationContext()`

File chiave:

- `app/actions/auth.ts`
- `lib/supabaseAuth.ts`
- `lib/supabaseBrowser.ts`
- `lib/platformAdmin.ts`
- `lib/formProtection.ts`
- `proxy.ts`

## Multi-Tenancy Model

Il modello SaaS oggi e fondato su:

- `organizations`
- `user_roles`
- `organization_id` sulle tabelle operative

Tabelle tenant-aware principali:

- `bookings`
- `actions`
- `action_checklist`
- `expenses`
- `products`
- `counters`

Il database ha:

- RLS
- helper SQL
- trigger di coerenza tenant
- fallback compatibili col caso legacy single-workspace

Importante:

- la struttura e multi-tenant
- l'uso applicativo attuale e semplificato a un owner per workspace
- il sistema e quindi SaaS-ready ma non ancora "SaaS-complete"

## Onboarding Model

L'onboarding non e pubblico. E accessibile solo dopo autenticazione.

Stato onboarding:

- memorizzato dentro `organizations.settings`
- chiave principale: `onboarding_completed`

Durante l'onboarding si configurano:

- nome workspace
- valuta
- fuso orario
- referente base

File chiave:

- `app/onboarding/page.tsx`
- `app/onboarding/actions.ts`
- `components/workspace-settings-form.tsx`
- `lib/organizationContext.ts`

## Platform Admin / Access Requests

Nuovi pezzi introdotti:

- tabella `signup_requests`
- area `/platform`
- pagina `/platform/requests`
- pagina `/platform/accounts`

Stati richiesta accesso:

- `pending`
- `approved`
- `rejected`
- `failed`

Regole operative:

- il pubblico non crea piu direttamente utenti Auth
- l'approvazione crea account, workspace e membership `owner`
- se il provisioning si interrompe, la richiesta va in `failed`
- i retry sono idempotenti e riusano `auth_user_id` / `organization_id` se gia creati

Supporto account disponibile da console:

- resend reset link
- disable account
- reactivate account

Stato operativo attuale:

- primo `platform admin` configurato sia su hosted sia su locale
- login `platform admin` senza membership org supportato lato server
- ambiente locale completato con chiavi auth publishable/anon necessarie per login e reset
- flusso end-to-end locale `request access -> approve -> reset -> login -> onboarding` verificato

## Route Protection

La protezione attuale vive in `proxy.ts`.

Regole:

- senza sessione:
  - API protette -> `401`
  - pagine protette -> redirect `/login`
- con sessione:
  - `/login` e `/signup` -> redirect `/`
  - `/platform/*` accessibili solo con `is_platform_admin = true`
- con sessione ma onboarding incompleto:
  - redirect automatico verso `/onboarding`

Eccezione importante:

- un platform admin puo usare `/platform/*` anche se non ha contesto organizzativo attivo
- la parte platform e separata dal routing tenant normale

Nota importante per audit:

- il proxy non deve essere considerato l'unico layer di sicurezza
- le API principali validano anche il contesto organizzativo lato server
- le action admin validano anche `requirePlatformAdmin()` lato server

## Organization Context Resolution

Il contesto tenant viene risolto lato server in `lib/organizationContext.ts`.

Il modulo si occupa di:

- leggere cookie sessione
- verificare utente
- recuperare membership in `user_roles`
- scegliere l'organizzazione attiva
- persistere `active-organization-id` in cookie
- caricare il record organizzazione
- determinare se l'onboarding e completato

Questo e il pezzo centrale del nuovo modello applicativo tenant.

## API Surface

API principali:

- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/bookings/resync/route.ts`
- `app/api/actions/route.ts`
- `app/api/actions/checklist/route.ts`
- `app/api/actions/[id]/checklist/route.ts`
- `app/api/products/route.ts`
- `app/api/products/bulk/route.ts`
- `app/api/products/restock/route.ts`
- `app/api/products/stock-status/route.ts`
- `app/api/finance/route.ts`

Pattern attuale:

- `requireRouteContext()` valida sessione e organization context
- le query vengono filtrate con `organization_id`
- in caso di side effects, la route cerca di fallire in modo esplicito

## Domain Logic

### Bookings

Responsabilita:

- CRUD prenotazioni
- controllo overlap date
- sync azioni collegate
- delete atomico con restore biancheria

File chiave:

- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `lib/booking-automation.ts`

### Actions

Responsabilita:

- recupero lista azioni
- aggiornamento stato
- checklist per azioni
- effetti collaterali sincronizzati

File chiave:

- `app/api/actions/route.ts`
- `app/api/actions/checklist/route.ts`
- `app/api/actions/[id]/checklist/route.ts`
- `lib/action-effects.ts`

### Inventory / Stock

Responsabilita:

- lettura prodotti
- soglie e stock status
- rifornimento
- consumo automatico su soggiorni
- shopping action automatica

File chiave:

- `app/api/products/*`
- `lib/stock.ts`
- `lib/product-quantity.ts`
- `lib/products-schema.ts`

### Finance

Responsabilita:

- aggregazione mensile revenue/expenses
- inserimento spese manuali
- delete sicuro spese manuali
- supporto spese automatiche da azioni

File chiave:

- `app/api/finance/route.ts`

## Database Migration Timeline

Migration principali:

- `20260301000000_initial_public_schema.sql`
- `20260306135500_add_total_amount_to_bookings.sql`
- `20260306152000_seed_warehouse_products_and_spesa_fields.sql`
- `20260406120000_ensure_expenses_schema.sql`
- `20260408120000_add_stock_status_to_products.sql`
- `20260408173000_split_bed_sets_into_summer_and_winter.sql`
- `20260427193000_add_delete_booking_atomic_function.sql`
- `20260427200000_add_auth_rate_limits.sql`
- `20260427213000_fix_delete_booking_atomic_linen_alias_resolution.sql`
- `20260507123000_add_apply_product_quantity_deltas_atomic.sql`
- `20260507150000_add_multi_tenant_foundation.sql`
- `20260507154000_fix_atomic_product_uuid_lookup.sql`
- `20260507160000_add_upsert_rate_limit_atomic.sql`
- `20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `20260508120000_drop_create_booking_function.sql`
- `20260508130000_add_booking_overlap_exclusion.sql`
- `20260508140000_add_signup_requests.sql`

Le migration SaaS piu importanti oggi sono:

- `20260507150000_add_multi_tenant_foundation.sql`
- `20260507154000_fix_atomic_product_uuid_lookup.sql`
- `20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `20260508130000_add_booking_overlap_exclusion.sql`
- `20260508140000_add_signup_requests.sql`

## Local Environment Reality

L'ultima iterazione e stata verificata sul Supabase locale Docker.

Valori reali attesi:

- API Supabase locale: `http://127.0.0.1:54321`
- DB locale: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Comandi utili:

```bash
npx.cmd supabase status
npx.cmd supabase db push --local
npx.cmd supabase db reset
npx tsc --noEmit
npm run lint
npm test
```

Nota audit molto importante:

- l'ultimo lavoro SaaS e stato validato sul locale Docker
- il database hosted e ancora pre-multi-tenancy (vedi sezione "Stato Hosted")

## Verification Status

Alla fine dell'ultima sessione risultava tutto verde su locale:

- `npx supabase db push --local`
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- login locale verificato con account `platform admin`
- Supabase locale Docker raggiungibile e funzionante
- reset password locale verificato con redirect corretto a `/reset-password`
- smoke test end-to-end locale verificato per utente approvato

Suite rilevanti ora coperte:

- booking automation
- action effects
- stock consumption
- stock atomic
- auth actions
- public form protection
- platform admin guard
- platform request actions
- platform account actions

## Known Design Choices

Scelte intenzionali attuali:

- owner-only beta
- onboarding minimo ma protetto
- accesso nuovi utenti solo su approvazione
- platform admin separato dal tenant model
- niente billing operativo
- niente ruoli multipli reali
- niente landing pubblica

Scelte tecniche ancora transitorie:

- compatibilita con varianti schema legacy in alcuni punti
- fallback per colonne storiche
- uso di `service_role` nei moduli server-side, ma con filtro applicativo tenant
- sync eventuali non sempre bloccanti

## Audit 2026-05-07 - Risultati e Stato

Audit completo eseguito il 2026-05-07.

### Corretti

| # | Problema | File |
|---|----------|------|
| yes | `supabaseAuthClient()` usava `service_role` per auth utente | `lib/supabaseAuth.ts` |
| yes | Action update + side effects non atomici | `app/api/actions/route.ts` |
| yes | `loginAction` redirect fisso a `/onboarding` invece di `/` | `app/actions/auth.ts` |
| yes | `upsertShoppingAction` update SPESA senza filtro `organization_id` | `lib/stock.ts` |
| yes | `syncShoppingAction` eseguita ad ogni GET `/api/actions` | `app/api/actions/route.ts` |
| yes | Race condition rate limiting | `app/actions/auth.ts` + migration |

## Audit 2026-05-08 - Risultati e Stato

Audit completo eseguito il 2026-05-08 con 3 agenti indipendenti.
I risultati sono stati consolidati direttamente in questo recap.

### Critical corretti

| # | Problema | File |
|---|----------|------|
| yes C1 | fallback cross-tenant nel login rimosso | `app/actions/auth.ts` |
| yes C2 | reset password senza token nel DOM | `app/reset-password/page.tsx`, `lib/supabaseBrowser.ts` |
| yes C3 | `delete_booking_atomic` con filtro `organization_id` | migration `20260508100000`, `app/api/bookings/[id]/route.ts` |
| yes C4 | security headers presenti | `next.config.ts` |

### High/Medium corretti

| # | Finding | Severita | File |
|---|---------|----------|------|
| yes H2 | `saveActionDetails` richiede `organization_id` | `lib/action-effects.ts` |
| yes M1 | `applyProductQuantityDelta` senza fallback DB implicito | `lib/action-effects.ts` |
| yes H3 | signup non espone errori Supabase raw | `app/actions/auth.ts` |
| yes M2 | errori DB non esposti raw nelle API principali | `app/api/bookings/route.ts`, `app/api/finance/route.ts` |
| yes M3 | rimossa `create_booking()` SQL inutilizzata | migration `20260508120000` |
| yes H1 | overlap concorrenti bloccati a livello DB | migration `20260508130000`, `app/api/bookings/route.ts` |

## Postura di sicurezza attuale

- auth Supabase con verifica server-side dei JWT
- `supabaseAuthClient()` usa anon key
- session cookie httpOnly + sameSite lax
- platform admin separato via `app_metadata.is_platform_admin`
- filtro `organization_id` applicativo su tutte le query sensibili
- RLS presente ma secondaria rispetto ai filtri applicativi, dato l'uso di `service_role` lato server
- rate limiting atomico via RPC `upsert_rate_limit`
- `logoutAction` con origin check esplicito
- reset password client-side via `supabaseBrowserClient()`
- honeypot + timing check su `login`, `signup/request access`, `forgot password`
- security headers in `next.config.ts`
- constraint DB `bookings_no_overlap` per bloccare collisioni concorrenti sui booking

---

## Stato Hosted (verificato 2026-05-09)

Questa sezione descrive lo stato reale del database in produzione (Vercel + Supabase hosted).

### Delta rispetto al locale

| | Hosted | Locale |
|---|---|---|
| Auth | HMAC custom (password condivisa) | Supabase Auth cookie server-side |
| Multi-tenancy | NO | SI (organizations + user_roles) |
| Platform admin UI | NO | SI (/platform) |
| Onboarding | NO | SI (/onboarding) |
| Request access | NO | SI (signup_requests) |
| Migration applicate | 9 (fino a 20260507123000) | 17 (fino a 20260508140000) |

Il codice sorgente e identico tra i due ambienti (stesso repo GitHub, stesso commit `6ceda53`).
Il problema e esclusivamente il database hosted che e ancora pre-multi-tenancy.

### Dati reali presenti nel database hosted

- 14 bookings
- 47 azioni
- 10 spese
- 29 prodotti
- action_checklist e counters presenti

Questi dati vanno preservati nel cutover.

### Migration mancanti nel hosted

Vanno applicate in questo ordine esatto:

```
20260507150000_add_multi_tenant_foundation.sql   <- CRITICA
20260507154000_fix_atomic_product_uuid_lookup.sql
20260507160000_add_upsert_rate_limit_atomic.sql
20260508100000_fix_delete_booking_atomic_org_filter.sql
20260508120000_drop_create_booking_function.sql
20260508130000_add_booking_overlap_exclusion.sql
20260508140000_add_signup_requests.sql
```

---

## Backlog Tecnico Residuo

Cinque voci aperte. Vanno chiuse con rigore massimo — nessuna regressione.

Aggiornamento: il backlog ora include anche BT-6, dedicato all'hardening email beta-safe.

### BT-1: FK mancante su `expenses.source_action_id`

La colonna non ha FK verso `actions.id`. Se un'azione viene cancellata, le spese collegate restano orfane senza errore.

Fix: nuova migration con FK + `ON DELETE SET NULL`.

Vincolo: verificare prima se esistono righe orfane nel database (bloccherebbero l'aggiunta del FK).

File: `supabase/migrations/` — nuova migration, nessuna modifica applicativa.

### BT-2: `PATCH /api/products` con loop non transazionale

Il bulk update dei prodotti usa un loop di UPDATE separati. Se uno fallisce a meta, il DB resta in stato parziale senza rollback.

Fix: usare la RPC atomica `apply_product_quantity_deltas` gia esistente, oppure wrappare in transazione esplicita.

Vincolo: non cambiare la firma dell'API — solo rendere l'operazione atomica lato server.

File: `app/api/products/route.ts`, `lib/product-quantity.ts`.

Nota importante: prima di implementare, verificare se il rischio reale riguarda solo `app/api/products/route.ts` oppure anche `app/api/products/bulk/route.ts`.

### BT-3: Rimozione fallback schema legacy

Alcune route handler hanno fallback per lo schema legacy che ora sono codice morto.

ATTENZIONE: questa voce va eseguita SOLO dopo il cutover hosted. Finche il database hosted non e allineato, i fallback devono restare.

File: `app/api/bookings/route.ts`, `app/api/actions/route.ts`, `app/api/finance/route.ts`.

### BT-4: 6 varianti checklist insert in `booking-automation.ts`

Codice relitto della migrazione da schema legacy. 6 varianti di logica insert per la checklist che ora possono essere consolidate in una sola path con `organization_id`.

Vincolo: i test esistenti devono continuare a passare senza modifiche semantiche.

File: `lib/booking-automation.ts`, `tests/booking-automation.test.ts`.

Nota importante: prima di implementare, verificare se i fallback checklist residui sono davvero da consolidare solo in `lib/booking-automation.ts` oppure anche in `app/api/actions/[id]/checklist/route.ts`.

### BT-5: Test di tenant isolation end-to-end

Non esistono test che verificano che i dati di un tenant non siano visibili a un altro. E il gap piu critico per un sistema multi-tenant.

Fix: integration test che creano due organizzazioni distinte e verificano che i dati non si incrocino. Copertura minima: bookings, actions, expenses, products.

Vincolo: usare il database locale Docker, non mock.

File: `tests/integration/` — nuovi file, `tests/integration/helpers.ts` — estensione.

### BT-6: Hardening email beta-safe

Il flusso email attuale va reso piu robusto prima di aprire la beta esterna. Il dominio va usato come identita del prodotto, ma l'invio automatico deve passare da un provider transazionale dedicato (`Resend` o similare), non da una casella normale o dal default SMTP Supabase.

Decisioni congelate:

- sender automatico: `no-reply@auth.<dominio>` oppure `no-reply@<dominio>`
- inbox operativa umana: `support@<dominio>`
- `reply-to`: `support@<dominio>`
- provider transazionale: `Resend` o similare
- Supabase Auth resta il motore dei flussi auth, ma dietro custom SMTP/provider dedicato

Fix:

- configurare provider transazionale, dominio o sottodominio auth, SPF/DKIM/DMARC
- collegare Supabase Auth al provider
- valutare notifica email a `support@...` per nuove `signup_requests`, mantenendo `signup_requests` come fonte di verita applicativa

Vincolo: eseguire BT-6 prima dell'apertura beta a utenti esterni.

File / aree: `app/actions/auth.ts`, `app/platform/actions.ts`, configurazione Supabase Auth SMTP, DNS dominio.

### Ordine di esecuzione consigliato

```
1. BT-5  Test tenant isolation       <- prima i test, cosi hai copertura
2. BT-1  FK expenses.source_action_id
3. BT-2  PATCH /api/products atomico
4. BT-4  Cleanup checklist legacy
5. Cutover database hosted           <- vedi sezione Piano di Cutover Hosted
6. BT-3  Rimozione fallback legacy   <- solo dopo cutover hosted
7. BT-6  Hardening email beta-safe   <- prima di aprire la beta esterna
```

Dopo ogni voce: `npm test` + `npx tsc --noEmit` + `npm run lint` devono passare tutti.

---

## Piano di Cutover Hosted

Da eseguire dopo aver chiuso BT-1, BT-2, BT-4, BT-5.

### Step 1 — Backup

Esportare dump completo del database hosted prima di qualsiasi modifica.
Salvare lista utenti Auth (anche se vuota, per conferma).

### Step 2 — Leggere la migration critica

Leggere il contenuto di `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql` prima di applicarla.
Verificare se aggiunge `organization_id NOT NULL` con o senza default.
Se non ha default, le righe esistenti bloccheranno la migration — in quel caso applicarla in due fasi (aggiungere DEFAULT NULL, applicare, assegnare org_id, poi aggiungere NOT NULL con migration separata).

### Step 3 — Applicare le 7 migration mancanti

Eseguire in ordine dall'editor SQL Supabase hosted oppure via `npx supabase db push` puntando all'hosted.

### Step 4 — Creare organizzazione legacy

```sql
INSERT INTO organizations (name, slug, currency_code, timezone, settings)
VALUES ('Casa Cleo', 'casa-cleo', 'EUR', 'Europe/Rome', '{"onboarding_completed": true}')
RETURNING id;
```

Annotare l'`id` restituito.

### Step 5 — Assegnare organization_id ai dati esistenti

```sql
-- Sostituire <ORG_ID> con l'id del passo precedente
UPDATE bookings SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE actions SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE action_checklist SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
UPDATE counters SET organization_id = '<ORG_ID>' WHERE organization_id IS NULL;
```

### Step 6 — Creare utente Supabase Auth

Dalla dashboard Supabase hosted → Authentication → Users:
- Creare nuovo utente con l'email dell'utente attivo
- Impostare password
- Annotare l'`auth_user_id`

### Step 7 — Creare membership owner

```sql
INSERT INTO user_roles (organization_id, user_id, role)
VALUES ('<ORG_ID>', '<AUTH_USER_ID>', 'owner');
```

### Step 8 — Configurare platform admin

Dalla dashboard Supabase hosted → Authentication → Users → selezionare l'utente admin:
- Aggiungere in `app_metadata`: `{"is_platform_admin": true}`

### Step 9 — Verifica finale

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

### Step 10 — Test end-to-end

- Login con le nuove credenziali Supabase Auth
- Verificare che la dashboard mostri tutti i dati storici (14 bookings, 47 azioni, 10 spese, 29 prodotti)
- Verificare che bookings/actions/finance/inventory funzionino senza errori
- Verificare che `/platform` sia accessibile con l'account admin

### Rollback

Se qualcosa va storto: ripristinare il dump del database dal Step 1.
Il codice non va toccato — e gia compatibile con entrambi i modelli durante la transizione.

### Definizione di done

- L'utente storico entra senza attrito
- Vede tutti i suoi dati precedenti
- Nessuna area restituisce `Forbidden` o dati vuoti per mismatch tenant
- `/platform` accessibile per l'admin

---

## Simple New User Setup And Monitoring Plan

Obiettivo: rendere il percorso del nuovo utente e il supporto admin il piu semplice possibile.

Percorso semplice da mantenere:

1. utente invia `Richiedi accesso`
2. admin approva da `/platform/requests`
3. utente riceve reset/set password
4. primo login
5. onboarding
6. uso normale del workspace

Setup minimo consigliato:

- un solo `platform admin` operativo iniziale
- approvazione manuale delle richieste
- email reset native Supabase all'inizio
- onboarding corto, senza campi extra
- supporto account solo da `/platform/accounts`

Monitoraggio minimo:

1. richieste accesso: quante `pending`, quante `failed`, tempo medio approvazione
2. auth/support: reset non riusciti, login falliti anomali, account disabilitati
3. provisioning: richieste finite in `failed`, creazione incompleta
4. runtime: errori `401/403/500` sulle API principali, errori `409` booking overlap
5. smoke metrics: nuovi utenti approvati, onboarding completati

Runbook admin:

1. controlla `/platform/requests`
2. approva o rifiuta
3. se `failed`, usa retry provisioning
4. se l'utente non entra, usa `/platform/accounts` — resend reset / disable / reactivate
5. se c'e un problema dati, controlla membership e `organization_id`

---

## What Is Not Done Yet

Mancanze consapevoli:

- invite collaborators
- switch workspace
- role-based permissions reali
- Stripe billing reale
- customer portal
- pagina marketing/public

---

## Fast Re-Entry Files

Aprire subito questi file per riprendere:

- `PROJECT_RECAP.md`
- `app/actions/auth.ts`
- `proxy.ts`
- `app/platform/layout.tsx`
- `app/platform/requests/page.tsx`
- `app/platform/accounts/page.tsx`
- `app/platform/actions.ts`
- `lib/platformAdmin.ts`
- `lib/accountProvisioning.ts`
- `lib/formProtection.ts`
- `lib/siteUrl.ts`
- `app/reset-password/page.tsx`
- `lib/organizationContext.ts`
- `lib/supabaseBrowser.ts`
- `app/onboarding/page.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/actions/route.ts`
- `lib/booking-automation.ts`
- `lib/action-effects.ts`
- `lib/stock.ts`
- `lib/product-quantity.ts`
- `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql`
- `tests/integration/helpers.ts`

## Bottom Line

Il codice locale e pulito, testato e pronto. Il problema e il database hosted ancora pre-multi-tenancy.

Il percorso e chiaro:

1. chiudere il backlog tecnico nel codice (BT-1 → BT-5 nell'ordine indicato)
2. eseguire il cutover del database hosted seguendo il piano di questa sezione
3. rimuovere i fallback legacy (BT-3) dopo il cutover
4. aprire la beta ai primi tester

Aggiornamento operativo: prima dell'apertura beta esterna, chiudere BT-6 e rendere i flussi email beta-safe. Per BT-2 e BT-4 fare sempre prima una verifica di scope reale nel codice e nello schema.

La priorita assoluta e non rompere nulla di funzionante. Dopo ogni modifica: `npm test` + `npx tsc --noEmit` + `npm run lint`.
