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
- `20260606120000_fix_checklist_items_manut_naming.sql`
- `20260606130000_add_created_at_to_action_checklist.sql`
- `20260618100000_add_linen_role.sql`
- `20260618110000_update_delete_booking_atomic.sql`
- `20260707120000_add_unique_constraint_expenses_source_action.sql`
- `20260708110000_drop_products_sku_not_null.sql`

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

### Sessione browser reale per test/misure manuali (senza fixture Playwright)

Per verifiche che servono una sessione autenticata *vera* (non la fixture `createOwnerFlowFixture` di `tests/e2e/helpers.ts`, che crea un'org temporanea) — es. misurare performance reali, controllare un flusso a occhio, prendere uno screenshot di stato — si può aprire un Chromium visibile, far loggare l'utente a mano, e poi guidare quella stessa sessione via CDP. Non serve `chromium-cli` (non disponibile su Windows in questo ambiente): basta `playwright`, già presente in `node_modules` (dipendenza di `@playwright/test`).

**1. Apri un Chromium visibile con debug remoto** (in background, resta acceso):

```bash
NODE_PATH="<repo>/node_modules" node script-lancio.js
```
dove `script-lancio.js`:
```js
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: false, args: ["--remote-debugging-port=9222"] });
  const page = await (await browser.newContext()).newPage();
  await page.goto("http://localhost:3000/login");
  await new Promise(() => {}); // resta vivo
})();
```

**2. L'utente fa login a mano** nella finestra che si apre — niente credenziali gestite dall'agente.

**3. Un secondo script si riconnette alla stessa sessione già autenticata** e la guida:

```js
const { chromium } = require("playwright");
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0]; // la pagina già loggata
// da qui: page.click(...), page.on("console", ...), page.on("response", ...), ecc.
```

**Gotcha:**
- `NODE_PATH` è necessario solo se lo script vive fuori dalla repo (es. scratchpad): la risoluzione dei moduli di Node parte dalla directory dello script, non dalla cwd.
- **Mai chiamare `browser.close()`** sul browser ottenuto da `connectOverCDP` — su una connessione CDP chiude anche la finestra reale dell'utente, non solo la disconnessione logica. Per chiudere davvero: `taskkill` sul PID in ascolto sulla porta di debug (`netstat -ano | grep :9222`).
- Per una baseline di produzione: build (`npm run build`), poi `PORT=3002 npm start` (porta diversa per non toccare il dev server esistente su 3000), nuova finestra Chromium su una nuova porta di debug (es. 9223), nuovo login.
- Redirigere `npm start`/`npm run dev` su file (`... | tee server.log`) per poter leggere i log `[perf]` lato server dopo, non solo l'header HTTP di risposta.

Usato per la prima volta il 2026-08-17 per misurare la baseline performance reale (vedi "Audit Performance & Sicurezza Tenant" sopra) — click reali, console reale, sessione reale, zero fixture temporanee nel DB.

## Verification Status

Ultimo stato verde verificato (2026-08-21, dopo la Fase 2 performance):

- `npx tsc --noEmit` — verde
- `npx eslint .` — verde
- `npx vitest run` — verde, **153/153 test su 31 file**
- cutover hosted completato il 2026-05-25
- UI polish completo (12 task: CSS tokens, Card, KpiCard, TopBar/BottomNav, ActionBadges, page headers, btn-*/input-base su tutte le pagine, calendar amber, Recharts brand colors, dashboard KPI-first)
- mobile UX completato (card prenotazioni compatte, FAB, tab inventario, import collassato, rimozione testo ridondante)
- remote git: solo `casacleo` → `Dashboard-Casacleo` (remote `alva` rimosso)
- linen_role system attivo: 8 ruoli, vincolo univocità DB, consumo automatico su prenotazioni
- ProductCatalogEditor in settings e onboarding (biancheria con ruoli + consumabili a 3 stati)
- quantità biancheria modificabile anche post-creazione via edit form (max_qty via PATCH)
- label "Strofinacci" (era "Mappina cucina") — valore DB `mappina_cucina` invariato
- ruolo `asciugamano_corpo` aggiunto al sistema linen (9 ruoli totali)
- spese automatiche: prevenzione duplicati, delete sbloccato per tutte le origini, data allineata al giorno di completamento azione (non alla data pianificata)
- logo Alva in TopBar, dedupe fetch bookings dashboard, service worker con aggiornamenti più rapidi
- PWA: manifest/icone esposti anche senza sessione, install banner solo mobile
- vincolo `NOT NULL` residuo su `products.sku` rimosso (colonna non più usata dal linen_role system)
- **copy UI italianizzata (2026-07-09):** rimossi stati grezzi del DB mostrati in UI (`FATTO`/`DA_FARE`/`PIENO`/`A_META`/`TERMINATO`/`action_type` raw) sostituiti con etichette leggibili via `getActionTypeLabel()` in `lib/actionMeta.ts`; eliminati anglicismi decorativi (Overview, Revenue, Operations, Workspace → Oggi, Incassi, Attività, Configurazione); messaggi di errore riscritti in italiano naturale; calendario FullCalendar localizzato in italiano (`locale={itLocale}`, prima giorni/mesi erano in inglese); corretti refusi di accenti diffusi

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

## Audit Performance & Sicurezza Tenant — 2026-08-16/17

Audit sistematico su richiesta utente: 27 punti di performance forniti dall'utente, verificati uno per uno sul codice reale e sul DB di produzione (non per assunzione), più una verifica indipendente di sicurezza sul confine tenant. Analisi completa nella conversazione del 2026-08-16/17; qui solo stato e prossimi passi.

### Esito verifica dei 27 punti utente

- **Confermati e prioritari**: data loading lato client (nessuna pagina fa SSR dei dati), auth ripetuta (fino a 3 `getUser()` per navigazione), side effect sincroni su ogni PATCH azione, assenza totale di misurazione
- **Confermati, impatto medio**: cache client assente, prefetch dati assente, SWR/skeleton-su-refresh assente, service worker no-op
- **Ridimensionati**: dashboard multi-fetch (già in parallelo, guadagno reale solo se fuso con SSR), `resolveProductSchema()` dinamico (già cache-ato, verificato `{id, qty}` stabile su DB), fallback schema legacy `expenses.date` (verificato: colonna non esiste, codice morto)
- **Scartati**: region Vercel↔Supabase (già in Europa), indici DB (tutti presenti e verificati sul DB di produzione), bundle JS (già code-split correttamente: Recharts/XLSX/FullCalendar dietro `dynamic()`), piano Vercel/Supabase (non è il collo di bottiglia)

### Sei problemi di sicurezza tenant trovati indipendentemente (non nella lista dell'utente)

Verificati sul codice e sul DB di produzione (`ymthmncbuomtshulexkh`, org "Casa Cleo"). Tracciati come backlog in `### BT-7..BT-11` sotto; qui solo il riepilogo:

| # | Problema | File |
|---|----------|------|
| PT-1 | RLS scritta e attiva su tutte le tabelle ma bypassata al 100%: ogni query passa da `supabaseAdmin()` con `service_role` | `lib/supabaseAdmin.ts`, tutte le route |
| PT-2 | `resolveOrganizationId()` fallisce aperto: se il parametro manca, opera sull'organizzazione più vecchia del DB invece di lanciare | `lib/organizationContext.ts:66` |
| PT-3 | `applyBookingConsumptions()` è codice morto che imbocca il default pericoloso di PT-2 (nessun `organizationId` passato) | `lib/stock.ts:260` |
| PT-4 | RPC `apply_product_quantity_deltas_atomic` — percorso principale di scrittura magazzino — senza `organization_id` nella firma, `security definer` | migration `20260507123000` |
| PT-5 | Due `.eq("organization_id")` mancanti (non sfruttabili oggi, difesa in profondità) | `lib/stock.ts:184`, `lib/product-quantity.ts:80` |
| PT-6 | `/api/bookings` senza filtro data: carica tutte le prenotazioni di sempre ad ogni Dashboard | `app/api/bookings/route.ts` |

PT-1 è coerente con quanto già annotato sotto "Postura di sicurezza attuale" ("RLS presente ma secondaria... dato l'uso di `service_role` lato server") — qui solo quantificato e reso azionabile.

### Fase 1 (Misurazione) — COMPLETATA e mergiata su `dev`

Piano: `docs/superpowers/plans/2026-08-17-performance-measurement.md` (18 task, 17 eseguiti, Speed Insights saltato su richiesta esplicita, riprendibile).

Aggiunto:
- `lib/timing/serverTiming.ts`, `lib/timing/requestTiming.ts` — timing puro + header `Server-Timing` + log strutturato `[perf]` con `x-request-id` di correlazione middleware↔route
- `lib/perf/navMarks.ts` — marchi click→dato-visibile lato client (User Timing API, `performance.mark/measure`)
- Strumentati: `proxy.ts`, `lib/organizationContext.ts`, `lib/routeAuth.ts`, GET di `/api/bookings`, `/api/actions`, `/api/products`, `/api/finance`
- Marchi di click su `components/bottom-nav.tsx` / `components/top-bar.tsx`, marchi di dato-visibile su Dashboard/Azioni/Prenotazioni/Rifornimento/Spese
- `docs/perf/measuring.md` — protocollo di misurazione ripetibile (sessione calda, mediana su 5 campioni)

Verificato: 120/120 test passano, build pulita, verifica end-to-end reale con browser autenticato via Playwright/CDP (login manuale dell'utente, poi guida automatica), sia in dev mode che su build di produzione locale.

**Baseline raccolta il 2026-08-17** (click→dato-visibile, mediana su 5 campioni, sessione calda):

| Pagina | Dev mode | Produzione (`npm run build && npm start`) |
|---|---|---|
| Riepilogo | 1381 ms | 618 ms |
| Azioni | 785 ms | 418 ms |
| Prenotazioni | 848 ms | 531 ms |
| Rifornimento | 953 ms | 427 ms |
| Spese | 948 ms | 526 ms |

**Numero chiave da tagliare in Fase 2**: su 88 chiamate API reali in produzione, l'overhead di autenticazione duplicata (`mw-auth` nel middleware + `auth`+`roles` rifatti nella route) è **229ms di mediana per chiamata**, quasi quanto l'intera route (236ms totali, query dati inclusa). Fase 2 punta a portarlo a ~76ms condividendo il contesto auth invece di rifare `getUser()` + `user_roles` due volte per la stessa richiesta.

**Nota tecnica emersa durante l'esecuzione**: l'header HTTP `Server-Timing` che arriva al browser mostra solo la fase `mw-auth` del middleware — Next.js sovrascrive l'header della route con quello del middleware quando entrambi scrivono lo stesso nome header su `NextResponse.next()`. Il dettaglio route (`auth`/`roles`/`db-*`) è comunque sempre presente nei log server-side (`[perf]` con `"layer":"route"`), solo non nell'header HTTP. Lasciato così di proposito — la Fase 2 rende `mw-auth` ridondante comunque, non vale la pena un fix dedicato ora.

**Bug reale trovato da `npm run build`** (non previsto dal piano): narrowing TypeScript su `verified.user.id` letto dentro una closure passata a `timed()` — corretto in `proxy.ts` e `lib/organizationContext.ts` catturando l'id in una `const` prima della closure.

### Piano di fasi concordato (per riprendere)

```
Fase 1 — Misurazione                                    FATTA (mergiata su dev)
Fase 2 — DAL + auth parallela request-scoped             FATTA (2026-08-21, vedi sotto)
Fase 3 — Server Components con dati iniziali             (il sintomo dichiarato: "ci mette un attimo")
Fase 4 — Cache client + stale-while-revalidate
Fase 5 — Chiusura PT-2/PT-3/PT-4/PT-5 sopra
Fase 6 — Verifica JWT locale (signing key asimmetriche) + prefetch route probabili
Fase 7 — Round-trip delle mutazioni (syncShoppingAction condizionale, ecc.)
Fase 8 — Valutazione client RLS-enforced per PT-1 (il più invasivo, va fatto a DAL consolidato)
Fase 9 — Cleanup: schema {id,qty} hardcoded, fallback date rimossi, select espliciti, service worker
```

### Fase 2 (DAL + auth parallela) — COMPLETATA 2026-08-21

Eseguita senza un piano formale dedicato (continuazione ad-hoc della Fase 1), verificata con la
suite completa prima del commit: `npx tsc --noEmit` verde, `npx eslint .` verde, `npx vitest run`
**153/153 test verdi su 31 file** (era 120/120 su 23 file all'inizio della Fase 1).

Aggiunto:

- `lib/data/` — DAL leggero, tre moduli: `organizations.ts`, `bookings.ts`, `finance.ts`. Ogni
  modulo esporta la `select` con join annidato PostgREST e una funzione pura di proiezione riga
  che **rivalida il tenant sulla riga annidata** invece di fidarsi ciecamente del join (difesa in
  profondità: PostgREST già filtra la relazione embedded per tenant, ma il codice applicativo non
  si fida e ricontrolla `organization_id` sulla riga innestata prima di usarla).
- `lib/supabaseAuth.ts` — `verifyAccessTokenSubject()`: legge il subject dal JWT via
  `auth.getClaims()` (verifica locale di firma/scadenza, non un round-trip Supabase). Usato **solo
  come euristica di performance** per far partire la query membership in parallelo a `getUser()`
  autoritativo — mai per autorizzare da solo: se il subject "speculativo" non coincide con quello
  restituito da `getUser()`, il risultato speculativo viene scartato e la query membership rifatta
  con l'id autoritativo. Applicato sia in `proxy.ts` (fase `mw-claims`) sia in
  `requireOrganizationContext()` (fase `claims`).
- `lib/timing/requestTiming.ts` — `navigationId()`: propaga un id di navigazione lato client
  (`lib/perf/navMarks.ts`, header `x-navigation-id` iniettato da `lib/http/clientFetch.ts`) fino al
  log `[perf]` della route, per correlare un singolo click utente con tutte le chiamate API che
  genera, non solo con una singola richiesta.
- `components/navigation-feedback.tsx` + `app/loading.tsx` — barra di progresso in alto durante la
  navigazione (eventi custom `NAVIGATION_START_EVENT`/`NAVIGATION_END_EVENT` da `navMarks.ts`) e
  skeleton di caricamento route-level, per dare un feedback visivo immediato al click prima che i
  dati arrivino.
- `scripts/perf-measure.mjs` — automatizza il protocollo manuale di `docs/perf/measuring.md`:
  apre una sessione Chromium autenticata via `storageState` di Playwright, naviga N volte su
  ciascuna delle 5 pagine, misura click→dato-visibile e riporta min/p50/p75/p95.

Modificato (query, non solo timing):

- `GET /api/bookings` — join annidato con `actions` per lo stato pulizia in **una sola query**
  invece di due round-trip separati; nuovo parametro `?from=` per filtrare per data e
  `?includeCleaningStatus=false` per saltare il join quando non serve. La Dashboard (`app/page.tsx`)
  ora chiama `/api/bookings?from=<oggi>&includeCleaningStatus=false` — **chiude PT-6/BT-11** per il
  percorso caldo della Dashboard (prima caricava tutte le prenotazioni di sempre ad ogni apertura).
  `/bookings` continua a chiamare senza `from` (serve lo storico completo lì).
- `GET /api/finance` — join annidato con `actions` (`source_action`) per i dettagli rifornimento
  invece di una query separata post-fetch; fallback automatico allo schema legacy (senza FK/colonna
  `expense_date`) se il join fallisce, per restare compatibile con deployment non ancora migrati.
- `findPrimaryOrganizationForUser()` — join annidato `user_roles → organizations` in una query
  invece di due (membership poi record organizzazione separato).
- Nuovo test `tests/integration/tenant-isolation.integration.test.ts`: "la query embedded
  restituisce in un round-trip solo booking e azioni di org A" e "...dettagli rifornimento solo per
  org A" — verificano che i nuovi join non trapelino dati cross-tenant sul DB hosted reale.

Non toccato in questa fase: PT-1 (RLS bypassata da `service_role`, resta Fase 8), PT-3/PT-4/PT-5
(BT-9/BT-10/BT-11 residuo — vedi sotto), Server Components (Fase 3).

**Regola cache tenant — sempre esplicita, vale per tutte le fasi successive**: mai memorizzare sessione, `userId`, `organizationId`, `role`, membership o dati tenant in variabili globali/module-scope. Solo memoization request-scoped o cache con chiave tenant esplicita e isolamento verificato. Dati globali/immutabili/tecnici (es. lo schema prodotti in `lib/products-schema.ts:10`, TTL 30s) possono restare in cache di modulo — è il precedente già in codice, citato come esempio di cosa NON copiare per dati tenant quando si tocca la Fase 2.

Altre decisioni valide per le fasi successive:
- Il redirect onboarding nel proxy va **spostato, non eliminato**, quando si alleggerisce il middleware in Fase 2/3.
- Ogni accesso ai dati (letture incluse, non solo mutazioni) deve passare dal DAL futuro con filtro tenant applicato *dentro* la funzione, mai come parametro opzionale dimenticabile (vedi PT-2).

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

### BT-7: RLS scritta e attiva ma bypassata al 100% da `service_role`

Aperto. Vedi PT-1 in "Audit Performance & Sicurezza Tenant — 2026-08-16/17". Il confine fra i 6 tenant oggi è solo la presenza manuale di `.eq("organization_id", ...)` nel codice applicativo — nessuna verifica DB indipendente. Fix previsto in Fase 8 del piano performance: client RLS-enforced con JWT utente per le letture di dominio, `service_role` riservato a provisioning/cron/platform admin.

### BT-8: `resolveOrganizationId()` fallisce aperto

Aperto. Vedi PT-2. Se il parametro manca, `lib/organizationContext.ts:66` opera sull'organizzazione più vecchia dell'intero DB invece di lanciare. Nessun call site attuale lo sfrutta (tracciato: `action-effects.ts:567`, `booking-automation.ts:132/217`, `stock.ts:191/275` passano tutti l'org), ma è un default pericoloso per il refactor DAL della Fase 2. Fix: deve lanciare, non indovinare.

### BT-9: `applyBookingConsumptions()` codice morto su path pericoloso

Aperto. Vedi PT-3. `lib/stock.ts:260` chiama `applyBookingConsumptionDelta()` senza `organizationId`, imboccando il default di BT-8. Nessun chiamante nel codebase. Da rimuovere.

### BT-10: RPC `apply_product_quantity_deltas_atomic` senza scoping tenant

Aperto. Vedi PT-4. Percorso principale di scrittura magazzino, `security definer`, nessun `organization_id` nella firma — sicura solo perché i chiamanti filtrano prima (corretta per costruzione, non per verifica). Fix: aggiungere `p_organization_id` e filtrare dentro la RPC.

### BT-11: Filtri tenant/data mancanti minori

Parzialmente chiuso il 2026-08-21. PT-6 (`/api/bookings` senza filtro data) risolto per il percorso
Dashboard: nuovo parametro `?from=`, usato da `app/page.tsx` — vedi "Fase 2 (DAL + auth parallela)"
sopra. Resta aperto PT-5 (due `.eq("organization_id")` mancanti in `lib/stock.ts:184` e
`lib/product-quantity.ts:80`, non sfruttabili oggi) e la pagina `/bookings` stessa continua a
caricare tutto lo storico (nessun filtro data lì, per design — serve la lista completa).

### Prossimi passi

```
1. Fase 2 performance — DAL + getRequestContext() request-scoped (vedi "Audit Performance & Sicurezza Tenant")
2. BT-7..BT-11 — sicurezza tenant, da chiudere insieme al DAL della Fase 2
3. U1–U3 Miglioramenti UX (vedi sezione dedicata)
4. F1–F4 Miglioramenti funzionali (vedi sezione dedicata)
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
- `docs/perf/measuring.md` — protocollo di misurazione prima/dopo (manuale + automatizzato)
- `lib/timing/serverTiming.ts`, `lib/timing/requestTiming.ts`, `lib/perf/navMarks.ts` — strumentazione Fase 1 + correlazione navigazione Fase 2
- `lib/data/organizations.ts`, `lib/data/bookings.ts`, `lib/data/finance.ts` — DAL Fase 2 (select con join + proiezione tenant-safe)
- `scripts/perf-measure.mjs` — misurazione automatizzata click→dato-visibile

## Bottom Line

La produzione e live. Database migrato, auth nuovo attivo, UI polish completo, mobile UX ottimizzato.

Stato attuale:

- `host.alva.land` serve il codice aggiornato
- Supabase hosted ha tutte le 21 migration applicate
- organizzazione "Casa Cleo" configurata con owner `erri.dp@gmail.com`
- repo di riferimento: `Dashboard-Casacleo/main` su GitHub (watched da Vercel)
- remote git locale: solo `casacleo` (alva rimosso)
- backlog tecnico BT-1/2/3/4/5/6 tutti chiusi; BT-11 parzialmente chiuso (2026-08-21); BT-7/8/9/10 aperti (sicurezza tenant, vedi sotto)
- email transazionale attiva: `noreply@mail.alva.land` via Resend, dominio verificato
- linen_role system e ProductCatalogEditor live (2026-06-18/19)
- copy UI interamente in italiano, senza stati DB grezzi né anglicismi decorativi (2026-07-09)
- UI/UX: `IMPLEMENTATION_PLAN_UI_UX.md` (piano di riferimento) e l'audit di rifinitura del 2026-08-15 sostanzialmente implementati — Fraunces/Public Sans, dialog/drawer/sheet condivisi, TopBar/BottomNav accessibili, Rifornimento su KPI cliccabili + drawer, catalogo prodotti senza card-in-card
- E2E: fondamenta (`tests/e2e/setup|helpers|specs`, `npm run verify`, hook pre-push) completate il 2026-08-20; specs Fase 1 (bookings, actions-cleaning, inventory-restock, finance) aggiunte il 2026-08-20/21
- audit performance: Fase 1 (misurazione) mergiata il 2026-08-17, Fase 2 (DAL + auth parallela) completata il 2026-08-21 — vedi "Audit Performance & Sicurezza Tenant" sopra per baseline e dettaglio Fase 2

Prossimi passi in ordine:

1. Fase 3 performance — Server Components con dati iniziali, poi Fase 4 (cache client) — vedi piano di fasi in "Audit Performance & Sicurezza Tenant"
2. BT-7/8/9/10 — sicurezza tenant residua (RLS bypassata da `service_role`, `resolveOrganizationId()` che fallisce aperto, codice morto, RPC magazzino senza scoping)
3. U1–U3 / F1–F4 — miglioramenti UX e funzionali low effort (vedi sezione dedicata)
