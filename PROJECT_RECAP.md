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

Vecchio modello:

- password condivisa di squadra
- cookie HMAC custom

Nuovo modello:

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
- non assumere che il progetto remoto hosted sia automaticamente allo stesso livello senza verifica esplicita

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

## Backlog Tecnico Residuo

- FK mancante su `expenses.source_action_id`
- `PATCH /api/products` con loop non transazionale
- fallback schema legacy ancora attivi in `bookings/route.ts`, `actions/route.ts`, `finance/route.ts`
- 6 varianti checklist insert in `booking-automation.ts` ancora presenti come relitto legacy
- test tenant isolation ancora mancanti

## Open Rollout Tracks

Le due cose ancora aperte a livello prodotto/rollout non sono piu tanto di codice puro, ma di migrazione e operativita:

1. migrare il sistema senza perdere i dati e la continuita dell'utente attivo
2. definire il setup piu semplice possibile per nuovi utenti, supporto operativo e monitoraggio

Questi due binari sono i prossimi da gestire.

## Migration Plan For Current Active User

Obiettivo:

- portare l'utente gia attivo nel nuovo modello SaaS senza perdere dati, membership o continuita operativa

Piano consigliato:

1. fotografare lo stato attuale hosted prima di qualsiasi cutover
   - backup database
   - lista utenti Auth
   - organizzazioni presenti
   - membership `user_roles`
   - stato `organizations.settings.onboarding_completed`
2. identificare il workspace reale che rappresenta l'utente storico
   - verificare se tutto il dato legacy e gia dentro una sola `organization`
   - se esiste una `Legacy Workspace`, confermare se e quella giusta o se va rinominata
3. collegare l'utente attivo a quel workspace nel nuovo modello
   - utente Auth corretto
   - membership `owner` in `user_roles`
   - `active-organization-id` coerente
4. verificare che tutti i dati storici puntino alla stessa `organization`
   - bookings
   - actions
   - expenses
   - products
   - counters
5. validare il flusso completo dell'utente storico
   - login
   - arrivo su dashboard oppure onboarding se necessario
   - accesso a bookings/actions/finance/inventory
6. fare il cutover hosted solo dopo prova locale o staging molto vicina al reale
7. tenere una procedura di rollback semplice
   - backup disponibile
   - query per ricontrollare membership e org attiva

Rischi principali da evitare:

- utente Auth corretto ma senza `user_roles`
- dati storici sparsi su piu `organization_id`
- `active-organization-id` che punta a una org sbagliata
- onboarding che ricompare per errore su un workspace gia configurato

Definizione di done:

- l'utente storico entra senza attrito
- vede tutti i suoi dati precedenti
- il workspace giusto e quello attivo
- nessuna area operativa restituisce `Forbidden` o dati vuoti per mismatch tenant

## Simple New User Setup And Monitoring Plan

Obiettivo:

- rendere il percorso del nuovo utente e il supporto admin il piu semplice possibile, con un minimo chiaro di monitoraggio

Percorso semplice da mantenere:

1. utente invia `Richiedi accesso`
2. admin approva da `/platform/requests`
3. utente riceve reset/set password
4. primo login
5. onboarding
6. uso normale del workspace

Setup minimo consigliato per nuovi utenti:

- un solo `platform admin` operativo iniziale
- approvazione manuale delle richieste
- email reset native Supabase all'inizio
- onboarding corto, senza campi extra
- supporto account solo da `/platform/accounts`

Monitoraggio minimo da impostare:

1. richieste accesso
   - quante `pending`
   - quante `failed`
   - tempo medio tra richiesta e approvazione
2. auth/support
   - reset password non riusciti
   - login falliti anomali
   - account disabilitati / riattivati
3. provisioning
   - richieste finite in `failed`
   - creazione user/org/membership non completa
4. runtime applicativo
   - errori `401/403/500` sulle API principali
   - errori `409` booking overlap
5. smoke metrics prodotto
   - nuovi utenti approvati
   - onboarding completati
   - workspace che entrano davvero in dashboard

Strumenti minimi da usare:

- log app/server
- dashboard Supabase Auth
- query su `signup_requests`
- controllo manuale iniziale da `/platform`

Runbook semplice per admin:

1. controlla `/platform/requests`
2. approva o rifiuta
3. se `failed`, usa retry provisioning
4. se l'utente non entra, usa `/platform/accounts`
   - resend reset link
   - disable/reactivate solo se serve
5. se c'e un problema dati, controlla membership e `organization_id`

Definizione di done:

- un nuovo utente entra senza assistenza tecnica extra
- l'admin riesce a gestire richieste e reset senza shell
- gli errori principali sono visibili in modo semplice

## What Is Not Done Yet

Mancanze consapevoli:

- invite collaborators
- switch workspace
- role-based permissions reali
- Stripe billing reale
- customer portal
- pagina marketing/public

## Suggested Next Steps

Stato attuale: il nucleo beta e stato stabilizzato, gli audit principali sono stati chiusi su locale e la distribuzione e ora impostata come beta privata con approvazione manuale accessi.

Prossimi passi immediati per ripartire bene:

1. eseguire il `Migration Plan For Current Active User` su hosted con backup e verifica membership/dati
2. impostare il `Simple New User Setup And Monitoring Plan` in versione minima operativa
3. verificare che l'ambiente hosted abbia applicato anche la migration `20260508140000_add_signup_requests.sql` oltre a `20260508100000`, `20260508120000`, `20260508130000`
4. documentare in modo operativo la promozione di futuri `platform admin`
5. decidere se introdurre una action esplicita di "riapertura" per richieste `rejected` invece di lasciarle terminali

Prossimi passi tecnici dopo il setup admin:

1. aggiungere FK su `expenses.source_action_id`
2. aggiungere test di tenant isolation end-to-end
3. rimuovere i fallback schema legacy dopo verifica hosted
4. aggiungere loading states ed error boundaries nelle aree dati principali
5. valutare invio email transazionale dedicato invece del solo reset link Supabase

## Fast Re-Entry Files

Aprire subito questi file per riprendere:

- `README.md`
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
- `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql`
- `supabase/migrations/20260507154000_fix_atomic_product_uuid_lookup.sql`
- `supabase/migrations/20260508100000_fix_delete_booking_atomic_org_filter.sql`
- `supabase/migrations/20260508120000_drop_create_booking_function.sql`
- `supabase/migrations/20260508130000_add_booking_overlap_exclusion.sql`
- `supabase/migrations/20260508140000_add_signup_requests.sql`

## Bottom Line

L'obiettivo attuale non e completare il SaaS, ma rendere distribuibile e sicuro quello che gia esiste.

La base per farlo c'e gia:

- auth Supabase funzionante
- request access con approvazione admin
- console `/platform` per operazioni amministrative
- primo `platform admin` gia configurato e accessibile in locale
- reset password funzionante senza token nel DOM
- organization e multi-tenancy presenti a livello DB e API
- onboarding protetto post-login
- tutte le aree operative funzionanti

Il passo successivo piu concreto e validare tutto in locale il flusso richiesta -> approvazione -> onboarding, poi allineare hosted e chiudere il backlog tecnico residuo prima di aprire la beta a tester reali.

Questo flusso locale ora risulta validato. Il passo successivo piu concreto e allineare hosted e poi chiudere il backlog tecnico residuo prima di aprire la beta a tester reali.
