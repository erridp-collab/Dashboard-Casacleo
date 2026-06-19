# Project Recap

Questo file serve come contesto di continuita per audit, handoff e ripartenza tecnica.
E il documento principale da leggere prima di qualsiasi lavoro sul progetto.

## Audit Brief

Se devi fare un audit di questo progetto, considera questi vincoli reali:

- il prodotto sta passando da tool interno a SaaS in modo graduale
- la fase attuale e `owner-only`
- non ci sono ancora ruoli multipli reali, billing reale o landing pubblica
- il database hosted e stato migrato a multi-tenancy il 2026-05-25 (cutover completato)
- la priorita attuale e rendere distribuibile e sicuro quello che gia esiste, non completare tutta la piattaforma enterprise

## Executive Summary

Gestionale operativo per affitti brevi (Casa Cleo). Le aree funzionali principali sono:

- prenotazioni
- azioni operative
- inventario e rifornimento
- biancheria
- finanza/spese

L'app era nata come strumento single-tenant per uso interno. Ora e stata portata a una base SaaS multi-tenant, con rollout graduale:

- database pronto per multi-tenancy
- auth applicativa migrata a Supabase Auth
- scoping tenant applicato alle API principali
- onboarding interno protetto post-login
- accesso nuovi utenti gestito con richiesta approvata manualmente
- modello di utilizzo attuale: un solo owner per workspace

## Produzione Attuale

| Campo | Valore |
|---|---|
| URL | `https://host.alva.land` |
| Repo GitHub | `https://github.com/erridp-collab/Dashboard-Casacleo.git` |
| Branch produzione | `main` |
| Vercel project | `dashboard-casacleo` |
| Supabase project | `ymthmncbuomtshulexkh.supabase.co` |
| Organizzazione | `Casa Cleo` (id: `6328a160-4546-46ef-a372-a087e5785d43`) |
| Owner | `erri.dp@gmail.com` (id: `d5a3aef5-f484-49f7-8fd8-aa83fa66240a`) |
| Cutover completato | 2026-05-25 |

Dati presenti in produzione dopo il cutover:

- 17 bookings
- 63 azioni
- 13 spese
- 29 prodotti

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
- catalogo prodotti con editor biancheria/consumabili (linen_role system)
- finance tracking
- sync automatiche di dominio su prenotazioni e shopping list
- cron endpoint reminder pulizie (`/api/cron/cleaning-reminder`) via Resend

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

Modello attivo (hosted + locale):

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
- fallback compatibili col caso legacy single-workspace (da rimuovere con BT-3)

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
- `app/api/products/[id]/route.ts`
- `app/api/products/bulk/route.ts`
- `app/api/products/restock/route.ts`
- `app/api/products/stock-status/route.ts`
- `app/api/finance/route.ts`
- `app/api/cron/cleaning-reminder/route.ts`

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
- consumo automatico su soggiorni (basato su linen_role)
- shopping action automatica
- catalogo prodotti CRUD (biancheria con ruoli, consumabili a 3 stati)
- modifica quantità totale (max_qty) post-creazione

Sistema linen_role:

- 8 ruoli predefiniti in `lib/linen-roles.ts` con formule di consumo
- vincolo DB: un solo prodotto per ruolo per organizzazione
- consumo automatico su create/delete prenotazione via `applyBookingConsumptionDelta()`

File chiave:

- `app/api/products/*`
- `lib/stock.ts`
- `lib/product-quantity.ts`
- `lib/products-schema.ts`
- `lib/linen-roles.ts`
- `components/product-catalog-editor.tsx`

### Finance

Responsabilita:

- aggregazione mensile revenue/expenses
- inserimento spese manuali
- delete sicuro spese manuali
- supporto spese automatiche da azioni

File chiave:

- `app/api/finance/route.ts`

## Database Migration Timeline

Tutte le migration sono state applicate al database hosted il 2026-05-25.

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
- `20260509000000_add_fk_expenses_source_action.sql`
- `20260509010000_add_bulk_product_update_atomic.sql`
- `20260618100000_add_linen_role.sql`
- `20260618110000_update_delete_booking_atomic.sql`

## Ambiente di sviluppo

Docker Supabase locale non è più usato. Tutto il lavoro avviene contro il database hosted remoto.

Configurazione `.env.local` richiesta (puntare al progetto Supabase hosted):

```
NEXT_PUBLIC_SUPABASE_URL=https://ymthmncbuomtshulexkh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key hosted>
SUPABASE_SERVICE_ROLE_KEY=<service role hosted>
```

Comandi utili:

```powershell
npx.cmd tsc --noEmit
npm run lint
npm test
npm run dev
```

Nota sui test di integrazione: girano contro il DB hosted. Ogni test crea e pulisce le proprie org di test via `createTestOrg` / `cleanupOrg`. Non toccare dati dell'org produzione (`6328a160-4546-46ef-a372-a087e5785d43`).

Migration: nuove migration vanno create in `supabase/migrations/` e applicate manualmente dalla dashboard Supabase hosted (SQL editor) oppure via `npx.cmd supabase db push --db-url <connection_string>`.

## Verification Status

Ultimo stato verde verificato (2026-06-19):

- `npx tsc --noEmit` — verde
- `npm run lint` — verde
- `npm test` — verde
- cutover hosted completato il 2026-05-25
- UI polish completo (12 task: CSS tokens, Card, KpiCard, TopBar/BottomNav, ActionBadges, page headers, btn-*/input-base su tutte le pagine, calendar amber, Recharts brand colors, dashboard KPI-first)
- mobile UX completato (card prenotazioni compatte, FAB, tab inventario, import collassato, rimozione testo ridondante)
- remote git: solo `casacleo` → `Dashboard-Casacleo` (remote `alva` rimosso)
- linen_role system attivo: 8 ruoli, vincolo univocità DB, consumo automatico su prenotazioni
- ProductCatalogEditor in settings e onboarding (biancheria con ruoli + consumabili a 3 stati)
- quantità biancheria modificabile anche post-creazione via edit form (max_qty via PATCH)
- label "Strofinacci" (era "Mappina cucina") — valore DB `mappina_cucina` invariato

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
- tenant isolation (bookings, actions, expenses, products)

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

- uso di `service_role` nei moduli server-side, ma con filtro applicativo tenant
- sync eventuali non sempre bloccanti

## Audit 2026-05-07 - Risultati e Stato

| # | Problema | File |
|---|----------|------|
| yes | `supabaseAuthClient()` usava `service_role` per auth utente | `lib/supabaseAuth.ts` |
| yes | Action update + side effects non atomici | `app/api/actions/route.ts` |
| yes | `loginAction` redirect fisso a `/onboarding` invece di `/` | `app/actions/auth.ts` |
| yes | `upsertShoppingAction` update SPESA senza filtro `organization_id` | `lib/stock.ts` |
| yes | `syncShoppingAction` eseguita ad ogni GET `/api/actions` | `app/api/actions/route.ts` |
| yes | Race condition rate limiting | `app/actions/auth.ts` + migration |

## Audit 2026-05-08 - Risultati e Stato

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
- FK `expenses.source_action_id → actions.id ON DELETE SET NULL`

---

## UI/UX Polish — Lavoro Completato

### Layer 1–4: Premium UI (2026-05-28 → 2026-06-04)

| Task | Dettaglio | Commit |
|---|---|---|
| L1: CSS foundations | token semantici, `btn-*`, `input-base`, `label-base` in `globals.css` | 6c8b4c0 |
| L2a: Card warm surface | sfondo `surface-1`, separatore gradiente | 83f2243 |
| L2b: KpiCard redesign | valore extrabold, icona opzionale, micro-label | 87e026c |
| L3a/b: TopBar + BottomNav | logo box, border attivo, amber indicator | c2c64d0 |
| L3c: ActionTypeBadge | emoji → Lucide icons | 8e652a5 |
| L3d: Page headers | pattern icon-box su tutte le pagine | b3ca5d6 |
| L2c/d: btn-*/input-base bookings | bottoni e input uniformati | 4954f5b |
| L2c/d: btn-*/input-base finance | bottoni e input uniformati | 5cd40c7 |
| L2c/d: input-base actions+inventory | input uniformati | 78ff225 |
| L4a: Calendar CSS | oggi amber, pill eventi, legend quadrati | 62f7d10 |
| L4b: Recharts brand colors | barre burgundy/amber, linea verde, tooltip caldo | 2e30d68 |
| L4c: Dashboard KPI-first | ordine KPI, legend quadrati arrotondati | 45624b6 |

### Mobile UX (2026-06-04)

| Task | Dettaglio | Commit |
|---|---|---|
| Card prenotazione compatta | stato pulizia + prezzo, date leggibili, menu `···` | 6204785 |
| FAB nuova prenotazione | fisso sopra BottomNav, solo mobile | da17b62 |
| Tab Biancheria/Consumabili | inventario su tab invece di scroll | 9686b39 |
| Import CSV collassato | espandibile on-demand | 9686b39 |
| Rimozione testo ridondante | rimosso hint statico da ogni card consumabile | 9686b39 |

---

## Miglioramenti Pianificati (Low Effort)

Miglioramenti identificati nell'audit 2026-06-04, non ancora implementati. Tutti fattibili in 1–4h ciascuno senza toccare schema DB o logica di business.

### UX

| # | Descrizione | Effort | File |
|---|---|---|---|
| U1 | Dashboard: KPI "Azioni Aperte" cliccabile → pagina azioni filtrata su `DA_FARE` | 1h | `app/page.tsx`, `app/actions/page.tsx` |
| U2 | Booking form: validazione `check_out > check_in` con messaggio inline | 1h | `app/bookings/page.tsx` |
| U3 | Elimina prenotazione: conferma con conteggio azioni collegate | 2h | `app/bookings/page.tsx`, `app/api/bookings/[id]/route.ts` |

### Funzionali

| # | Descrizione | Effort | File |
|---|---|---|---|
| F1 | Azioni: bottone "Oggi" accanto al range picker | 1h | `app/actions/page.tsx` |
| F2 | Inventario: export CSV stato attuale (xlsx già installato) | 2h | `app/inventory/page.tsx` |
| F3 | Finance: filtro per categoria sulle spese | 2h | `app/finance/page.tsx` |
| F4 | Finance: Δ% mese precedente su entrate/uscite | 3h | `app/finance/page.tsx` |

---

## Backlog Tecnico Residuo

### ~~BT-1: FK mancante su `expenses.source_action_id`~~ DONE

Chiuso con migration `20260509000000_add_fk_expenses_source_action.sql`.

### ~~BT-2: `PATCH /api/products` con loop non transazionale~~ DONE

Chiuso con migration `20260509010000_add_bulk_product_update_atomic.sql` + RPC `bulk_update_products`.

### ~~BT-3: Rimozione fallback schema legacy~~ DONE

Chiuso con commit `c69c6ce`. Rimossa funzione `isMissingTotalAmountError` e i 2 call site da `app/api/bookings/route.ts`. Le route `actions` e `finance` non avevano fallback reali.

### ~~BT-4: 6 varianti checklist insert in `booking-automation.ts`~~ DONE

Chiuso con refactor `e09ce53`.

### ~~BT-5: Test di tenant isolation end-to-end~~ DONE

Chiuso con `e22fb71 test: add tenant isolation integration tests`.

### ~~BT-6: Hardening email beta-safe~~ DONE

Chiuso il 2026-06-13. Configurazione confermata funzionante in produzione.

- sender verificato: `Alva Host Manager <noreply@mail.alva.land>` (dominio verificato su Resend con SPF/DKIM)
- `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_SITE_URL` corretti su Vercel
- `sendWelcomeEmail` inviata al nuovo utente all'approvazione (fire-and-forget)
- `sendSignupRequestNotification` inviata all'admin (`erri.dp@gmail.com`) per ogni nuova richiesta
- test email reale inviato e ricevuto correttamente

### Prossimi passi

```
1. U1–U3 Miglioramenti UX (vedi sezione dedicata)
2. F1–F4 Miglioramenti funzionali (vedi sezione dedicata)
```

Dopo ogni modifica: `npm test` + `npx tsc --noEmit` + `npm run lint` devono passare tutti.

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

## Integrazioni Future Pianificate

### Sync prenotazioni da Airbnb via iCal

Airbnb non espone API pubbliche per singoli host. L'unico metodo disponibile è il link iCal che Airbnb genera nel pannello host (si aggiorna ogni ~15-30 minuti).

Piano:
- polling periodico del link iCal via cron (es. `/api/cron/ical-sync`)
- parsing eventi iCal → `bookings` nel DB
- gestione upsert con deduplicazione su `uid` iCal
- nessun dato critico perso: il link iCal è read-only, non modifica Airbnb
- prerequisito: salvare il link iCal dell'host in `organizations.settings`

Impatto: elimina l'inserimento manuale delle prenotazioni Airbnb — dato operativamente più significativo.

### Portale Alloggiati Web — registrazione ospiti automatica

Il Ministero dell'Interno (Polizia di Stato) richiede la comunicazione dei dati degli ospiti entro 24h dall'arrivo tramite il portale [alloggiatiweb.poliziadistato.it](https://alloggiatiweb.poliziadistato.it).

Il portale espone un'API SOAP ufficiale che i PMS italiani usano per l'invio automatico.

Piano:
- credenziali API ottenibili dalla questura locale (username + password + codice struttura)
- client SOAP/XML in `lib/alloggiatiWeb.ts`
- trigger: check-in registrato → dati ospite già presenti nella prenotazione → invio automatico
- dati richiesti per ogni ospite: nome, cognome, data nascita, nazionalità, tipo documento, numero documento, data arrivo, data partenza
- oggi i dati ospite non sono ancora nel form prenotazione → il form va esteso con i campi anagrafici
- risposta API: conferma o errore → salvare stato invio su `bookings`

Impatto: elimina la compilazione manuale sul portale, operazione oggi fatta a mano entro 24h da ogni check-in.

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

Ambiente: sviluppo contro DB hosted remoto. Nessun Docker. `.env.local` deve puntare a `ymthmncbuomtshulexkh.supabase.co`.

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
- `lib/linen-roles.ts`
- `components/product-catalog-editor.tsx`
- `app/api/products/[id]/route.ts`
- `supabase/migrations/20260507150000_add_multi_tenant_foundation.sql`
- `supabase/migrations/20260618100000_add_linen_role.sql`
- `tests/integration/helpers.ts`

## Bottom Line

La produzione e live. Database migrato, auth nuovo attivo, UI polish completo, mobile UX ottimizzato.

Stato attuale:

- `host.alva.land` serve il codice aggiornato
- Supabase hosted ha tutte le 21 migration applicate
- organizzazione "Casa Cleo" configurata con owner `erri.dp@gmail.com`
- repo di riferimento: `Dashboard-Casacleo/main` su GitHub (watched da Vercel)
- remote git locale: solo `casacleo` (alva rimosso)
- backlog tecnico BT-1/2/3/4/5/6 tutti chiusi
- email transazionale attiva: `noreply@mail.alva.land` via Resend, dominio verificato
- linen_role system e ProductCatalogEditor live (2026-06-18/19)

Prossimi passi in ordine:

1. U1–U3 / F1–F4 — miglioramenti UX e funzionali low effort (vedi sezione dedicata)
