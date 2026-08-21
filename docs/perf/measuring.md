# Misurare le performance di caricamento

Procedura per confrontare i tempi "prima" e "dopo" le fasi successive del piano di
ottimizzazione (DAL, Server Components, cache client), usando la strumentazione
aggiunta in questa fase.

## Cosa è stato strumentato

- **Middleware (`proxy.ts`)**: sulle navigazioni di pagina logga `mw-auth` (verifica
  sessione), `mw-claims` (subject verificato localmente) e `mw-org` (lookup
  organizzazione). Le API saltano questa verifica
  duplicata e applicano l'autenticazione autorevole nella route.
- **Route API** (`/api/bookings`, `/api/actions`, `/api/products`, `/api/finance`, solo
  `GET`): loggano `auth`, `roles` e le query DB proprie della route, con lo stesso
  `x-request-id` quando la richiesta arriva da una navigazione già passata dal middleware.
- **Click → dato dipinto**: i link della barra di navigazione marcano il click; le
  pagine Dashboard, Azioni, Prenotazioni, Rifornimento e Spese chiudono la misura
  dopo il commit React e due frame di rendering. Un `navigationId` UUID correla
  tutte le API iniziali della stessa navigazione ed è usato solo come telemetria.

Ogni riga di log è preceduta da `[perf]`:
- le righe `layer:"middleware"` e `layer:"route"` vanno sul terminale del dev server
  (o nei log della funzione su Vercel in produzione)
- le righe `nav:<pagina> click-to-painted` vanno nella console del browser

## Procedura

1. Misura una build di produzione (`npm run build`, poi `npm start`) oppure un deploy
   Preview/Production. `npm run dev` serve solo al debug e non produce numeri
   confrontabili: compilazione on-demand e prefetch hanno comportamento diverso.
2. Registra separatamente due scenari:
   - **warm navigation**: primo giro scartato, route già visitate/prefetch attivo;
   - **cold navigation**: nuova sessione browser e processo/deploy non riscaldato.
3. Per ciascuna pagina (Riepilogo, Azioni, Prenotazioni, Rifornimento, Spese):
   - clicca sulla voce di menu
   - annota dalla Console `nav:<pagina> click-to-painted NNNms navId=<uuid>`;
   - cerca quel `navigationId` nei log `[perf]` per raggruppare tutte le API iniziali;
   - usa `wallMs` come durata server reale e le singole fasi (`auth`, `roles`, `db-*`)
     per la scomposizione. L'header `Server-Timing` è diagnostico ma non include le
     fasi middleware, perché Next.js può sovrascrivere header omonimi;
   - ripeti almeno 20 volte per pagina e salva **p50, p75 e p95**, oltre agli errori.
4. Per analizzare una singola richiesta prendi `x-request-id` dalla risposta e
   cercalo nei log del server:
   ```bash
   grep '"reqId":"<uuid>"' dev-server.out.log
   ```
   Per le API tenant deve esistere una sola fase `auth` nella route e nessuna
   `mw-auth`. Qualunque regressione indica che l'autenticazione è stata duplicata.
5. Ripeti lo stesso protocollo dopo ogni fase, mantenendo invariati browser, rete,
   CPU throttling, dataset e stato warm/cold.

### Harness automatico

Con una build di produzione gia avviata e uno storage state Playwright autenticato:

```powershell
node scripts/perf-measure.mjs http://127.0.0.1:3000 20 playwright/.auth/user.json
```

Lo script scarta un giro di warm-up e stampa p50, p75 e p95 click-to-painted per
pagina, oltre alla scomposizione degli header `Server-Timing`.

## Risultato post-ottimizzazione - 2026-08-20

Confronto locale controllato su build di produzione, stesso browser Chromium
headless, viewport 1440x1000, stesso account e dataset, un warm-up scartato e 20
campioni warm per pagina. La baseline e il post sono stati eseguiti da due worktree
dello stesso commit `c5913b2`; il post include esclusivamente le modifiche della
prima fase performance non ancora committate.

| Pagina | Baseline p50 | Post p50 | Baseline p75 | Post p75 | Delta p75 | Baseline p95 | Post p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Riepilogo | 504,1 ms | 355,7 ms | 523,6 ms | 360,4 ms | -31,2% | 541,4 ms | 375,5 ms |
| Azioni | 456,4 ms | 391,3 ms | 474,1 ms | 392,3 ms | -17,3% | 489,5 ms | 424,7 ms |
| Prenotazioni | 440,5 ms | 375,5 ms | 441,9 ms | 376,5 ms | -14,8% | 458,6 ms | 392,3 ms |
| Rifornimento | 358,0 ms | 291,2 ms | 358,5 ms | 291,9 ms | -18,6% | 399,6 ms | 326,3 ms |
| Spese | 474,4 ms | 392,5 ms | 475,7 ms | 408,3 ms | -14,2% | 508,7 ms | 425,1 ms |

Media semplice p75: da 454,8 ms a 365,9 ms (`-19,5%`). Il p95 migliora su tutte
le pagine. Nella baseline ogni API attraversava `mw-auth`; nel post gli header
mostrano solo l'autenticazione autorevole della route (`auth`, `roles`) e nessuna
fase middleware sulle API. Il filtro Dashboard limita inoltre le prenotazioni a
`check_out >= oggi`, sempre dopo il vincolo `organization_id`.

## Risultato fase 2 - query Prenotazioni unificata - 2026-08-21

La pagina Prenotazioni recupera booking e stato pulizie tramite una sola relazione
embedded PostgREST. Sia la tabella principale sia la relazione `actions` applicano
esplicitamente `organization_id`; la proiezione scarta inoltre qualunque azione
annidata che non appartenga al tenant autorizzato. Dashboard usa la variante leggera
`includeCleaningStatus=false`, perche non visualizza lo stato pulizie.

Con lo stesso harness di produzione, warm-up scartato e 20 campioni:

| Metrica Prenotazioni | Fase 1 | Fase 2 | Delta |
| --- | ---: | ---: | ---: |
| p50 click-to-painted | 375,5 ms | 277,3 ms | -26,2% |
| p75 click-to-painted | 376,5 ms | 290,3 ms | -22,9% |
| p95 click-to-painted | 392,3 ms | 340,7 ms | -13,2% |

Il tratto dati server passa da due fasi sequenziali (`db-bookings` p75 75,5 ms e
`db-actions-status` p75 81,9 ms) a una sola fase
(`db-bookings-with-cleaning` p75 74,0 ms). Rispetto alla baseline iniziale, il p75
Prenotazioni complessivo passa da 441,9 ms a 290,3 ms (`-34,3%`).

## Risultato fase 3 - auth e membership sovrapposte - 2026-08-21

Con JWT asimmetrici ES256, `getClaims` verifica localmente firma e scadenza usando
la JWKS condivisa in memoria. Il subject verificato serve esclusivamente ad avviare
prima la query membership: ogni richiesta continua ad attendere `getUser`, non usa
cache di ruoli e accetta i risultati anticipati solo quando il subject coincide con
l'utente autorevole restituito da Supabase. Token scaduti, firma non valida o mismatch
ricadono sul percorso sequenziale sicuro.

Con lo stesso harness di produzione, warm-up scartato e 20 campioni:

| Pagina | Fase 2 p75 | Fase 3 p75 | Delta |
| --- | ---: | ---: | ---: |
| Riepilogo | 392,7 ms | 311,5 ms | -20,7% |
| Azioni | 337,7 ms | 223,7 ms | -33,8% |
| Prenotazioni | 290,3 ms | 223,4 ms | -23,0% |
| Rifornimento | 294,3 ms | 210,1 ms | -28,6% |
| Spese | 407,0 ms | 322,5 ms | -20,8% |

Media semplice p75: da 344,4 ms a 258,2 ms (`-25,0%`). Rispetto alla baseline
iniziale passa da 454,8 ms a 258,2 ms (`-43,2%`). Il p95 migliora su tutte le pagine.
Nel run warm `claims` misura circa 2 ms p75 sulle route singole; `auth` e `roles`
restano entrambi visibili nei timing e nessuna API presenta `mw-auth`.

## Risultato fase 4 - waterfall Finance eliminata - 2026-08-21

La query `expenses` include ora l'azione sorgente tramite la FK
`expenses_source_action_id_fkey`, quindi i dettagli dei rifornimenti automatici
arrivano nello stesso round-trip di spese e prenotazioni. La spesa padre e la
relazione embedded sono entrambe filtrate con l'organizzazione autorizzata; prima
di restituire `details` vengono inoltre verificati in memoria tenant e ID della FK.
Il vecchio lookup sequenziale resta disponibile solo come fallback per database
non ancora migrati ed è comunque vincolato allo stesso `organization_id`.

Con lo stesso harness di produzione, warm-up scartato e 20 campioni:

| Metrica Spese | Fase 3 | Fase 4 | Delta |
| --- | ---: | ---: | ---: |
| p75 click-to-painted | 322,5 ms | 249,1 ms | -22,8% |

Nel run post la singola fase `db-bookings-expenses` misura 75,6 ms p50, 78,0 ms
p75 e 86,6 ms p95. Non compare alcuna fase legacy: tutti i 20 campioni hanno usato
la query unificata. La media semplice p75 sulle cinque pagine è 250,4 ms, contro
258,2 ms della fase 3 (`-3,0%`) e 454,8 ms della baseline iniziale (`-44,9%`).

## Risultato fase 5 - proxy auth/org sovrapposte - 2026-08-21

Il proxy avvia ora `getUser` autorevole e, solo dopo la verifica crittografica del
subject JWT, anticipa il lookup organizzazione. Il risultato speculativo viene usato
esclusivamente se il subject coincide con l'utente restituito da `getUser`; mismatch,
token revocato o claims non verificabili mantengono il percorso autorevole. Il lookup
`user_roles -> organizations` usa inoltre una sola relazione FK al posto di due query
sequenziali e rifiuta in memoria ID di membership/organizzazione discordanti.

Manifest, service worker e icone PWA sono stati esclusi dal matcher: nella build
finale non generano più chiamate auth. In navigazioni stabili, i log diagnostici
mostrano tipicamente un `wallMs` proxy nell'ordine di 75-110 ms, con `mw-auth` e
`mw-org` sovrapposti; prima le due fasi sequenziali producevano spesso circa
210-250 ms. Il beneficio riguarda soprattutto accessi diretti/cold e carico server.

Il run warm comparabile da 20 campioni non mostra invece un miglioramento materiale
del click-to-painted, perché Next.js esegue il proxy durante il prefetch precedente
al click:

| Pagina | Fase 4 p75 | Fase 5 p75 | Delta |
| --- | ---: | ---: | ---: |
| Riepilogo | 321,9 ms | 330,3 ms | +2,6% |
| Azioni | 227,7 ms | 227,9 ms | +0,1% |
| Prenotazioni | 232,4 ms | 227,4 ms | -2,2% |
| Rifornimento | 221,1 ms | 222,2 ms | +0,5% |
| Spese | 249,1 ms | 246,3 ms | -1,1% |

Media semplice p75: 250,4 ms -> 250,8 ms (`+0,2%`, rumore di misura). Il prossimo
intervento sul tempo percepito deve quindi agire sul percorso API dopo il click o
sulla cache client; i log hanno inoltre evidenziato che il prefetch automatico dei
link protetti va valutato con un A/B dedicato, non disabilitato senza misura.

## Cosa non copre questa fase

- Le mutazioni (PATCH azioni, POST prenotazioni, ecc.) non sono strumentate — sono
  un'altra fase del piano.
- Non c'è ancora RUM aggregato su utenti reali (Speed Insights). Le misure locali
  non sostituiscono LCP, INP, CLS e distribuzioni p75 osservate in produzione.

## Sicurezza

Gli header `Server-Timing` e le righe `[perf]` contengono solo nomi di fase e durate.
Non aggiungere mai a questi log id organizzazione, id utente, email o conteggi di righe
per tenant: sono leggibili dal client (header) o finiscono nei log aggregati (console).
