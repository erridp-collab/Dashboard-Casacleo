# Design: Gestione Catalogo Prodotti

**Data:** 2026-06-18  
**Stato:** Approvato  

## Problema

I prodotti (biancheria e consumabili) sono attualmente inseriti solo tramite migrazioni SQL con SKU hardcoded. Non esiste nessuna UI per aggiungere, modificare o eliminare prodotti. Le funzioni SQL `create_booking` e `delete_booking_atomic` fanno riferimento a SKU e nomi hardcoded, rendendo impossibile la personalizzazione per organizzazioni diverse.

## Soluzione

CRUD completo per il catalogo prodotti con un sistema di **ruoli biancheria** predefiniti. I ruoli collegano i prodotti all'automazione prenotazioni senza accoppiare il codice a SKU specifici.

---

## Data Model

### Nuova colonna: `products.linen_role`

```sql
ALTER TABLE public.products
  ADD COLUMN linen_role TEXT DEFAULT NULL
  CONSTRAINT products_linen_role_check CHECK (
    linen_role IS NULL OR linen_role = ANY(ARRAY[
      'set_estivo', 'set_invernale',
      'asciugamano_corpo', 'asciugamano_doccia',
      'asciugamano_bidet', 'asciugamano_viso',
      'tappetino_doccia', 'mappina_cucina'
    ])
  );
```

**Unicità:** Un ruolo può essere assegnato a un solo prodotto per organizzazione. Enforce tramite unique index parziale:

```sql
CREATE UNIQUE INDEX products_linen_role_org_unique
  ON public.products (organization_id, linen_role)
  WHERE linen_role IS NOT NULL;
```

### Ruoli e formule di consumo

| `linen_role` | Label UI | Formula consumo per prenotazione |
|---|---|---|
| `set_estivo` | Set letto estivo | `ceil(ospiti / 2)` |
| `set_invernale` | Set letto invernale | `ceil(ospiti / 2)` |
| `asciugamano_corpo` | Asciugamano corpo | `ospiti × 1` |
| `asciugamano_doccia` | Asciugamano doccia | `ospiti × 1` |
| `asciugamano_bidet` | Asciugamano bidet | `ospiti × 1` |
| `asciugamano_viso` | Asciugamano viso | `ospiti × 1` |
| `tappetino_doccia` | Tappetino doccia | `1` fisso |
| `mappina_cucina` | Mappina cucina | `1` fisso |

Prodotti senza ruolo = biancheria tracciata a quantità ma non consumata automaticamente, oppure consumabili (usa `stock_status`).

### Estendibilità

Aggiungere un nuovo ruolo richiede solo:
1. Aggiungere il valore al check constraint (migration SQL)
2. Aggiungere la formula in `create_booking`
3. Aggiungere la label nella UI

### Migration retroattiva

La migration assegna `linen_role` ai prodotti esistenti basandosi sul campo `name` (per organizzazioni già create con il seed SQL):

| `lower(trim(name))` | `linen_role` assegnato |
|---|---|
| `set letto estivo` | `set_estivo` |
| `set letto invernale`, `copripiumini + federe` | `set_invernale` |
| `asciugamani corpo` | `asciugamano_corpo` |
| `asciugamani doccia` | `asciugamano_doccia` |
| `asciugamani bidet` | `asciugamano_bidet` |
| `asciugamani viso` | `asciugamano_viso` |
| `tappetini doccia` | `tappetino_doccia` |
| `mappine cucina` | `mappina_cucina` |

Prodotti non riconosciuti mantengono `linen_role = NULL` e vanno assegnati manualmente dall'utente dall'UI.

---

## API

### Endpoint nuovi

#### `POST /api/products`
Crea un nuovo prodotto per l'organizzazione corrente.

**Body biancheria:**
```json
{
  "name": "Asciugamani Grandi",
  "linen_role": "asciugamano_corpo",
  "quantity": 30,
  "unit": "pz",
  "threshold": 6
}
```

`quantity` imposta sia `qty`/`quantity` (quantità corrente) che `max_qty` (massimo storico). Partono uguali; `max_qty` non viene più aggiornato automaticamente dopo la creazione.

**Body consumabile:**
```json
{
  "name": "Detersivo Pavimenti",
  "category": "Pulizia",
  "unit": "ml"
}
```

La distinzione biancheria/consumabile si desume dal payload: presenza di `linen_role` o `quantity` → biancheria (tracciata a quantità); altrimenti → consumabile (tracciato a `stock_status`). Non esiste una colonna `type` nel DB.

**Validazioni:**
- `name` richiesto, non vuoto
- `linen_role` deve essere nel set ammesso se presente
- `linen_role` non già assegnato ad altro prodotto dell'organizzazione
- `quantity` ≥ 0 per biancheria

**Risposta:** `{ id, name, linen_role, ... }` con status 201.

#### `PATCH /api/products/[id]`
Aggiorna i metadati di un prodotto (non la quantità corrente — quella resta a `restock`).

**Campi modificabili:** `name`, `category`, `unit`, `linen_role`, `threshold`, `max_qty`

**Validazioni:** stesse del POST per `linen_role`. Se si rimuove il ruolo da un prodotto, l'automazione smette di consumarlo per le prenotazioni future (le prenotazioni esistenti non vengono toccate).

#### `DELETE /api/products/[id]`
Elimina il prodotto.

**Comportamento:** Se il prodotto ha un `linen_role`, l'API lo elimina comunque ma il client deve mostrare un avviso di conferma esplicito. Non blocca se ci sono prenotazioni future (l'automazione semplicemente non troverà il prodotto e salterà il consumo).

### Endpoint esistenti invariati

`GET /api/products`, `POST /api/products/restock`, `PATCH /api/products/stock-status`, `PUT /api/products/bulk` rimangono identici.

---

## Automazione SQL

### `create_booking` — aggiornamento

Invece di fare `WHERE sku = 'completi_letto'`, la funzione usa:

```sql
WHERE linen_role = 'set_estivo' AND organization_id = p_org_id
```

Se nessun prodotto ha quel ruolo per l'organizzazione, il consumo viene saltato silenziosamente (nessun errore — il B&B semplicemente non ha quel tipo di biancheria).

### `delete_booking_atomic` — aggiornamento

Analogamente, il restore delle quantità usa `linen_role` invece dei nomi hardcoded. Il parametro `p_linen_restore` mantiene la stessa struttura JSON per backwards compatibility.

---

## UI Flow

### Punto di accesso 1: Onboarding (step aggiuntivo)

L'onboarding acquista un secondo step dopo i dati base workspace:

```
Step 1: Dati workspace (nome, valuta, fuso orario)  ← già esiste
Step 2: Configura prodotti                           ← nuovo
```

Il nuovo step mostra due colonne affiancate (Biancheria / Consumabili) con lista prodotti e pulsante "+ Aggiungi". Al completamento si marca l'onboarding come completato.

Se l'organizzazione ha già prodotti (migration seed), lo step li mostra pre-popolati e si può modificarli o aggiungerne.

### Punto di accesso 2: Impostazioni

La pagina `/settings` ottiene una nuova card **"Prodotti & Biancheria"** che contiene la stessa interfaccia dello step onboarding, ma senza il flusso guidato.

### Componente condiviso: `ProductCatalogEditor`

Un unico componente riusabile usato sia nell'onboarding che nelle impostazioni.

**Struttura:**
- Tab bar: `Biancheria | Consumabili`
- Lista prodotti con azioni edit/delete per riga
- Pulsante "+ Aggiungi prodotto" apre modal/bottom sheet
- Modal biancheria: nome, ruolo (select con descrizione formula live), qtà iniziale, unità, soglia
- Modal consumabile: nome, categoria (text input), unità
- Avviso di conferma prima di eliminare prodotti con ruolo attivo

### Comportamento ruolo nel select

Quando l'utente seleziona un ruolo nel form biancheria, sotto il select appare una riga descrittiva:
- `asciugamano_corpo` → "consumato 1 per ospite ad ogni prenotazione"
- `set_estivo` → "consumato 1 ogni 2 ospiti ad ogni prenotazione"
- `tappetino_doccia` → "consumato 1 fisso per prenotazione"
- Nessun ruolo → "tracciato a quantità, nessun consumo automatico"

I ruoli già assegnati ad altri prodotti dell'organizzazione appaiono nel select con etichetta "(già assegnato)" e sono disabilitati.

---

## Componenti da creare/modificare

| File | Tipo | Cosa cambia |
|---|---|---|
| `supabase/migrations/YYYYMMDD_add_linen_role.sql` | Nuovo | Colonna + index + migration retroattiva |
| `supabase/migrations/YYYYMMDD_update_booking_functions.sql` | Nuovo | Aggiorna `create_booking` e `delete_booking_atomic` |
| `app/api/products/route.ts` | Modifica | Aggiunge `POST` handler |
| `app/api/products/[id]/route.ts` | Nuovo | `PATCH` e `DELETE` handler |
| `components/product-catalog-editor.tsx` | Nuovo | Componente CRUD biancheria + consumabili |
| `app/onboarding/page.tsx` | Modifica | Aggiunge step 2 prodotti |
| `app/settings/page.tsx` | Modifica | Aggiunge card "Prodotti & Biancheria" |

---

## Fuori scope

- Import/export CSV del catalogo prodotti (già coperto dalla feature bulk esistente)
- Storico modifiche prodotti
- Prodotti condivisi tra organizzazioni
- Formule di consumo personalizzate (non predefinite)
