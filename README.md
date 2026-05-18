# Alva Host Manager

Gestionale operativo per una proprietà in affitto breve. Tiene insieme prenotazioni, azioni operative, inventario, biancheria e finanze con una UI pensata per uso quotidiano.

Questo file è il punto di ripartenza: descrive lo stato reale dopo l'ultima sessione di lavoro.

---

## Stato attuale (2026-05-18)

- `npm test` passa (49 test unit ✅ — i test integration richiedono Docker attivo, vedi sezione)
- `npx tsc --noEmit` passa
- `npm run lint` passa
- tutte 17 le migration sono applicate al DB locale Docker
- il DB hosted è ancora pre-multi-tenancy (vedi sezione "Hosted vs Locale")
- BT-5 completato: test di tenant isolation scritti in `tests/integration/tenant-isolation.integration.test.ts`

---

## Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Database | Supabase PostgreSQL |
| Test | Vitest |
| Charts | Recharts |
| Calendar | FullCalendar |

---

## Setup

### Prerequisiti

- Node.js 18+
- Docker Desktop attivo

### Installazione

```bash
npm install
```

### Variabili d'ambiente

`.env.local` attualmente punta al Supabase locale Docker:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

Per puntare al progetto hosted, sostituire con i valori da `.env.local.production-current`.

---

## Avvio Supabase locale (Docker)

### Problema noto su Windows

Su Windows, `npx.cmd supabase start` fallisce perché `supabase_storage` e `supabase_studio` non raggiungono lo stato healthy. Il CLI esegue stop automatico. I container core (DB, Auth, Kong, REST) partono però correttamente — basta salvarli prima che il CLI li fermi.

### Procedura corretta su Windows

```powershell
# 1. Avviare lo stack (fallirà su storage/studio — è normale)
npx.cmd supabase start

# 2. Immediatamente dopo, riavviare i container core
docker start supabase_db_airbnb-manager supabase_auth_airbnb-manager supabase_rest_airbnb-manager supabase_kong_airbnb-manager supabase_inbucket_airbnb-manager
```

### Verifica che Kong/REST sia attivo

```powershell
Invoke-WebRequest `
  -Uri "http://127.0.0.1:54321/rest/v1/organizations?select=id&limit=1" `
  -Headers @{ apikey = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"; Authorization = "Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" }
```

Risposta 200 = tutto ok, si può eseguire `npm test`.

### Nota comandi Supabase CLI su Windows

`npx.ps1` è bloccato da PowerShell — usare sempre `npx.cmd supabase ...` invece di `npx supabase ...`.

### Verifica migration applicate

Il DB locale ha tutte 17 le migration. Per verificare:

```bash
docker exec supabase_db_airbnb-manager psql -U postgres -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
```

Se mancano migration, applicarle con:

```bash
npx.cmd supabase db push --local
```

Nota: `db push --local` usa la porta 54322 diretta. Se va in timeout (problema noto), applicare le migration via `docker exec` direttamente.

---

## Avvio app

```bash
npm run dev
```

---

## Verifica locale

```bash
npx tsc --noEmit
npm run lint
npm test
```

---

## Architettura

### Flusso

```text
Browser UI
  -> /api/*   (route handlers Next.js)
  -> lib/*    (logica di dominio)
  -> Supabase PostgreSQL
```

### Cartelle principali

```text
app/
  api/              route handlers
  actions/          server actions auth
  onboarding/       setup iniziale workspace
  platform/         console admin piattaforma
  bookings/
  finance/
  inventory/
components/         UI condivisa
lib/                logica di dominio
supabase/
  migrations/       storia schema DB
tests/
  integration/      test su DB Docker reale
```

---

## Autenticazione e accesso

- login email/password via Supabase Auth, cookie httpOnly server-side
- verifica sessione e refresh in `proxy.ts` (non rinominarlo `middleware.ts`)
- nuovi utenti: flusso richiesta accesso → approvazione admin → reset password → onboarding
- platform admin separato: flag `app_metadata.is_platform_admin = true`
- area `/platform` per gestire richieste accesso e account utenti
- rate limiting login via RPC atomica `upsert_rate_limit` + tabella `auth_rate_limits`
- form pubblici protetti con honeypot + timing check

---

## Multi-tenancy

Il modello è SaaS-ready ma in uso owner-only:

- `organizations` + `user_roles` + `organization_id` su tutte le tabelle operative
- filtro `organization_id` applicativo su ogni query (service_role lato server, RLS secondaria)
- RLS presente sul DB ma non è l'unico guard — le API filtrano esplicitamente per org
- onboarding obbligatorio al primo accesso, stato in `organizations.settings`

---

## Hosted vs Locale

| | Hosted | Locale Docker |
|---|---|---|
| Auth | HMAC custom (legacy) | Supabase Auth |
| Multi-tenancy | NO | SI |
| Migration applicate | 10 (fino a 20260507123000) | 17 (tutte) |
| Platform admin UI | NO | SI |

Il codice è identico nei due ambienti. Il problema è solo il DB hosted ancora pre-multi-tenancy.

**Cutover hosted**: da eseguire dopo aver chiuso il backlog tecnico — vedi `PROJECT_RECAP.md`.

---

## Backlog tecnico aperto

In ordine di esecuzione:

| # | Voce | Stato |
|---|---|---|
| BT-5 | Test tenant isolation | ✅ completato |
| BT-1 | FK mancante `expenses.source_action_id` | aperto |
| BT-2 | `PATCH /api/products` non atomico | aperto |
| BT-4 | Cleanup 6 varianti checklist insert | aperto |
| Cutover | Allineare DB hosted al locale | dopo BT-1/2/4 |
| BT-3 | Rimozione fallback legacy | dopo cutover |
| BT-6 | Hardening email beta-safe | prima di aprire beta |

Per ogni voce: dettagli completi in `PROJECT_RECAP.md`.

Dopo ogni modifica verificare:

```bash
npm test && npx tsc --noEmit && npm run lint
```

---

## File chiave

- `PROJECT_RECAP.md` — contesto completo, piano cutover, postura sicurezza
- `proxy.ts` — guard sessione e routing protetto
- `lib/organizationContext.ts` — risoluzione contesto tenant
- `lib/platformAdmin.ts` — guard platform admin
- `app/actions/auth.ts` — login, request access, logout
- `app/platform/actions.ts` — approvazione richieste, gestione account
- `app/api/bookings/route.ts` — CRUD prenotazioni
- `app/api/actions/route.ts` — azioni operative
- `lib/booking-automation.ts` — generazione azioni automatiche
- `lib/action-effects.ts` — effetti collaterali azioni
- `lib/stock.ts` — gestione scorte
- `tests/integration/tenant-isolation.integration.test.ts` — test isolamento tenant
