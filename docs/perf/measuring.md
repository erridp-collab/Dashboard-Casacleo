# Misurare le performance di caricamento

Procedura per confrontare i tempi "prima" e "dopo" le fasi successive del piano di
ottimizzazione (DAL, Server Components, cache client), usando la strumentazione
aggiunta in questa fase.

## Cosa è stato strumentato

- **Middleware (`proxy.ts`)**: logga `mw-auth` (verifica sessione) e `mw-org` (lookup
  organizzazione, solo sulle navigazioni di pagina) per ogni richiesta, con un id di
  correlazione (`x-request-id`) propagato alla route handler a valle.
- **Route API** (`/api/bookings`, `/api/actions`, `/api/products`, `/api/finance`, solo
  `GET`): loggano `auth`, `roles` e le query DB proprie della route, con lo stesso
  `x-request-id` quando la richiesta arriva da una navigazione già passata dal middleware.
- **Click → dato visibile**: i link della barra di navigazione marcano l'istante del
  click; le pagine Dashboard, Azioni, Prenotazioni, Rifornimento e Spese marcano
  l'istante in cui i dati sono effettivamente a schermo (non il primo pixel).

Ogni riga di log è preceduta da `[perf]`:
- le righe `layer:"middleware"` e `layer:"route"` vanno sul terminale del dev server
  (o nei log della funzione su Vercel in produzione)
- le righe `nav:<pagina> click-to-visible` vanno nella console del browser

## Procedura

1. Avvia l'app (`npm run dev`) e apri DevTools (Network + Console) prima di navigare.
2. **Sessione calda, non cold start**: fai un primo giro di navigazione "di
   riscaldamento" su tutte e 5 le pagine e scartalo — un cold start di Lambda o del
   processo Next inquina la prima misura e non è rappresentativo dell'uso reale.
3. Per ciascuna pagina (Riepilogo, Azioni, Prenotazioni, Rifornimento, Spese):
   - clicca sulla voce di menu
   - annota dalla Console il valore `nav:<pagina> click-to-visible NNNms`
   - apri la richiesta corrispondente in Network → tab "Timing" e leggi l'header
     `Server-Timing` per la scomposizione (`auth`, `roles`, `db-*`)
   - ripeti 5 volte per pagina, annota la **mediana**, non la media — un outlier di
     rete falsa la media molto più della mediana
4. Per contare quante volte `getUser` viene chiamato davvero su una singola
   navigazione: prendi `x-request-id` dalla risposta e cercalo nei log del server:
   ```bash
   grep '"reqId":"<uuid>"' dev-server.out.log
   ```
   Il numero di righe con `"name":"mw-auth"` o `"name":"auth"` per lo stesso `reqId`
   è il numero di verifiche di sessione fatte per quella navigazione.
5. Salva i 5 numeri (mediana per pagina) in un foglio prima di iniziare le fasi
   successive. Ripeti lo stesso identico protocollo dopo ogni fase per un confronto onesto.

## Cosa non copre questa fase

- Le mutazioni (PATCH azioni, POST prenotazioni, ecc.) non sono strumentate — sono
  un'altra fase del piano.
- Non c'è ancora RUM aggregato su utenti reali (Speed Insights): è il task opzionale
  finale di questa fase, utile solo dopo un deploy in produzione.

## Sicurezza

Gli header `Server-Timing` e le righe `[perf]` contengono solo nomi di fase e durate.
Non aggiungere mai a questi log id organizzazione, id utente, email o conteggi di righe
per tenant: sono leggibili dal client (header) o finiscono nei log aggregati (console).
