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

1. riceve direttamente il link dell’app
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
3. il server risolve la membership e l’organizzazione attiva
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

File chiave:

- `app/actions/auth.ts`
- `lib/supabaseAuth.ts`
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
- l’uso applicativo attuale e semplificato a un owner per workspace
- il sistema e quindi SaaS-ready ma non ancora “SaaS-complete”

## Onboarding Model

L’onboarding non e pubblico. E accessibile solo dopo autenticazione.

Stato onboarding:

- memorizzato dentro `organizations.settings`
- chiave principale: `onboarding_completed`

Durante l’onboarding si configurano:

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

- il proxy non deve essere considerato l’unico layer di sicurezza
- le API principali validano anche il contesto organizzativo lato server

## Organization Context Resolution

Il contesto tenant viene risolto lato server in `lib/organizationContext.ts`.

Il modulo si occupa di:

- leggere cookie sessione
- verificare utente
- recuperare membership in `user_roles`
- scegliere l’organizzazione attiva
- persistere `active-organization-id` in cookie
- caricare il record organizzazione
- determinare se l’onboarding e completato

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

Le due migration SaaS cruciali sono:

- `add_multi_tenant_foundation`
- `fix_atomic_product_uuid_lookup`

## Local Environment Reality

L’ultima iterazione e stata verificata sul Supabase locale Docker.

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

- l’ultimo lavoro SaaS e stato validato sul locale Docker
- non assumere che il progetto remoto hosted sia automaticamente allo stesso livello senza verifica esplicita

## Verification Status

Alla fine dell’ultima sessione risultava tutto verde su locale:

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

## Audit 2026-05-07 — Risultati e Stato

Audit completo eseguito il 2026-05-07. Piano: `docs/superpowers/plans/2026-05-07-security-critical-fixes.md`.

### Corretti (commit 925ff46)

| # | Problema | File |
|---|----------|------|
| ✅ | `supabaseAuthClient()` usava `service_role` per auth utente | `lib/supabaseAuth.ts` |
| ✅ | Action update + side effects non atomici (stato inconsistente) | `app/api/actions/route.ts` |
| ✅ | `loginAction` redirect fisso a `/onboarding` invece di `/` | `app/actions/auth.ts` |
| ✅ | `upsertShoppingAction` update SPESA senza filtro `organization_id` | `lib/stock.ts` |
| ✅ | `syncShoppingAction` eseguita ad ogni GET /api/actions | `app/api/actions/route.ts` |
| ✅ | Race condition rate limiting (SELECT + UPDATE non atomici) | `app/actions/auth.ts` + migration |

### Backlog Tecnico — Da affrontare in ordine di priorità

**P1 — Prima dei primi tester**

- **CSRF su Server Actions (almeno logout)**: `logoutAction` non ha protezione CSRF esplicita. Next.js App Router aggiunge alcuni header check ma non equivale a CSRF token. Valutare `origin` check server-side.
- **RLS bypassa `service_role` — documentazione e audit query**: Tutte le route usano `supabaseAdmin()` (service_role), che salta RLS. La sicurezza tenant è affidata al filtro `.eq("organization_id", organizationId)` in ogni query. Auditare che OGNI query lo abbia — anche quelle su `actions`, `action_checklist`, `expenses`. La RLS è protezione solo per connessioni dirette al DB.
- **`resolveDefaultOrganizationId` come fallback globale**: `lib/organizationContext.ts:53` — ritorna la prima org in assoluto se un utente non ha membership. Va rimosso o trasformato in errore esplicito prima di avere più tenant reali.

**P2 — Robustezza pre-scale**

- **FK mancante su `expenses.source_action_id`**: eliminando un'action, le spese collegate restano orfane. Aggiungere FK `references public.actions(id) on delete set null`.
- **`PATCH /api/products` — loop non transazionale**: aggiorna ogni prodotto in query separate. Se fallisce a metà, i primi sono committed. Servono una RPC atomica o check pre-loop.
- **Resync fire-and-forget senza recovery visibile**: `scheduleBookingDomainResync` in `lib/booking-automation.ts` — se fallisce dopo i 2 retry, l'errore va solo nei log. Considerare un campo `sync_status` su bookings o un sistema di notifica errore.

**P3 — Cleanup tecnico (quando si rimuovono le migration legacy)**

- **Fallback schema legacy ancora attivi**: doppi tentativi di query in `bookings/route.ts`, `actions/route.ts`, `finance/route.ts`. Rimuoverli una volta verificato che tutti gli ambienti (incluso hosted) hanno le migration SaaS applicate.
- **6 varianti checklist insert in `booking-automation.ts`**: `ensureChecklist` prova 6 combinazioni di colonne. Relitto legacy. Rimuovere appena schema stabilizzato.
- **`create_booking()` SQL function**: nella migration `20260507150000` — contiene logica duplicata rispetto all'applicazione. Non risulta usata dalle route. Va rimossa o documentata.
- **`toAmount`, `isValidIsoDate`, `isMissingColumn` duplicate**: estratte in modulo condiviso.

**P4 — UX / Frontend**

- **Labels `sr-only` nel form login**: i placeholder sostituiscono le label visibili. Su campo compilato non c'è label visibile. Aggiungere label visibili.
- **Password senza toggle visibilità**: input password senza eye icon, impatta mobile.
- **Loading states nelle pagine dati**: nessun feedback visivo su bookings/actions/inventory durante fetch.
- **Validazione UUID `bookingId` nei query params** di `GET /api/actions`.
- **Lunghezza minima `organization_name`** in signup — attualmente 1 carattere è accettato.

### Postura di sicurezza attuale (per audit futuri)

- **Auth**: Supabase Auth con JWT verificato server-side. `supabaseAuthClient()` usa anon key (fix applicato). Session cookie httpOnly + sameSite lax.
- **Tenant isolation**: filtro `organization_id` applicativo su ogni query. RLS presente ma bypassata da service_role server-side — è una difesa secondaria (per connessioni dirette al DB), non primaria.
- **Rate limiting**: atomico via RPC `upsert_rate_limit` con fallback in-memory.
- **CSRF**: non gestito esplicitamente — dipende dai check automatici Next.js App Router.

## What Is Not Done Yet

Mancanze consapevoli (invariate):

- forgot password
- invite collaborators
- switch workspace
- role-based permissions reali
- Stripe billing reale
- customer portal
- pagina marketing/public

## Suggested Next Steps

Ordine consigliato post-audit:

1. ✅ audit completo sicurezza + architettura
2. ✅ fix dei findings critici P0/P1
3. CSRF hardening (logout almeno)
4. forgot password
5. rifinitura onboarding/settings
6. rimozione fallback legacy (dopo verifica ambiente hosted)
7. inviti collaboratori
8. eventuale scaffold billing
9. Stripe reale solo dopo validazione beta

## Fast Re-Entry Files

Aprire subito questi file per riprendere:

- `README.md`
- `PROJECT_RECAP.md`
- `app/actions/auth.ts`
- `proxy.ts`
- `lib/organizationContext.ts`
- `app/onboarding/page.tsx`
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/actions/route.ts`
- `lib/booking-automation.ts`
- `lib/action-effects.ts`
- `lib/stock.ts`
- `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql`
- `supabase/migrations/20260507154000_fix_atomic_product_uuid_lookup.sql`

## Bottom Line

Il progetto non e piu solo un tool interno: oggi ha una base SaaS reale, ma volutamente semplificata per beta privata.

La fotografia corretta e:

- SaaS foundation presente
- owner-only beta attiva
- onboarding interno presente
- multi-tenancy a livello DB e API gia introdotta
- prodotto ancora in fase di affinamento prima di ruoli, billing e scala piu ampia
