# Dashboard Casacleo

Gestionale operativo per affitti brevi (Casa Cleo). Tiene insieme prenotazioni, azioni operative, inventario, biancheria e finanze con una UI pensata per uso quotidiano da mobile e desktop.

---

## Stato attuale (2026-06-04)

- `npx tsc --noEmit` — verde
- `npm run lint` — verde
- `npm test` — verde
- database hosted migrato a multi-tenancy (cutover 2026-05-25, 19 migration applicate)
- UI polish completo: tema burgundy, Recharts brand colors, calendar amber, dashboard KPI-first
- miglioramenti mobile UX: card prenotazioni compatte, FAB, tab inventario, import collassato
- tutto live su `dashboard-casacleo.vercel.app`

---

## Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Database | Supabase PostgreSQL (hosted) |
| Test | Vitest |
| Charts | Recharts |
| Calendar | FullCalendar |

---

## Setup

### Prerequisiti

- Node.js 18+

### Installazione

```bash
npm install
```

### Variabili d'ambiente

`.env.local` deve puntare al progetto Supabase hosted:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ymthmncbuomtshulexkh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key hosted>
SUPABASE_SERVICE_ROLE_KEY=<service role hosted>
```

---

## Avvio app

```bash
npm run dev
```

---

## Verifica locale

```powershell
npx.cmd tsc --noEmit
npm run lint
npm test
```

Nota: i test integration girano contro il DB hosted. Non toccare dati dell'org produzione (`6328a160-4546-46ef-a372-a087e5785d43`).

---

## Architettura

### Flusso

```text
Browser UI
  -> /api/*   (route handlers Next.js)
  -> lib/*    (logica di dominio)
  -> Supabase PostgreSQL (hosted)
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
  integration/      test su DB hosted reale
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
- onboarding obbligatorio al primo accesso, stato in `organizations.settings`

---

## Backlog tecnico

| # | Voce | Stato |
|---|---|---|
| BT-1 | FK mancante `expenses.source_action_id` | ✅ chiuso |
| BT-2 | `PATCH /api/products` non atomico | ✅ chiuso |
| BT-3 | Rimozione fallback schema legacy | ✅ chiuso |
| BT-4 | Cleanup 6 varianti checklist insert | ✅ chiuso |
| BT-5 | Test tenant isolation | ✅ chiuso |
| BT-6 | Hardening email beta-safe | **aperto** — prima di beta esterna |

Per dettagli: `PROJECT_RECAP.md`.

---

## File chiave

- `PROJECT_RECAP.md` — contesto completo, postura sicurezza, backlog
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
