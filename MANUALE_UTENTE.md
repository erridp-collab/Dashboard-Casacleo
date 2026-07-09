# Manuale Utente — Dashboard Casa Cleo

Guida operativa completa per la gestione quotidiana degli affitti brevi tramite la dashboard.

---

## Indice

1. [Primo accesso](#1-primo-accesso)
2. [Accesso quotidiano (Login)](#2-accesso-quotidiano-login)
3. [Riepilogo — Panoramica](#3-riepilogo--panoramica)
4. [Prenotazioni](#4-prenotazioni)
5. [Azioni operative](#5-azioni-operative)
6. [Rifornimento](#6-rifornimento)
7. [Spese](#7-spese)
8. [Impostazioni](#8-impostazioni)
9. [Richiesta accesso per un nuovo utente](#9-richiesta-accesso-per-un-nuovo-utente)

---

## 1. Primo accesso

Se è la prima volta che accedi, segui questi passi:

### 1.1 Ricevi il link di reset password

Dopo che l'amministratore ha approvato il tuo accesso, ricevi una email con un link per impostare la password. Clicca il link — ti porta direttamente alla pagina di reset.

### 1.2 Imposta la password

- Inserisci la nuova password nel campo **Nuova password**
- Confermala nel campo **Conferma password**
- Clicca **Salva password**

La password deve avere almeno 8 caratteri.

### 1.3 Onboarding iniziale

Al primo login vieni portato automaticamente alla pagina di configurazione iniziale. È divisa in due blocchi.

**Blocco 1 — Dati base attività**

Compila:

- **Nome attività** — es. "Casa Cleo"
- **Valuta** — es. EUR
- **Fuso orario** — es. Roma
- **Referente** — il tuo nome o il nome del gestore

Clicca **Completa onboarding**. Il blocco si salva e puoi passare al secondo.

**Blocco 2 — Prodotti & Biancheria**

Qui configuri il catalogo prodotti usato dall'inventario e dall'automazione delle prenotazioni. Il catalogo ha due tab:

**Tab Biancheria**

Aggiungi ogni tipo di biancheria che usi (set letto, asciugamani, tappetini, strofinacci). Per ogni articolo:

1. Clicca **Aggiungi biancheria**
2. Inserisci il **nome** (es. "Asciugamani Grandi")
3. Scegli a cosa è **collegato** — determina quante unità il sistema scala automaticamente per ogni prenotazione:

| Collegato a | Consumo automatico |
|---|---|
| Set letto estivo | 1 ogni 2 ospiti |
| Set letto invernale | 1 ogni 2 ospiti |
| Asciugamano corpo | 1 per ospite |
| Asciugamano doccia | 1 per ospite |
| Asciugamano bidet | 1 per ospite |
| Asciugamano viso | 1 per ospite |
| Tappetino doccia | 1 fisso per prenotazione |
| Strofinacci | 1 fisso per prenotazione |

> Ogni collegamento può essere assegnato a **un solo prodotto**. Se è già assegnato appare disabilitato nel menu. Puoi aggiungere articoli senza collegamento — verranno tracciati a quantità ma senza consumo automatico.

4. Inserisci la **quantità iniziale** (quante unità hai in casa), l'**unità di misura** e la **soglia minima** (sotto cui il sistema ti avvisa di rifornire)
5. Clicca **Salva**

**Tab Consumabili**

Aggiungi i prodotti di consumo (saponi, detersivi, carta igienica, ecc.). Per ogni articolo:

1. Clicca **Aggiungi consumabile**
2. Inserisci **nome**, **categoria** (es. Pulizia, Cucina, Bagno) e **unità di misura**
3. Clicca **Salva**

I consumabili non hanno consumo automatico — vengono tracciati a 3 stati: **Pieno / A metà / Finito**, aggiornati manualmente durante le azioni operative.

Puoi aggiungere, modificare ed eliminare prodotti in qualsiasi momento anche da **Impostazioni → Catalogo prodotti**.

---

## 2. Accesso quotidiano (Login)

1. Vai su `host.alva.land`
2. Inserisci **email** e **password**
3. Clicca **Accedi**

Se dimentichi la password:

1. Clicca **Password dimenticata?** sotto il form di login
2. Inserisci la tua email
3. Ricevi il link di reset e segui le istruzioni

---

## 3. Riepilogo — Panoramica

Il Riepilogo è la schermata principale (dashboard). Si apre automaticamente dopo il login.

### 3.1 KPI in evidenza

Nella parte alta trovi 4 card con i dati chiave del giorno:

| Card | Cosa mostra |
|---|---|
| **Prenotazioni Totali** | numero totale di prenotazioni nel sistema |
| **Azioni Oggi** | quante azioni sono previste oggi, con indicazione di quelle ancora da fare |
| **Azioni Aperte** | azioni "Da fare" non ancora completate (arancione = attenzione, rosso = critico) |
| **Giorno** | data odierna |

### 3.2 Calendario

Sotto le KPI card trovi il calendario mensile con tutti gli eventi:

| Colore | Tipo evento |
|---|---|
| Blu | Prenotazione |
| Verde | Pulizia |
| Giallo | Biancheria |
| Arancio | Lavatrici |
| Viola | Manutenzione |
| Grigio | Spesa / Shopping |

Puoi navigare tra i mesi con le frecce in alto al calendario.

---

## 4. Prenotazioni

Accedi dalla voce **Prenotazioni** nel menu.

### 4.1 Visualizzare le prenotazioni

Le prenotazioni sono elencate in ordine cronologico. Per ogni prenotazione vedi:

- Date check-in / check-out con numero di notti
- Numero di ospiti
- Canale (Airbnb in giallo, Booking in blu)
- Importo totale (se inserito)
- Stato pulizia

Di default le prenotazioni completate sono nascoste. Per vederle, attiva **Mostra completate**.

### 4.2 Espandere una prenotazione

Clicca su una prenotazione per espanderla e vedere le azioni operative collegate (pulizia, biancheria, lavatrici, ecc.).

### 4.3 Aggiungere una prenotazione

Clicca il pulsante **+ Nuova prenotazione** (in alto a desktop, FAB in basso a mobile).

Compila il form:

- **Check-in** — data di arrivo degli ospiti
- **Check-out** — data di partenza
- **Ospiti** — numero di persone
- **Canale** — Airbnb, Booking.com, o altro
- **Importo totale** — entrata dalla prenotazione (opzionale, inseribile anche dopo)
- **Note** — note libere (es. richieste speciali)

Clicca **Salva prenotazione**.

Il sistema crea automaticamente le azioni operative collegate (pulizia, biancheria, lavatrici) basandosi sulle date inserite.

### 4.4 Modificare una prenotazione

1. Espandi la prenotazione con il clic
2. Clicca il menu **···** a destra
3. Seleziona **Modifica**
4. Aggiorna i campi e clicca **Salva**

Per aggiornare solo l'importo: clicca direttamente sull'importo della prenotazione, modifica e clicca **Salva importo**.

### 4.5 Eliminare una prenotazione

1. Clicca il menu **···** sulla prenotazione
2. Seleziona **Elimina**
3. Conferma l'eliminazione

L'eliminazione rimuove anche tutte le azioni collegate e ripristina le scorte di biancheria consumata.

---

## 5. Azioni operative

Accedi dalla voce **Azioni** nel menu.

Le azioni rappresentano il lavoro operativo da fare: pulizie, cambio biancheria, lavatrici, manutenzione, spesa.

### 5.1 Navigazione mensile

In alto trovi il selettore del mese con le frecce `<` e `>`. Le azioni sono raggruppate per data all'interno del mese.

### 5.2 Tipi di azione

| Tipo | Icona | Descrizione |
|---|---|---|
| Pulizia | scopa | pulizia appartamento tra un soggiorno e l'altro |
| Biancheria | letto | cambio e preparazione biancheria |
| Lavatrici | lavatrice | cicli di lavaggio biancheria |
| Manutenzione | chiave | interventi tecnici |
| Spesa / Shopping | carrello | acquisto scorte e materiali |

### 5.3 Stati delle azioni

Ogni azione ha uno stato:

- **Da fare** — da completare (badge arancione)
- **Completata** — fatta (badge verde)

### 5.4 Completare un'azione

Clicca sul badge **Da fare** dell'azione per marcarla come **Completata**.

Per le azioni di biancheria: si apre un modal dove puoi inserire le quantità di biancheria effettivamente usata (set letto estivi/invernali, asciugamani viso/doccia/bidet, tappetino, strofinacci). Conferma e il sistema scala automaticamente le scorte dall'inventario.

Per tornare indietro su un'azione già completata: clicca sul badge **Completata** per riportarla a **Da fare** e ripristinare le scorte.

### 5.5 Checklist azioni

Alcune azioni hanno una checklist di sotto-task. Clicca l'icona **checklist** sull'azione per aprire il modal e spuntare i punti uno per uno.

### 5.6 Modal pulizia

Per le azioni di pulizia, clicca l'icona apposita per aprire il modal con le istruzioni dettagliate di pulizia e la checklist specifica.

---

## 6. Rifornimento

Accedi dalla voce **Rifornimento** nel menu.

### 6.1 Schede: Biancheria e Consumabili

L'inventario è diviso in due tab:

- **Biancheria** — set letto, asciugamani, tappetini, strofinacci
- **Consumabili** — saponi, detersivi, carta igienica e altri prodotti di consumo

### 6.2 Leggere lo stato delle scorte

Per ogni prodotto vedi:

- **Quantità attuale** — scorte presenti
- **Soglia** — livello minimo sotto cui si è in esaurimento
- **Barra colorata** — indica visivamente lo stato:
  - Verde: scorte OK
  - Giallo/ambra: in esaurimento (sotto soglia)
  - Rosso: da rifornire urgentemente

### 6.3 Rifornire un prodotto

1. Clicca **Rifornisci** sul prodotto
2. Inserisci la **quantità aggiunta** (quante unità hai comprato/ricevuto)
3. Inserisci l'**importo speso** (opzionale — viene registrato tra le spese)
4. Clicca **Registra rifornimento**

La quantità viene aggiornata e, se inserito l'importo, viene creata automaticamente una spesa.

### 6.4 Import CSV o Excel (aggiornamento in blocco)

Per aggiornare più prodotti in una volta:

1. Scorri in fondo alla pagina Rifornimento
2. Clicca **Apri import** per espandere la sezione
3. Scarica il template CSV o Excel per vedere il formato corretto
4. Modifica il file con le nuove quantità/soglie
5. Carica il file e clicca **Applica import**

---

## 7. Spese

Accedi dalla voce **Spese** nel menu.

### 7.1 KPI mensili

In alto trovi tre card per il mese selezionato:

| Card | Descrizione |
|---|---|
| **Entrate** | somma prenotazioni del mese |
| **Uscite** | somma spese del mese |
| **Netto** | entrate meno uscite |

### 7.2 Grafici

- **Grafico a barre** — confronto entrate/uscite mese per mese (ultimi 6 mesi di default)
- **Grafico lineare** — andamento del profitto netto nel tempo

Usa il selettore **Mesi** per cambiare quanti mesi mostrare (da 3 a 12).

### 7.3 Selezionare il mese di dettaglio

Clicca su una barra del grafico o usa il menu a tendina del mese per vedere il dettaglio delle singole voci di quel mese.

### 7.4 Elenco voci del mese

Sotto i grafici trovi l'elenco delle entrate e uscite del mese selezionato con: data, tipo, categoria, descrizione, importo.

### 7.5 Aggiungere una spesa manuale

Clicca **Aggiungi**. Si apre il form **Nuova spesa**, compila:

- **Data** — quando è avvenuta la spesa
- **Categoria** — Pulizie, Rifornimento, Manutenzione, Utenze, Affitto, Commissioni, Altro
- **Descrizione** — testo libero
- **Importo** — in euro

Clicca **Salva spesa**. La spesa appare subito nell'elenco e aggiorna le KPI.

### 7.6 Eliminare una spesa

Clicca l'icona **cestino** a destra della voce. Per le spese generate automaticamente (da un'azione o un rifornimento) viene mostrato un avviso: se elimini una spesa automatica e l'azione collegata torna completata, la spesa viene ricreata.

---

## 8. Impostazioni

Accedi dalla voce **Impostazioni** nel menu.

### 8.1 Dati attività

Qui puoi modificare i dati della tua attività configurati durante l'onboarding:

- Nome attività
- Valuta
- Fuso orario
- Referente

Salva con **Salva impostazioni**.

### 8.2 Catalogo prodotti

Nella stessa pagina trovi la sezione **Prodotti & Biancheria**, divisa in due tab: **Biancheria** e **Consumabili**. Il funzionamento è identico a quello dell'onboarding (vedi [§1.3](#13-onboarding-iniziale) per la guida completa con la tabella dei collegamenti).

Operazioni disponibili:

- **Aggiungere** un articolo: clicca **Aggiungi biancheria** / **Aggiungi consumabile**
- **Modificare** un articolo esistente (inclusi nome, collegamento e quantità totale): clicca l'icona **matita**
- **Eliminare** un articolo: clicca l'icona **cestino** e conferma

> Se elimini un articolo di biancheria collegato al rifornimento automatico, quel tipo di biancheria non verrà più scalato automaticamente dalle prenotazioni future.

---

## 9. Richiesta accesso per un nuovo utente

Se vuoi dare accesso a qualcun altro (un co-gestore, un collaboratore):

**L'utente deve:**
1. Andare su `host.alva.land/signup`
2. Inserire email, nome (opzionale) e nome organizzazione
3. Inviare la richiesta

**Tu (admin) devi:**
1. Andare su `/platform/requests`
2. Trovare la richiesta in stato **In attesa**
3. Cliccare **Approva**
4. Il sistema crea automaticamente l'account e invia all'utente il link per impostare la password

Se la richiesta va in errore (stato **Fallito**), puoi cliccare **Riprova provisioning** per ripetere la creazione dell'account.

---

## Domande frequenti

**Posso modificare le date di una prenotazione esistente?**
Sì, dal menu `···` della prenotazione → Modifica. Le azioni collegate vengono aggiornate automaticamente.

**Le azioni si creano automaticamente?**
Sì. Quando crei una prenotazione, il sistema genera in automatico le azioni di pulizia, biancheria e lavatrici nelle date corrette.

**Cosa succede se marco un'azione come Completata per errore?**
Riclicca sul badge Completata → l'azione torna a Da fare e le scorte vengono ripristinate.

**Come faccio a sapere se le scorte stanno per finire?**
Guarda la barra colorata in Rifornimento: gialla = in esaurimento, rossa = da rifornire subito. Le azioni di tipo Spesa vengono create automaticamente quando un prodotto scende sotto la soglia.

**Perché non riesco ad accedere?**
Controlla di avere le credenziali corrette. Se il problema persiste, usa **Password dimenticata** per ricevere un nuovo link. Se l'account è stato disabilitato, contatta l'amministratore.
