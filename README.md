# Airbnb Manager

Gestionale operativo per una proprieta in affitto breve. L'app tiene insieme prenotazioni, azioni operative, inventario, biancheria e finanze con una UI pensata per uso quotidiano.

Questa README e pensata come file di ripartenza: descrive lo stato reale del progetto dopo gli ultimi fix applicati a codice e database.

## Stato attuale

- `npm test` passa
- `npm run build` passa
- le migration Supabase presenti nel repo sono state applicate anche al database remoto
- l'autenticazione e attiva tramite `proxy.ts`
- le prenotazioni con pulizia gia completata vengono nascoste di default nella pagina bookings

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
APP_PASSWORD=
AUTH_SECRET=
```

Note:

- `SUPABASE_SERVICE_ROLE_KEY` e server-side only e non deve mai finire nel browser
- `AUTH_SECRET` e consigliata; se manca, il sistema usa `APP_PASSWORD` come fallback per firmare e verificare il cookie

### Avvio

```bash
npm run dev
```

### Verifica locale

```bash
npm test
npm run build
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

### Completamento azioni

- il cambio stato azioni passa da [app/api/actions/route.ts](/abs/path/c:/Users/Enrico/airbnb-manager/app/api/actions/route.ts:1)
- gli effetti collaterali stanno in [lib/action-effects.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/action-effects.ts:1)
- ora `applyActionStatusEffects()` non e piu fire-and-forget: se fallisce, la route fallisce

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

Le ultime due sono importanti per lo stato corrente del codice:

- `add_delete_booking_atomic_function`
- `add_auth_rate_limits`

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

Le sync secondarie come `syncBookingAutomations()` o `syncShoppingAction()` sono ancora usate in alcuni punti come operazioni non bloccanti. E una scelta consapevole per non rallentare la UI, ma significa che parte della consistenza e eventuale, non immediatamente transazionale.

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

## Cose ancora aperte davvero

Queste sono le due aree che vale la pena tenere a mente per il prossimo giro:

1. [lib/action-effects.ts](/abs/path/c:/Users/Enrico/airbnb-manager/lib/action-effects.ts:1)
   Aggiornamenti stock ancora basati in alcuni casi su pattern `read -> compute -> write`, quindi con rischio di race condition se arrivano richieste concorrenti.

2. Hardening CSRF sulle route `POST`, `PATCH`, `DELETE`
   Non e prioritario per l'uso attuale interno e fidato, ma resta un tema aperto se l'app diventera piu esposta.

## Priorita pratica per la prossima sessione

Se si riparte da qui, l'ordine consigliato e:

1. nuove funzionalita operative, se servono al flusso quotidiano
2. solo se necessario, affrontare la concorrenza stock in `lib/action-effects.ts`
3. lasciare CSRF e altri affinamenti di sicurezza a un secondo momento

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

Questo progetto oggi e in uno stato sensibilmente piu solido di prima, senza essere stato appesantito da hardening non utile al contesto reale. La prossima volta possiamo usare questa README come base e andare subito sul prossimo lavoro, senza dover ricostruire da zero cosa e gia stato sistemato.
