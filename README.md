# Alva Host Manager

Gestionale operativo per una proprieta in affitto breve. L'app tiene insieme prenotazioni, azioni operative, inventario, biancheria e finanze con una UI pensata per uso quotidiano.

Questa README e pensata come file di ripartenza: descrive lo stato reale del progetto dopo gli ultimi fix applicati a codice e database.

## Stato attuale

- `npm test` passa
- `npm run lint` passa
- `npx tsc --noEmit` passa
- le migration Supabase presenti nel repo sono state applicate anche al database remoto
- l'autenticazione e attiva tramite `proxy.ts`
- le prenotazioni con pulizia gia completata vengono nascoste di default nella pagina bookings
- gli aggiornamenti stock concorrenti usano un percorso atomico via RPC SQL, con fallback compatibile lato codice

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

## Setup

### Prerequisiti

- Node.js 18+
- progetto Supabase attivo

### Installazione

```bash
npm install
```

### Variabili d'ambiente

Crea `.env.local` nella root:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
APP_PASSWORD=
AUTH_SECRET=
```

Note:

- `SUPABASE_SERVICE_ROLE_KEY` e server-side only e non deve mai finire nel browser
- `SUPABASE_DB_PASSWORD` serve al CLI Supabase per `migration list` e `db push`
- `AUTH_SECRET` e consigliata; se manca, il sistema usa `APP_PASSWORD` come fallback per firmare e verificare il cookie
- per separare gli ambienti senza rischi, il repo usa anche:
  - `.env.local.production-current` come snapshot dell'ambiente remoto attuale
  - `.env.local.supabase-local` come file dedicato al futuro ambiente locale
  - Next.js non carica automaticamente questi due file: quando vuoi cambiare ambiente, copi i valori scelti dentro `.env.local`

### Supabase locale

Per sviluppare senza toccare il progetto remoto in produzione:

1. installa e avvia Docker Desktop
2. inizializza il progetto Supabase locale:

```bash
npx supabase init
```

3. avvia lo stack locale:

```bash
npx supabase start
```

4. applica tutte le migration del repo al database locale:

```bash
npx supabase db reset
```

5. recupera URL e chiavi locali:

```bash
npx supabase status
```

6. copia i valori dentro `.env.local`, partendo dal template `.env.local.supabase-local`

Nota:

- in questo momento il repo e gia pronto lato CLI (`supabase/config.toml` esiste)
- finche Docker non e disponibile sulla macchina, `supabase start` non puo partire

### Avvio

```bash
npm run dev
```

### Verifica locale

```bash
npx tsc --noEmit
npm run lint
npm test
```

## Architettura rapida

### Flusso applicativo

```text
UI client
  -> /api/*
  -> lib/*
  -> Supabase
```

### Cartelle principali

```text
app/
  api/                 route handlers
  actions/             pagina azioni + server actions auth
  bookings/            pagina prenotazioni
  finance/             pagina finanze
  inventory/           pagina inventario
  warehouse/           pagina magazzino / biancheria
lib/
  booking-automation.ts
  action-effects.ts
  stock.ts
  products-schema.ts
types/
  db.ts
supabase/
  migrations/
tests/
```

## Funzionamento importante

### Autenticazione

- login via server action in [app/actions/auth.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/actions/auth.ts:1)
- cookie httpOnly firmato
- verifica accesso in [proxy.ts](/abs/path/c:/Users/Enrico/airbnb-manager/proxy.ts:1)
- rate limit login supportato da tabella DB `auth_rate_limits`, con fallback in-memory se la tabella non e disponibile

Nota:

- `proxy.ts` e corretto per questa versione del progetto e va lasciato cosi
- non rinominarlo in `middleware.ts`

### Prenotazioni e azioni automatiche

- le prenotazioni sono gestite in [app/api/bookings/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/route.ts:1) e [app/api/bookings/[id]/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/[id]/route.ts:1)
- la generazione/sync delle azioni automatiche vive in [lib/booking-automation.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/booking-automation.ts:1)
- la pagina bookings nasconde di default le prenotazioni la cui azione `PULIZIA` collegata e gia `FATTO`
- nella UI esiste un toggle `Mostra completate`
- le sync eventuali di dominio sono rese esplicite e passano da retry/logging coerente
- esiste un endpoint manuale di re-sync: [app/api/bookings/resync/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/resync/route.ts:1)

### Completamento azioni

- il cambio stato azioni passa da [app/api/actions/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/actions/route.ts:1)
- gli effetti collaterali stanno in [lib/action-effects.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/action-effects.ts:1)
- ora `applyActionStatusEffects()` non e piu fire-and-forget: se fallisce, la route fallisce
- gli errori API sono stati uniformati con shape minima `{ error: string }`

### Date e fetch client

- la semantica data e centralizzata in [lib/localDate.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/localDate.ts:1)
- `YYYY-MM-DD` viene trattato come giorno locale Italia, non come giorno UTC
- il fetch client condiviso vive in [lib/http/clientFetch.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/http/clientFetch.ts:1)
- dashboard, calendario, bookings, actions, finance, inventory e warehouse usano handling coerente per errori rete, JSON invalido e abort/race

### Booking delete atomico

La cancellazione di una prenotazione con eventuale ripristino biancheria e stata resa atomica via funzione SQL:

- migration: [supabase/migrations/20260427193000_add_delete_booking_atomic_function.sql](/abs/path/c:/Users/Enrico/airbnb-manager/supabase/migrations/20260427193000_add_delete_booking_atomic_function.sql:1)
- uso nella route: [app/api/bookings/[id]/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/[id]/route.ts:1)

Inoltre il parsing dei dettagli biancheria e ora runtime-safe: se i dati sono invalidi, il delete viene bloccato invece di saltare silenziosamente il ripristino.

## Database e migration

Le migration adesso sono tracciate nel repo in `supabase/migrations`.

Migration presenti:

- `20260306135500_add_total_amount_to_bookings.sql`
- `20260306152000_seed_warehouse_products_and_spesa_fields.sql`
- `20260406120000_ensure_expenses_schema.sql`
- `20260408120000_add_stock_status_to_products.sql`
- `20260408173000_split_bed_sets_into_summer_and_winter.sql`
- `20260427193000_add_delete_booking_atomic_function.sql`
- `20260427200000_add_auth_rate_limits.sql`
- `20260427213000_fix_delete_booking_atomic_linen_alias_resolution.sql`
- `20260507123000_add_apply_product_quantity_deltas_atomic.sql`

Le ultime migration importanti per lo stato corrente del codice sono:

- `add_delete_booking_atomic_function`
- `add_auth_rate_limits`
- `fix_delete_booking_atomic_linen_alias_resolution`
- `add_apply_product_quantity_deltas_atomic`

### Comandi Supabase utili

CLI installata come dev dependency:

```bash
npx supabase migration list
npx supabase db push
```

## Scelte e workaround ancora presenti

### Schema products retrocompatibile

In [lib/products-schema.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/products-schema.ts:1) il codice continua a supportare varianti di schema tipo:

- `id` oppure `sku`
- `quantity` oppure `qty`

Ora `getProductId()` non fallisce piu in silenzio: se non riesce a risolvere un id prodotto, lancia errore esplicito.

### Payload variants

In piu punti del codice sono ancora presenti fallback per schemi DB non perfettamente allineati. Non vanno rimossi alla cieca finche non decidiamo di stabilizzare definitivamente lo schema.

### Fire-and-forget ancora presenti

Le sync secondarie come `scheduleBookingDomainResync()` restano eventuali in alcuni flussi bookings. E una scelta consapevole per non rallentare la UI, ma ora e esplicita, tracciata e recuperabile con endpoint di re-sync manuale.

## Cosa e stato sistemato di recente

- fix auth quando `AUTH_SECRET` manca
- bookings: nascoste di default quelle con pulizia gia fatta
- README riallineata al progetto reale
- delete booking atomico con restore biancheria sicuro
- parsing dettagli biancheria reso robusto
- `applyActionStatusEffects()` non piu scollegato dalla risposta HTTP
- delete finance piu sicuro: niente fallback che cancelli spese automatiche per errore
- rate limiting login supportato da tabella DB
- confronto password timing-safe
- migration Supabase applicate anche al database remoto
- utility data Italia centralizzata e testata
- client fetch condiviso con abort/race handling
- error shape API uniformato
- stock atomico introdotto con RPC SQL e verifica integration
- test auth/date/stock aggiunti

## Cose ancora aperte davvero

Le aree che restano sensate per un prossimo giro sono:

1. hardening CSRF sulle route `POST`, `PATCH`, `DELETE`
2. ulteriore rimozione dei fallback retrocompat nel DB solo dopo decisione esplicita di stabilizzare definitivamente lo schema
3. eventuali nuove funzionalita operative senza riaprire la logica di dominio gia stabilizzata

## Priorita pratica per la prossima sessione

Se si riparte da qui, l'ordine consigliato e:

1. nuove funzionalita operative, se servono al flusso quotidiano
2. pulizia finale dei fallback DB solo con schema concordato
3. affinamenti di sicurezza come CSRF in un secondo momento

## File chiave da aprire subito

- [app/bookings/page.tsx](/abs/path/c:/Users/Enrico/airbnb-manager/app/bookings/page.tsx:1)
- [app/api/bookings/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/route.ts:1)
- [app/api/bookings/[id]/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/bookings/[id]/route.ts:1)
- [app/api/actions/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/actions/route.ts:1)
- [lib/booking-automation.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/booking-automation.ts:1)
- [lib/action-effects.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/action-effects.ts:1)
- [lib/stock.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/stock.ts:1)
- [lib/products-schema.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/products-schema.ts:1)

## Nota finale

Questo progetto oggi e in uno stato sensibilmente piu solido di prima: auth enforcement verificato, contratti API piu coerenti, date stabili lato Italia, sync di dominio piu esplicite e stock concorrente coperto con percorso atomico su database. La prossima volta possiamo usare questa README come base e andare subito sul prossimo lavoro, senza dover ricostruire da zero cosa e gia stato sistemato.
