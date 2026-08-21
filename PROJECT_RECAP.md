# Project Recap

Questo file serve come contesto di continuita per audit, handoff e ripartenza tecnica.
E il documento principale da leggere prima di qualsiasi lavoro sul progetto.

Descrive lo stato attuale del progetto e le decisioni che restano valide per il lavoro futuro.
Non è un log storico: per la cronologia di cosa è stato fatto e quando, vedi `git log`.

## Audit Brief

Se devi fare un audit di questo progetto, considera questi vincoli reali:

- il prodotto sta passando da tool interno a SaaS in modo graduale
- la fase attuale e `owner-only`
- non ci sono ancora ruoli multipli reali, billing reale o landing pubblica
- il database hosted e multi-tenant
- la priorita attuale e rendere distribuibile e sicuro quello che gia esiste, non completare tutta la piattaforma enterprise

## Executive Summary

Gestionale operativo per affitti brevi (Casa Cleo). Le aree funzionali principali sono:

- prenotazioni
- azioni operative
- inventario e rifornimento
- biancheria
- finanza/spese

L'app è una base SaaS multi-tenant con rollout graduale:

- database pronto per multi-tenancy
- auth applicativa su Supabase Auth
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
- Vitest + Playwright

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
- `lib/data/` DAL leggero: `select` con join annidato PostgREST + proiezione riga che rivalida sempre il tenant sulla riga innestata (mai fiducia cieca nel join — PostgREST già filtra la relazione embedded, ma il codice applicativo ricontrolla `organization_id` prima di usarla)
- `lib/timing/`, `lib/perf/` strumentazione performance (Server-Timing, log `[perf]`, correlazione click→richieste via `navigationId`)
- `supabase/migrations/` schema history
- `tests/` unit + integration; `tests/e2e/` Playwright (vedi sotto)

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

Modello attivo:

- Supabase Auth
- login server-side
- request access server-side
- cookie server-side per access/refresh token
- verifica sessione in `proxy.ts` — `getUser()` resta sempre l'autorità; una lettura locale del
  subject JWT (`verifyAccessTokenSubject()`) può far partire la query membership in anticipo, ma
  viene scartata se non coincide con `getUser()`
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

Il modello SaaS e fondato su:

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

Il database ha RLS, helper SQL, trigger di coerenza tenant.

Importante:

- la struttura e multi-tenant
- l'uso applicativo attuale e semplificato a un owner per workspace
- il sistema e quindi SaaS-ready ma non ancora "SaaS-complete"

**Regola cache tenant — sempre esplicita**: mai memorizzare sessione, `userId`, `organizationId`,
`role`, membership o dati tenant in variabili globali/module-scope. Solo memoization
request-scoped o cache con chiave tenant esplicita e isolamento verificato. Dati
globali/immutabili/tecnici (es. lo schema prodotti in `lib/products-schema.ts`, TTL 30s) possono
restare in cache di modulo — è l'unico precedente accettabile, non va copiato per dati tenant.

**Ogni accesso ai dati** (letture incluse, non solo mutazioni) deve passare da un punto che applica
il filtro tenant *dentro* la funzione, mai come parametro opzionale dimenticabile (vedi BT-8 sotto).

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

**Decisione valida per il futuro**: il redirect onboarding vive nel proxy — va **spostato, non
eliminato**, quando si alleggerisce il middleware nelle fasi successive del piano performance.

## Platform Admin / Access Requests

Pezzi coinvolti:

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

Il contesto tenant viene risolto lato server in `lib/organizationContext.ts`
(`requireOrganizationContext()`). Il modulo si occupa di:

- leggere cookie sessione
- verificare utente (`getUser()`, sempre autoritativo)
- recuperare membership in `user_roles`
- scegliere l'organizzazione attiva
- persistere `active-organization-id` in cookie
- caricare il record organizzazione (join annidato via `lib/data/organizations.ts`)
- determinare se l'onboarding e completato

Questo e il pezzo centrale del modello applicativo tenant.

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
- le query vengono filtrate con `organization_id`, con join annidati (`lib/data/*`) dove serve evitare round-trip separati — ogni riga innestata viene rivalidata sul tenant prima dell'uso
- `GET /api/bookings` supporta `?from=` (filtro data) e `?includeCleaningStatus=false` (salta il join azioni quando non serve) — la Dashboard li usa entrambi, `/bookings` no (serve lo storico completo)
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
- `lib/data/bookings.ts`

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
- rifornimento (drawer dedicato in `/inventory`, aperto dalle KPI cliccabili)
- consumo automatico su soggiorni (basato su linen_role)
- shopping action automatica
- catalogo prodotti CRUD (biancheria con ruoli, consumabili a 3 stati)
- modifica quantità totale (max_qty) post-creazione

Sistema linen_role:

- ruoli predefiniti in `lib/linen-roles.ts` con formule di consumo
- vincolo DB: un solo prodotto per ruolo per organizzazione
- consumo automatico su create/delete prenotazione via `applyBookingConsumptionDelta()`

File chiave:

- `app/api/products/*`
- `lib/stock.ts`
- `lib/product-quantity.ts`
- `lib/products-schema.ts`
- `lib/linen-roles.ts`
- `components/product-catalog-editor.tsx`
- `components/refill-consumables-modal.tsx`, `components/refill-linen-modal.tsx`

### Finance

Responsabilita:

- aggregazione mensile revenue/expenses
- inserimento spese manuali
- delete sicuro spese manuali
- supporto spese automatiche da azioni

File chiave:

- `app/api/finance/route.ts`
- `lib/data/finance.ts`

## Ambiente di sviluppo

Docker Supabase locale non è usato. Tutto il lavoro avviene contro il database hosted remoto.

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
npm run verify        # unit + smoke E2E, gira anche nel pre-push hook
npm run dev
```

Nota sui test di integrazione: girano contro il DB hosted. Ogni test crea e pulisce le proprie org di test via `createTestOrg` / `cleanupOrg`. Non toccare dati dell'org produzione (`6328a160-4546-46ef-a372-a087e5785d43`).

Migration: nuove migration vanno create in `supabase/migrations/` e applicate manualmente dalla dashboard Supabase hosted (SQL editor) oppure via `npx.cmd supabase db push --db-url <connection_string>`.

### E2E (Playwright)

`tests/e2e/` è organizzato in `setup/` (login una tantum, salva `storageState`), `helpers/`
(fixture, interazioni realistiche da tastiera, sweeper dati orfani) e `specs/` (specs dirette
sull'account personale via `storageState`; `specs/fixtures/` per le specs che hanno bisogno di
un'org usa-e-getta). `npm run test:e2e:smoke` gira solo i test taggati `@smoke`; `npm run verify`
= unit + smoke, ed è quello che gira nel pre-push hook (`.githooks/pre-push`, va attivato una
tantum per clone con `git config core.hooksPath .githooks`).

### Sessione browser reale per test/misure manuali (senza fixture Playwright)

Per verifiche che servono una sessione autenticata *vera* (non la fixture `createOwnerFlowFixture` di `tests/e2e/helpers/fixtures.ts`, che crea un'org temporanea) — es. misurare performance reali, controllare un flusso a occhio, prendere uno screenshot di stato — si può aprire un Chromium visibile, far loggare l'utente a mano, e poi guidare quella stessa sessione via CDP. Non serve `chromium-cli` (non disponibile su Windows in questo ambiente): basta `playwright`, già presente in `node_modules` (dipendenza di `@playwright/test`).

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
- `scripts/perf-measure.mjs` automatizza la versione ripetibile di questo protocollo (N navigazioni per pagina, percentili) usando lo `storageState` salvato da Playwright invece del login manuale — preferirlo quando serve solo il numero, non l'ispezione visiva.

## Verification Status

Stato verde richiesto prima di ogni commit:

```bash
npx tsc --noEmit
npx eslint .
npm run verify   # npm test + npm run test:e2e:smoke
```

Suite unit/integration rilevanti: booking automation, action effects, stock consumption, stock
atomic, auth actions, public form protection, platform admin guard, platform request/account
actions, tenant isolation (bookings, actions, expenses, products — inclusi i join embedded del
DAL), organization context/data, route auth, request timing, client fetch telemetry.

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

- uso di `service_role` nei moduli server-side, ma con filtro applicativo tenant (vedi BT-7)
- sync eventuali non sempre bloccanti

## Postura di sicurezza attuale

- auth Supabase con verifica server-side dei JWT (`getUser()` sempre autoritativo)
- `supabaseAuthClient()` usa anon key
- session cookie httpOnly + sameSite lax
- platform admin separato via `app_metadata.is_platform_admin`
- filtro `organization_id` applicativo su tutte le query sensibili, con rivalidazione esplicita anche sulle righe innestate nei join (`lib/data/*`)
- RLS presente ma secondaria rispetto ai filtri applicativi, dato l'uso di `service_role` lato server — vedi BT-7
- rate limiting atomico via RPC `upsert_rate_limit`
- `logoutAction` con origin check esplicito
- reset password client-side via `supabaseBrowserClient()`
- honeypot + timing check su `login`, `signup/request access`, `forgot password`
- security headers in `next.config.ts`
- constraint DB `bookings_no_overlap` per bloccare collisioni concorrenti sui booking
- FK `expenses.source_action_id → actions.id ON DELETE SET NULL`

## Piano di fasi — Performance

```
Fase 1 — Misurazione (Server-Timing, log [perf], nav marks)     FATTA
Fase 2 — DAL con join + auth parallela via JWT claims           FATTA
Fase 3 — Server Components con dati iniziali                    PROSSIMA (sintomo: "ci mette un attimo")
Fase 4 — Cache client + stale-while-revalidate
Fase 5 — Chiusura BT-9/BT-10/BT-11 residuo (vedi backlog sotto)
Fase 6 — Verifica JWT locale (signing key asimmetriche) + prefetch route probabili
Fase 7 — Round-trip delle mutazioni (syncShoppingAction condizionale, ecc.)
Fase 8 — Client RLS-enforced per BT-7 (il più invasivo, va fatto a DAL consolidato)
Fase 9 — Cleanup: schema {id,qty} hardcoded, fallback date rimossi, select espliciti, service worker
```

## Backlog Tecnico Residuo

### BT-7: RLS scritta e attiva ma bypassata al 100% da `service_role`

Il confine fra i tenant oggi è solo la presenza manuale di `.eq("organization_id", ...)` nel codice applicativo — nessuna verifica DB indipendente. Fix previsto in Fase 8: client RLS-enforced con JWT utente per le letture di dominio, `service_role` riservato a provisioning/cron/platform admin.

### BT-8: `resolveOrganizationId()` fallisce aperto

Se il parametro manca, `lib/organizationContext.ts` opera sull'organizzazione più vecchia dell'intero DB invece di lanciare. Nessun call site attuale lo sfrutta, ma è un default pericoloso. Fix: deve lanciare, non indovinare.

### BT-9: `applyBookingConsumptions()` codice morto su path pericoloso

`lib/stock.ts` chiama `applyBookingConsumptionDelta()` senza `organizationId`, imboccando il default pericoloso di BT-8. Nessun chiamante nel codebase. Da rimuovere.

### BT-10: RPC `apply_product_quantity_deltas_atomic` senza scoping tenant

Percorso principale di scrittura magazzino, `security definer`, nessun `organization_id` nella firma — sicura solo perché i chiamanti filtrano prima (corretta per costruzione, non per verifica). Fix: aggiungere `p_organization_id` e filtrare dentro la RPC.

### BT-11: Filtri tenant/data mancanti minori

`/api/bookings` ha già `?from=` (usato dalla Dashboard). Restano aperti: due `.eq("organization_id")` mancanti in `lib/stock.ts` e `lib/product-quantity.ts` (non sfruttabili oggi, difesa in profondità); `/bookings` continua a caricare tutto lo storico per design.

## Miglioramenti Pianificati (Low Effort)

Non ancora implementati, fattibili in 1–4h ciascuno senza toccare schema DB o logica di business.

### UX

| # | Descrizione | File |
|---|---|---|
| U1 | Dashboard: KPI "Azioni Aperte" cliccabile → pagina azioni filtrata su `DA_FARE` | `app/page.tsx`, `app/actions/page.tsx` |
| U2 | Booking form: validazione `check_out > check_in` con messaggio inline | `app/bookings/page.tsx` |
| U3 | Elimina prenotazione: conferma con conteggio azioni collegate | `app/bookings/page.tsx`, `app/api/bookings/[id]/route.ts` |

### Funzionali

| # | Descrizione | File |
|---|---|---|
| F1 | Azioni: bottone "Oggi" accanto al range picker | `app/actions/page.tsx` |
| F2 | Inventario: export CSV stato attuale (xlsx già installato) | `app/inventory/page.tsx` |
| F3 | Finance: filtro per categoria sulle spese | `app/finance/page.tsx` |
| F4 | Finance: Δ% mese precedente su entrate/uscite | `app/finance/page.tsx` |

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
- spec di design già scritta: `docs/superpowers/specs/2026-06-30-anagrafica-ospiti-design.md`

Impatto: elimina la compilazione manuale sul portale, operazione oggi fatta a mano entro 24h da ogni check-in.

## What Is Not Done Yet

Mancanze consapevoli:

- invite collaborators
- switch workspace
- role-based permissions reali
- Stripe billing reale
- customer portal
- pagina marketing/public

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
- `lib/data/organizations.ts`, `lib/data/bookings.ts`, `lib/data/finance.ts` — DAL (select con join + proiezione tenant-safe)
- `lib/timing/serverTiming.ts`, `lib/timing/requestTiming.ts`, `lib/perf/navMarks.ts` — strumentazione performance + correlazione navigazione
- `docs/perf/measuring.md`, `scripts/perf-measure.mjs` — protocollo di misurazione manuale + automatizzato
- `tests/e2e/helpers/`, `tests/e2e/setup/auth.setup.ts` — fondamenta E2E

## Prossimi passi

1. Fase 3 performance — Server Components con dati iniziali, poi Fase 4 (cache client) — vedi "Piano di fasi — Performance"
2. BT-7/8/9/10 — sicurezza tenant residua (vedi "Backlog Tecnico Residuo")
3. U1–U3 / F1–F4 — miglioramenti UX e funzionali low effort
4. Dopo ogni modifica: `npx tsc --noEmit` + `npx eslint .` + `npm run verify` devono passare tutti
