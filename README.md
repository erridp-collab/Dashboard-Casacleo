# Airbnb Manager

Gestionale operativo per una proprietà in affitto breve. Permette di tracciare prenotazioni, azioni di pulizia/manutenzione, inventario prodotti, lavatrice/biancheria e finanze — tutto da un'unica interfaccia ottimizzata per uso quotidiano su mobile.

---

## Stack tecnologico

| Layer | Tecnologia | Versione |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | ^4 |
| Database / BaaS | Supabase (PostgreSQL + PostgREST) | @supabase/supabase-js ^2.98.0 |
| Calendario | FullCalendar (daygrid + interaction + react) | ^6.1.19 |
| Grafici | Recharts | ^2.15.4 |
| Toast/notifiche | Sonner | ^2.0.7 |
| Export Excel | xlsx (SheetJS) | ^0.18.5 |
| Icone | Lucide React | ^0.577.0 |
| Linguaggio | TypeScript | ^5 |
| Test | Vitest | ^4.0.18 |

---

## Installazione e avvio

### Prerequisiti

- Node.js >= 18
- Un progetto Supabase attivo con le tabelle descritte nella sezione [Schema database](#schema-database)

### Setup

```bash
git clone <repo-url>
cd airbnb-manager
npm install
```

Crea il file `.env.local` nella root (non committarlo mai):

```bash
cp .env.example .env.local
# poi modifica .env.local con i valori reali
```

### Avvio sviluppo

```bash
npm run dev
# http://localhost:3000
```

### Build produzione

```bash
npm run build
npm start
```

### Test

```bash
npm test          # singola esecuzione
npm run test:watch  # watch mode
```

---

## Variabili d'ambiente

Crea `.env.local` con queste variabili (non includere valori reali nel repo):

```env
# URL del progetto Supabase (es. https://xxxx.supabase.co)
SUPABASE_URL=

# Service Role Key di Supabase — accesso admin completo, NON esporre mai al browser
SUPABASE_SERVICE_ROLE_KEY=

# Password per il login all'applicazione (singolo utente condiviso)
APP_PASSWORD=
```

> **Sicurezza**: `SUPABASE_SERVICE_ROLE_KEY` bypassa le RLS policies di Supabase. Usata solo server-side tramite `lib/supabaseAdmin.ts` che importa `server-only`. Non aggiungerla mai a variabili pubbliche (`NEXT_PUBLIC_*`).

---

## Architettura

### Struttura delle cartelle

```
airbnb-manager/
├── app/
│   ├── api/                    # Route handlers Next.js (server-side API)
│   │   ├── actions/            # CRUD azioni + checklist
│   │   │   ├── route.ts        # GET list, POST crea, PATCH aggiorna
│   │   │   ├── checklist/      # PATCH aggiorna stato checklist globale
│   │   │   └── [id]/checklist/ # GET checklist di una singola azione
│   │   ├── bookings/           # CRUD prenotazioni
│   │   │   ├── route.ts        # GET list, POST crea
│   │   │   └── [id]/route.ts   # GET, PATCH, DELETE singola prenotazione
│   │   ├── finance/            # Report finanziari e spese
│   │   │   └── route.ts        # GET report, POST/DELETE spese manuali
│   │   └── products/           # Gestione inventario
│   │       ├── route.ts        # GET list, PATCH aggiorna prodotto
│   │       ├── bulk/           # PUT aggiornamento massivo quantità
│   │       ├── restock/        # POST rifornimento prodotti
│   │       └── stock-status/   # PATCH aggiorna stato stock manuale
│   │
│   ├── actions/                # Pagina azioni (server component wrapper)
│   │   └── auth.ts             # Server actions: login/logout
│   ├── bookings/page.tsx       # Pagina prenotazioni (client)
│   ├── finance/page.tsx        # Dashboard finanze (client)
│   ├── inventory/page.tsx      # Inventario prodotti (client)
│   ├── warehouse/page.tsx      # Magazzino/biancheria (client)
│   ├── calendar/               # Vista calendario prenotazioni
│   ├── login/page.tsx          # Pagina login
│   ├── settings/page.tsx       # Impostazioni
│   ├── layout.tsx              # Layout radice (sidebar + top bar)
│   ├── page.tsx                # Dashboard home
│   ├── error.tsx               # Error boundary globale
│   └── globals.css             # Stili globali Tailwind
│
├── components/                 # Componenti UI riutilizzabili
│   ├── action-badges.tsx       # Badge colorati per tipo/stato azione
│   ├── action-checklist-modal.tsx # Modal checklist azione
│   ├── bottom-nav.tsx          # Navigazione bottom bar mobile
│   ├── card.tsx                # Card generica
│   ├── cleaning-modal.tsx      # Modal completamento pulizia
│   ├── kpi-card.tsx            # Card KPI per dashboard
│   ├── page-container.tsx      # Wrapper layout pagina
│   ├── sidebar.tsx             # Sidebar desktop
│   ├── skeleton.tsx            # Loading skeleton
│   ├── table.tsx               # Tabella generica
│   ├── toast.tsx               # Sistema toast notifiche
│   └── top-bar.tsx             # Barra superiore mobile
│
├── lib/                        # Business logic pura (server-only)
│   ├── supabaseAdmin.ts        # Factory client Supabase con service role
│   ├── booking-automation.ts   # Calcolo e sync azioni automatiche da prenotazioni
│   ├── action-effects.ts       # Effetti collaterali completamento azioni (spese, stock)
│   ├── stock.ts                # Gestione lista spesa e consumi biancheria
│   ├── products-schema.ts      # Risoluzione schema tabella products (retrocompatibilità)
│   ├── refill.ts               # Logica rifornimento prodotti
│   ├── checklist-templates.ts  # Template checklist per tipo azione
│   ├── actionMeta.ts           # Metadati azioni (label, colori, icone)
│   └── format.ts               # Utility formattazione date/numeri/valuta
│
├── types/
│   └── db.ts                   # Tipi TypeScript per le tabelle Supabase
│
├── tests/
│   ├── booking-automation.test.ts  # Unit test logica automazioni
│   ├── stock.test.ts               # Unit test gestione stock
│   └── stubs/server-only.ts        # Stub per import server-only nei test
│
├── proxy.ts                    # Middleware Next.js per autenticazione
├── next.config.ts              # Configurazione Next.js (proxy come middleware)
├── vitest.config.ts            # Configurazione test
└── .env.local                  # Variabili d'ambiente (NON committare)
```

### Schema database (tabelle Supabase)

Le tabelle sono gestite direttamente in Supabase (no migration files nel repo):

| Tabella | Scopo |
|---|---|
| `bookings` | Prenotazioni (check_in, check_out, guests, platform, revenue) |
| `actions` | Azioni operative (pulizie, manutenzioni, spese, biancheria) |
| `action_checklist` | Checklist per singola azione |
| `expenses` | Spese (manuale + automatiche da azioni) |
| `products` | Inventario prodotti (quantità, threshold, stock_status) |

> La tabella `products` può avere schema variabile: colonna id o sku, quantity o qty. La libreria `products-schema.ts` risolve automaticamente quale schema è presente (vedi [Scelte architetturali](#scelte-architetturali)).

---

## Flusso principale dell'applicazione

```
Browser (Client Component)
        │
        │  fetch() verso /api/*
        ▼
Route Handler (app/api/*/route.ts)
        │
        │  chiama funzioni in lib/
        ▼
Business Logic (lib/*.ts)
        │
        │  supabaseAdmin() → query PostgreSQL
        ▼
Supabase (Database)
```

### Flusso prenotazione → azioni automatiche

1. Utente crea/modifica/elimina una prenotazione via `POST /api/bookings`
2. Il route handler chiama `syncBookingAutomations()` in fire-and-forget (non blocca la risposta)
3. `syncBookingAutomations()` calcola le azioni desiderate per tutte le prenotazioni (pulizie, biancheria, manutenzioni periodiche)
4. Confronta con le azioni esistenti nel DB → crea le mancanti, elimina le obsolete
5. Per ogni nuova azione, crea automaticamente la checklist dal template corrispondente

### Flusso completamento azione → effetti collaterali

1. Utente segna un'azione come FATTO (con dettagli opzionali: importo, biancheria usata, etc.)
2. `PATCH /api/actions` chiama `applyActionStatusEffects()`
3. In base al tipo di azione vengono applicati effetti:
   - **PULIZIA esterna**: crea una spesa automatica nella tabella `expenses`
   - **BIANCHERIA**: decrementa le quantità dei prodotti tessili nell'inventario
   - **LAVATRICI**: incrementa le quantità dei tessili (lavati e rientrati)
   - **SPESA**: incrementa le quantità dei prodotti comprati, aggiorna la lista spesa
4. Dopo ogni modifica inventario, `syncShoppingAction()` ricalcola se esiste una lista spesa pendente

---

## Scelte architetturali

### Autenticazione custom con cookie httpOnly

**Scelta**: singolo utente con password statica in env var, cookie httpOnly con valore fisso `"authenticated"`.

**Perché**: app personale mono-utente, nessun bisogno di gestione account multipli. Setup minimale senza dipendenze aggiuntive.

**Limite critico**: il cookie contiene solo la stringa `"authenticated"` senza firma/JWT. Il middleware non valida il contenuto, solo la presenza. Chiunque riesca a iniettare quel cookie bypassa l'auth.

### Retrocompatibilità schema products via probe queries

**Scelta**: `lib/products-schema.ts` rileva a runtime se la tabella usa `id` o `sku`, `quantity` o `qty`.

**Perché**: il database è stato migrato in corso d'opera e alcune query devono funzionare con entrambi gli schemi. Piuttosto che duplicare le query, viene risolto lo schema una volta e cached per 30s.

**Effetto collaterale**: introduce latenza alla prima chiamata per ogni processo Node (cache in-memory del processo, si azzera a ogni cold start).

### Payload variants (try multiple insert shapes)

**Scelta**: molte funzioni in `lib/` tentano più varianti di payload (con campi opzionali in ordine decrescente) fino a trovare quella accettata dal DB.

**Perché**: alcune colonne (`source_action_id`, `origin`, `created_at`) potrebbero non esistere in tutte le versioni del DB. Piuttosto che bloccare, si degrada gracefully.

**Rischio**: se il DB cambia schema in modo incompatibile, gli errori silenti possono produrre dati parziali senza alert visibili.

### Fire-and-forget per automazioni

**Scelta**: `syncBookingAutomations()` e `syncShoppingAction()` sono chiamate fire-and-forget nei route handler (`void fn()`).

**Perché**: non bloccare la risposta all'utente per operazioni secondarie che possono richiedere 100-500ms.

**Rischio**: errori nelle sync non raggiungono mai l'utente. Se la sync fallisce, lo stato del DB può diventare incoerente silenziosamente.

### No Redux/Zustand — stato locale React

**Scelta**: ogni pagina gestisce il proprio stato con `useState` e `useEffect`, senza store globale.

**Perché**: app mono-pagina con sezioni ben separate. Non ci sono dati condivisi tra pagine che richiedano stato globale.

### Supabase Service Role Key (no RLS)

**Scelta**: tutte le query usano il client admin con service role key, bypassando le Row Level Security policies.

**Perché**: app server-side pura, accesso totale al DB richiesto per le automazioni. Non ci sono utenti multipli con permessi diversi.

**Rischio**: se un attaccante riesce a eseguire codice server-side, ha accesso illimitato al DB.

---

## Dipendenze esterne e motivazioni

| Dipendenza | Motivazione |
|---|---|
| `@supabase/supabase-js` | Client ufficiale per Supabase, gestisce query, auth, realtime |
| `@fullcalendar/*` | Vista calendario prenotazioni con drag-drop, unica libreria matura per React |
| `recharts` | Grafici finanziari (aree, barre), buon compromesso dimensioni/API |
| `sonner` | Toast notifications leggere, API semplice, ottimo per mobile |
| `xlsx` | Export dati in Excel — richiesta operativa specifica |
| `lucide-react` | Icone SVG coerenti, tree-shakeable, ben mantenute |
| `tailwindcss` v4 | Utility-first CSS, zero configurazione temi, ottimo per rapid UI |

---

## Decision log

### Problemi incontrati durante lo sviluppo

**P1 — Schema tabella products non fisso**
La tabella `products` è stata creata inizialmente con `id`/`quantity`, poi migrata a `sku`/`qty`. Le query existenti in produzione fallivano con errore `42703 column does not exist`. Soluzione: `products-schema.ts` risolve lo schema a runtime con probe queries e cache 30s.

**P2 — Colonne opzionali in `actions` e `expenses`**
Colonne come `source_action_id`, `origin`, `created_at` sono state aggiunte al DB in momenti diversi. Le INSERT fallivano su schemi vecchi. Soluzione: pattern "payload variants" — si tentano insert in ordine dal più completo al minimo, ci si ferma al primo successo.

**P3 — Checklist con colonne nome variabile**
La tabella `action_checklist` può avere la colonna del testo chiamata `label`, `item_text`, o `item`. Soluzione: `ensureChecklist()` in `booking-automation.ts` tenta 6 varianti di insert.

**P4 — `created_at` mancante in `actions`**
La query per trovare la SPESA pendente ordinava per `created_at`. Su DB senza quella colonna falliva. Soluzione: fallback esplicito se l'errore è `42703` con messaggio contenente `created_at`.

**P5 — Sincronizzazione lista spesa**
Ogni modifica all'inventario deve ricalcolare se la lista spesa automatica (azione SPESA) deve esistere o meno. Invece di gestire questo nei singoli punti di modifica, ogni funzione che tocca prodotti chiama `syncShoppingAction()` al termine — approccio "eventual consistency" manuale.

### Alternative valutate e scartate

| Alternativa | Perché scartata |
|---|---|
| Supabase Auth (email/password) | Sovra-ingegnerizzato per app mono-utente personale |
| Prisma ORM | Aggiunge complessità di migrazione non necessaria; Supabase SDK è sufficiente |
| Zustand per stato globale | Non necessario: le pagine sono isolate, nessun dato condiviso |
| Supabase Realtime (WebSocket) | Non richiesto — aggiornamenti on-demand sufficienti |
| Edge Runtime per middleware | Non necessario, latency non è un problema per uso personale |
| Database migrations (Supabase CLI) | Non implementato — schema gestito manualmente. Da aggiungere. |

### Workaround non ovvi

**W1 — `server-only` nei test**: il modulo `server-only` di Next.js lancia un errore se importato fuori dal server. I test Vitest girano in Node, non nel contesto Next. Soluzione: `tests/stubs/server-only.ts` è uno stub vuoto, e `vitest.config.ts` lo aliasa.

**W2 — `proxy.ts` come middleware**: Next.js richiede che il middleware sia esportato da `middleware.ts` nella root. Qui il file si chiama `proxy.ts` ed è referenziato in `next.config.ts` come custom middleware tramite la config `matcher`. Questo è un pattern non standard — se si rinomina il file o si aggiorna Next.js verificare che il wiring regga.

**W3 — Route duplicate italiano/inglese**: esistono `/warehouse` e `/magazzino`, `/settings` e `/impostazioni`, `/finance` e `/spese`. Solo una di ciascuna coppia è attiva nell'app; l'altra è dead code rimasto da refactoring incompleto.

---

## Note per il prossimo developer

### Parti fragili

**F1 — Auth middleware senza validazione firma** ([proxy.ts:11](proxy.ts#L11))
Il cookie `auth-token` contiene la stringa letterale `"authenticated"`. Il middleware controlla solo che esista, non che sia valido. Un cookie forgiato bypassa completamente l'auth. Se l'app diventa accessibile a più utenti o esternamente, sostituire con Supabase Auth o JWT firmato.

**F2 — Cache schema in-memory di processo** ([lib/products-schema.ts:9](lib/products-schema.ts#L9))
`_cachedSchema` è una variabile module-level. In ambiente serverless (Vercel), ogni Lambda ha la propria istanza → nessun problema. In ambienti con processi persistenti (PM2, Docker) la cache è condivisa tra request dello stesso worker → possibile race condition se lo schema cambia. Usare una cache request-scoped o Redis se necessario.

**F3 — Errori fire-and-forget invisibili** ([app/api/bookings/route.ts](app/api/bookings/route.ts))
`void syncBookingAutomations()` — se questa funzione lancia un'eccezione, sparisce silenziosamente. Aggiungere almeno `.catch(console.error)` o un sistema di logging.

**F4 — Payload variants** ([lib/stock.ts:104](lib/stock.ts#L104), [lib/action-effects.ts:60](lib/action-effects.ts#L60))
Il pattern di tentare più payload è un workaround per schemi DB non fissi. Una volta stabilizzato lo schema definitivo, questi vanno semplificati a un singolo payload. Mantenerli è un debito tecnico.

**F5 — Regole consumo biancheria hardcoded** ([lib/stock.ts:47](lib/stock.ts#L47))
`setCount = Math.ceil(parsedGuests / 2)` — la regola "1 set ogni 2 ospiti" è hardcoded. Se cambia la logica di gestione della biancheria va modificato qui.

**F6 — Nomi prodotti come chiave di matching** ([lib/stock.ts:48](lib/stock.ts#L48), [lib/action-effects.ts:354](lib/action-effects.ts#L354))
Le quantità di biancheria sono mappate ai prodotti per nome normalizzato (lowercase, trim). Se un prodotto viene rinominato nel DB, smette di essere aggiornato silenziosamente. Non c'è ID stabile che colleghi le regole ai prodotti.

### Cosa NON fare

**NON** aggiungere `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — la service role key esposta al browser dà accesso admin completo al database da chiunque.

**NON** usare `supabaseAdmin()` in Client Components — il file importa `server-only` che lo impedisce a livello di build, ma architetturalmente è corretto: il service role non deve mai uscire dal server.

**NON** rimuovere il pattern "payload variants" senza prima verificare che il DB abbia lo schema unificato su tutti gli ambienti (dev, staging, prod se presente).

**NON** modificare i nomi dei prodotti in Supabase senza aggiornare anche i mapping in `lib/stock.ts` e `lib/action-effects.ts` — il matching è basato su nome stringa, non su ID.

**NON** assumere che `syncBookingAutomations()` sia sincrona rispetto alla risposta HTTP — è fire-and-forget. Leggere il DB qualche secondo dopo una modifica prenotazione per vedere le azioni aggiornate.

**NON** committare `.env.local` — è già in `.gitignore` ma verificare sempre prima di un push con `git status`.

### Aree da migliorare (priorità suggerita)

1. **Autenticazione** — sostituire il cookie fisso con Supabase Auth o JWT firmato
2. **Error tracking** — aggiungere Sentry o equivalente; gli errori fire-and-forget sono invisibili
3. **Rate limiting** — il login non ha protezione brute force
4. **Database migrations** — usare Supabase CLI migrations per tracciare lo schema
5. **Stabilizzare schema products** — una volta scelto id/quantity o sku/qty, rimuovere tutto il codice di probing
6. **Test coverage** — aggiungere test per i route handler API e per `action-effects.ts`
7. **Rimuovere route duplicate** — scegliere tra inglese e italiano per i path e cancellare le pagine morte
8. **Paginazione** — `GET /api/bookings` ritorna tutte le prenotazioni senza limite
