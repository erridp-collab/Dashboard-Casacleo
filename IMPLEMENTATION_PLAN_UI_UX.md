# Alva Host — Piano di implementazione UI/UX

## Obiettivo

Trasformare Alva Host da dashboard molto decorata a workspace SaaS premium, operativo, semplice e autorevole.

Principio guida: stessa potenza funzionale, meno rumore visivo, maggiore gerarchia e leggibilità.

Non modificare:

- business logic;
- API ed endpoint;
- database, migration e Supabase;
- automazioni;
- calcoli finance;
- logica stock;
- autenticazione;
- side-effect delle azioni;
- comportamento CRUD delle prenotazioni.

Il refactor deve essere UI-first e incrementale.

## Direzione visiva

Alva Host deve sembrare il workspace professionale dietro Alva Travel: coerente con il brand, ma più sistematico e produttivo.

Palette obbligatoria:

```css
--canvas: #FAF7F0;
--surface: #FFFFFF;
--surface-muted: /* variante molto chiara del parchment */;
--surface-raised: #FFFFFF;

--text-primary: #4A0E24;
--text-secondary: #6B1E3A;
--text-muted: #8A2A50;

--brand-dark: #4A0E24;
--brand-hover: #6B1E3A;
--brand-primary: #B83560;
--brand-secondary: #E06090;

--border-strong: #8A2A50;
--gold: #F3CF69;

--semantic-error: #E05A2B;
--semantic-warning: #C47A20;
--semantic-success: #3D7A5E;
--semantic-info: #3A6080;
```

Regole:

- canvas principale Parchment, non full-burgundy;
- Burgundy per top bar, identità e testo;
- Raspberry per CTA primaria e stato selezionato;
- Gold raro: logo o massimo un accento significativo per schermata;
- eliminare colori hardcoded quando esiste un token;
- ridurre gradienti, glow, backdrop blur e shadow;
- shadow solo per elementi realmente flottanti: modal, drawer e popover;
- mantenere Geist.

Geometria:

- card: `14–16px`;
- button/input: `10–12px`;
- controlli piccoli: `8–10px`;
- pill solo per badge, tag e status;
- input alti circa `44px`;
- motion breve: `120–180ms`, drawer/modal `180–240ms`;
- niente hover translate o animazioni decorative.

## 1. Fondazioni

Refactor iniziale di:

- `app/globals.css`
- `app/layout.tsx`
- `components/page-container.tsx`
- `components/page-header.tsx`
- `components/card.tsx`
- `components/kpi-card.tsx`
- `components/table.tsx`
- `components/action-badges.tsx`

Creare un sistema condiviso per:

- Primary button: Raspberry;
- Secondary: superficie con bordo;
- Ghost: testo/icona;
- Danger: solo azioni distruttive;
- input e relativi stati;
- card e section;
- KPI;
- badge/status;
- table/list;
- skeleton, empty, error e success state;
- dialog, drawer e mobile sheet.

Le card normali devono usare superficie chiara, bordo sottile, radius massimo 16 px e nessuna shadow predefinita.

## 2. App shell e responsive

Desktop:

```text
Logo | Azioni | Prenotazioni | Rifornimento | Spese | Impostazioni
                                     + Nuova prenotazione | Profilo
```

- Top bar Burgundy.
- CTA “Nuova prenotazione” Raspberry, non Gold.
- Spostare logout nel menu Profilo.
- Active navigation sobria, senza grande pill su ogni voce.
- Mantenere la BottomNav mobile.

Correzioni obbligatorie:

- a 768 e 1024 px il menu attuale supera la viewport: introdurre una navigazione tablet compatta o un menu overflow;
- a 320 px le etichette della BottomNav si sovrappongono: ridurre font/gap e assegnare larghezze uniformi;
- nessun overflow orizzontale a 320, 375, 768, 1024 e 1440 px.

## 3. Page header

Sostituire il pattern ripetuto `icon box + eyebrow + titolo + descrizione`.

Pattern preferito:

```text
Prenotazioni
17 soggiorni · Agosto 2026                + Nuova prenotazione
```

- Titolo forte ma non enorme.
- Metadata breve e utile.
- Action sulla destra.
- Eliminare normalmente le icon box decorative.
- Uppercase solo per micro-label e status.

## 4. Formato date italiano

Formato standard di visualizzazione: `gg/mm/aaaa`.

Usare un formatter condiviso in tutte le schermate:

```text
14/08/2026
14/08/2026 – 18/08/2026
```

Nei titoli contestuali è ammesso il formato esteso:

```text
Giovedì 14 agosto 2026
Agosto 2026
```

Regole tecniche:

- locale `it-IT`;
- formato UI numerico `dd/MM/yyyy`;
- intervalli sempre giorno/mese/anno;
- mantenere `yyyy-MM-dd` nelle API, query, input tecnici e database;
- non convertire le date senza orario passando da UTC, per evitare slittamenti di giorno;
- aggiornare test e fixture che verificano le date.

## 5. Dashboard — P0

Nuova gerarchia:

```text
Riepilogo
Giovedì 14 agosto 2026

Azioni oggi | Da completare | Prenotazioni attive/prossime

Calendario
```

- Rimuovere “Giorno” dalle KPI.
- Evitare quattro KPI tutte equivalenti.
- Valore KPI sempre in text-primary.
- Comunicare warning/success con un piccolo indicatore, non colorando tutta la card.
- Calendario più sobrio e gerarchicamente secondario.
- Ridurre l’effetto arcobaleno degli eventi.
- Conservare viste, navigazione e interazioni esistenti.

## 6. Prenotazioni — P0

La pagina deve essere principalmente:

```text
Header
Filtri
Lista prenotazioni
```

Nuova prenotazione:

- drawer laterale su desktop;
- sheet quasi full-screen su mobile;
- apertura dalla CTA globale o dal FAB mobile;
- non lasciare il form sempre aperto.

Lista desktop:

- visualizzazione text-first;
- niente input disabilitati per mostrare dati;
- trasformare i campi in input soltanto durante la modifica.

Esempio riga:

```text
14/08/2026 → 18/08/2026
4 ospiti · Airbnb · €680 · Da pulire
```

Mobile:

- mantenere le card esistenti;
- mostrare stato, prezzo, date, ospiti, canale, nota, CTA e menu `•••`;
- ridurre badge e bordi decorativi.

Sostituire `confirm()` con il dialog condiviso e correggere l’apertura tramite `?new=1` senza leggere `window` durante il primo render.

## 7. Azioni — P1

Trasformare la pagina in una grouped operational list:

```text
OGGI · 14 AGOSTO 2026

Pulizia                         Da fare
Cambio biancheria               Completata
Spesa                           Da fare
```

- Non usare una card separata per ogni data.
- Usare section, divider e spacing.
- Tipo di azione comunicato principalmente con icona e label.
- Colore riservato soprattutto allo stato.
- Eliminare i tre casi di `<button>` annidati.
- Rendere semanticamente indipendenti apertura riga e azioni secondarie.
- Preservare pulizia, biancheria, lavanderia, manutenzione, spesa e checklist.

## 8. Rifornimento — P1

Mantenere le KPI card create per evitare una pagina piena e troppo lunga.

Struttura principale:

```text
Rifornimento

Prodotti monitorati
Consumabili in evidenza
Biancheria in evidenza

••• Strumenti
```

Comportamento KPI:

- mantenere i dettagli fuori dalla pagina principale;
- rendere “Consumabili” e “Biancheria” veri pulsanti/card interattive;
- mostrare conteggio, livello di attenzione e breve riepilogo;
- aggiungere un indicatore visivo chiaro che comunichi l’apertura dei dettagli;
- non colorare tutta la KPI in base allo stato.

Dettagli:

- drawer da `480–560px` su desktop;
- sheet quasi full-screen su mobile;
- header e filtri sticky;
- lista con scroll interno;
- ricerca/filtro stato se utili;
- azioni di aggiornamento esistenti;
- mantenere pannelli separati per Consumabili e Biancheria se semplifica la logica.

Accessibilità:

- KPI implementate come `<button>` o elemento semantico equivalente;
- `role="dialog"` e `aria-modal`;
- focus spostato nel pannello all’apertura;
- focus trap;
- Escape chiude;
- focus restituito alla KPI;
- pulsante chiudi con `aria-label`.

Import CSV/Excel:

- spostarlo in `••• Strumenti` oppure in “Strumenti avanzati” collapsed;
- includere import e download template esistenti;
- non renderlo il contenuto centrale della pagina.

## 8.1 Anteprima urgenze (post-audit, 2026-08-15)

Le KPI restano invariate: il pattern KPI + drawer era la scelta giusta contro scroll e
confusione. Il problema è che sotto le KPI e sopra “Strumenti” la pagina resta vuota per
~500px quando non c’è nulla che la occupi. La card di anteprima riempie quello spazio con le
urgenze reali, non con contenuto decorativo.

Dati:

- deriva da `monitoredProducts`, già disponibile in pagina — nessuna nuova chiamata;
- filtra i prodotti con `getRefillState() !== "OK"` (`lib/refill.ts`, già unifica lo stato di
  consumabili e biancheria su una scala comune OK / IN_ESAURIMENTO / DA_RIFORNIRE);
- ordina `DA_RIFORNIRE` prima di `IN_ESAURIMENTO`;
- mostra tutti i risultati se sono ≤ 5, altrimenti i 3 più severi con una riga finale
  “Vedi tutti gli N →”.

Interazione:

- ogni riga è cliccabile e apre il drawer pertinente (Consumabili o Biancheria) tramite lo
  stesso `setOpenModal` già usato dalle KPI cliccabili;
- nessuno scroll-to-item dentro il drawer in questa prima versione: il drawer si apre e basta,
  l’articolo non viene evidenziato né scrollato in vista;
- la riga “Vedi tutti” apre il drawer della categoria con più urgenze residue.

Stato vuoto:

- quando non c’è nessuna urgenza la card resta visibile con una riga unica (“Tutto a posto,
  nessun rifornimento necessario”) invece di sparire, così la pagina non cambia altezza tra
  stato vuoto e stato pieno.

Componenti:

- nuovo `components/refill-urgent-preview.tsx`;
- riuso di `RefillStateBadge` esistente per lo stato di ogni riga;
- nessuna modifica ai due drawer esistenti né alla struttura delle KPI.

## 9. Spese — P1

Portare i filtri vicino all’header:

```text
Spese
Agosto 2026 ▾    Ultimi 6 mesi ▾               + Aggiungi spesa
```

- Compattare la card Periodo.
- KPI: Entrate, Spese, Netto.
- Valori in text-primary; colore semantico solo secondario.
- “Aggiungi spesa” primary o secondary, mai danger.
- Lista movimenti più compatta.
- Eventuale filtro UI Tutti/Entrate/Spese senza alterare il backend.
- Ridurre altezza degli empty state e spazio prima dei grafici.

## 10. Impostazioni e autenticazione — P2

Impostazioni:

- eliminare card introduttive e annidamenti;
- organizzare in sezioni o tab;
- compattare catalogo e biancheria;
- `aria-label` su modifica/elimina;
- isolare chiaramente le azioni distruttive.

Login/Auth:

```text
ALVA HOST

Bentornato
Accedi al tuo workspace

Email
Password

Accedi

Richiedi accesso · Password dimenticata
```

Rimuovere titolo duplicato, glow, blur e superfici decorative.

## 11. Accessibilità

Target WCAG AA:

- contrasto sufficiente;
- focus sempre visibile;
- navigazione completa da tastiera;
- niente interactive element annidati;
- label collegate agli input;
- icon-only button con nome accessibile;
- touch target adeguati;
- status comprensibili senza affidarsi solo al colore;
- dialog e drawer con focus management;
- selected state non comunicato soltanto cromaticamente.

## 12. Ordine di consegna

1. Token e `globals.css`.
2. Card, button, input, KPI e badge.
3. TopBar, BottomNav, PageContainer e PageHeader.
4. Formattazione date centralizzata.
5. Dashboard.
6. Prenotazioni.
7. Validazione delle due golden screen.
8. Table e grouped list.
9. Azioni.
10. Dialog, drawer e sheet.
11. Rifornimento.
12. Spese.
13. Impostazioni e autenticazione.
14. Stati globali, responsive e accessibility QA.

## Verifica e Definition of Done

Dopo ogni blocco:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Aggiornare gli E2E obsoleti e correggere la configurazione lint affinché ignori le `.next` dei worktree secondari.

Il lavoro è concluso quando:

- tutti i workflow esistenti funzionano;
- non sono cambiati API, dati o business logic;
- Dashboard e Prenotazioni definiscono uno standard coerente;
- nessuna pagina ha overflow ai breakpoint richiesti;
- le date sono sempre italiane;
- Rifornimento resta compatto e i dettagli sono facilmente accessibili;
- CTA primaria e stati sono immediatamente comprensibili;
- l’interfaccia usa meno card, colori, ombre e decorazioni;
- dialog, drawer e sheet sono accessibili;
- TypeScript, lint, test ed E2E pertinenti passano.
