# Project Recap

Questo file serve come contesto di continuita per audit, handoff e ripartenza tecnica.

## Audit Brief

Se devi fare un audit di questo progetto, considera questi vincoli reali:

- il prodotto sta passando da tool interno a SaaS in modo graduale
- la fase attuale e `owner-only`
- non ci sono ancora ruoli multipli reali, billing reale o landing pubblica
- il setup verificato degli ultimi lavori e il Supabase locale su Docker
- non dare per scontato che il progetto hosted remoto abbia tutte le ultime migration SaaS se non viene verificato esplicitamente
- la priorita attuale e rendere il prodotto usabile per primi clienti tester, non completare tutta la piattaforma enterprise

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
- modello di utilizzo attuale: un solo owner per workspace

## Product Scope Right Now

Quello che esiste davvero oggi:

- login email/password
- signup con creazione workspace
- forgot password
- reset password
- onboarding iniziale obbligatorio dopo login
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
- `components/` UI condivisa
- `lib/` logica di dominio e integrazione DB
- `supabase/migrations/` schema history
- `tests/` unit + integration

## Current User Flow

Flusso attuale per un nuovo tester:

1. riceve direttamente il link dell'app
2. apre `/signup`
3. crea account con email/password
4. il sistema crea:
   - utente Supabase Auth
   - `organization`
   - membership `owner` in `user_roles`
5. al primo accesso entra nel flusso `/onboarding`
6. completa i dati base del workspace
7. poi usa la dashboard normalmente

Flusso per utente esistente:

1. apre `/login`
2. login email/password
3. il server risolve la membership e l'organizzazione attiva
4. se `onboarding_completed` non e true, redirect automatico a `/onboarding`
5. altrimenti accesso normale alle aree protette

## Authentication Model

Vecchio modello:

- password condivisa di squadra
- cookie HMAC custom

Nuovo modello:

- Supabase Auth
- login/signup server-side
- cookie server-side per access/refresh token
- verifica sessione in `proxy.ts`
- refresh sessione server-side quando necessario
- rate limiting login via tabella `auth_rate_limits` con fallback in-memory
- reset password client-side via `supabaseBrowserClient()`

File chiave:

- `app/actions/auth.ts`
- `lib/supabaseAuth.ts`
- `lib/supabaseBrowser.ts`
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

## Route Protection

La protezione attuale vive in `proxy.ts`.

Regole:

- senza sessione:
  - API protette -> `401`
  - pagine protette -> redirect `/login`
- con sessione:
  - `/login` e `/signup` -> redirect `/`
- con sessione ma onboarding incompleto:
  - redirect automatico verso `/onboarding`

Nota importante per audit:

- il proxy non deve essere considerato l'unico layer di sicurezza
- le API principali validano anche il contesto organizzativo lato server

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

Questo e il pezzo centrale del nuovo modello applicativo.

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
- `20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `20260508120000_drop_create_booking_function.sql`
- `20260508130000_add_booking_overlap_exclusion.sql`

Le migration SaaS piu importanti oggi sono:

- `20260507150000_add_multi_tenant_foundation.sql`
- `20260507154000_fix_atomic_product_uuid_lookup.sql`
- `20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `20260508130000_add_booking_overlap_exclusion.sql`

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
- non assumere che il progetto remoto hosted sia automaticamente allo stesso livello senza verifica esplicita

## Verification Status

Alla fine dell'ultima sessione risultava tutto verde su locale:

- `npx supabase db push --local`
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`

Suite integration rilevanti:

- booking automation
- action effects
- stock consumption
- stock atomic

## Known Design Choices

Scelte intenzionali attuali:

- owner-only beta
- onboarding minimo ma protetto
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

### Postura di sicurezza attuale

- auth Supabase con verifica server-side dei JWT
- `supabaseAuthClient()` usa anon key
- session cookie httpOnly + sameSite lax
- filtro `organization_id` applicativo su tutte le query sensibili
- RLS presente ma secondaria rispetto ai filtri applicativi, dato l'uso di `service_role` lato server
- rate limiting atomico via RPC `upsert_rate_limit`
- `logoutAction` con origin check esplicito
- reset password client-side via `supabaseBrowserClient()`
- security headers in `next.config.ts`
- constraint DB `bookings_no_overlap` per bloccare collisioni concorrenti sui booking

## Backlog Tecnico Residuo

- FK mancante su `expenses.source_action_id`
- `PATCH /api/products` con loop non transazionale
- fallback schema legacy ancora attivi in `bookings/route.ts`, `actions/route.ts`, `finance/route.ts`
- 6 varianti checklist insert in `booking-automation.ts` ancora presenti come relitto legacy
- test tenant isolation ancora mancanti

## What Is Not Done Yet

Mancanze consapevoli:

- invite collaborators
- switch workspace
- role-based permissions reali
- Stripe billing reale
- customer portal
- pagina marketing/public

## Suggested Next Steps

Stato attuale: il nucleo beta e stato stabilizzato e gli audit principali sono stati chiusi su locale.

Prossimi passi sensati:

1. verificare che l'ambiente hosted abbia applicato anche le migration `20260508100000`, `20260508120000`, `20260508130000`
2. aggiungere FK su `expenses.source_action_id`
3. aggiungere test di tenant isolation end-to-end
4. rimuovere i fallback schema legacy dopo verifica hosted
5. aggiungere loading states ed error boundaries nelle aree dati principali

## Fast Re-Entry Files

Aprire subito questi file per riprendere:

- `README.md`
- `PROJECT_RECAP.md`
- `app/actions/auth.ts`
- `app/reset-password/page.tsx`
- `proxy.ts`
- `next.config.ts`
- `lib/organizationContext.ts`
- `lib/supabaseBrowser.ts`
- `app/onboarding/page.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/actions/route.ts`
- `lib/booking-automation.ts`
- `lib/action-effects.ts`
- `lib/stock.ts`
- `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql`
- `supabase/migrations/20260507154000_fix_atomic_product_uuid_lookup.sql`
- `supabase/migrations/20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `supabase/migrations/20260508120000_drop_create_booking_function.sql`
- `supabase/migrations/20260508130000_add_booking_overlap_exclusion.sql`

## Bottom Line

L'obiettivo attuale non e completare il SaaS, ma rendere distribuibile e sicuro quello che gia esiste.

La base per farlo c'e gia:

- auth Supabase funzionante
- reset password funzionante senza token nel DOM
- organization e multi-tenancy presenti a livello DB e API
- onboarding protetto post-login
- tutte le aree operative funzionanti

Il passo successivo e consolidare hosted, chiudere il backlog tecnico residuo e poi validare la beta con tester reali prima di aggiungere feature enterprise.
