import { expect, type Page } from "@playwright/test";

/**
 * Offset in giorni, unico ad ogni chiamata (non solo ad ogni file), da usare
 * al posto di una costante fissa tipo `+410` per calcolare check-in/check-out
 * nei test. Un offset fisso è identico ogni volta che la suite gira nello
 * stesso giorno di calendario: se un run precedente lascia anche un solo
 * residuo (es. una run interrotta prima della pulizia), il run successivo
 * collide sulla stessa identica data, bloccato dal validatore
 * anti-sovrapposizione dell'app (successo il 2026-08-20, dopo aver rilanciato
 * la suite molte volte nello stesso giorno). `baseOffsetDays` sposta l'intero
 * range lontano da dati reali; la parte random lo rende diverso ad ogni run.
 */
export function uniqueFutureDayOffset(baseOffsetDays: number): number {
  return baseOffsetDays + (Date.now() % 500);
}

/** Come uniqueFutureDayOffset ma per date nel passato: usato per generare azioni "arretrate" di test senza collidere con dati reali recenti. */
export function uniquePastDayOffset(baseOffsetDays: number): number {
  return -(baseOffsetDays + (Date.now() % 500));
}

/** Trova la riga della tabella prenotazioni che contiene `tag` (tipicamente nella colonna Note). */
export function findBookingRow(page: Page, tag: string) {
  return page.locator("tr", { hasText: tag }).first();
}

/**
 * Elimina, se esiste, la prenotazione taggata `tag` sulla pagina /bookings.
 * Naviga sempre a /bookings prima di controllare.
 *
 * Passa sempre a "Tutte" prima del controllo di presenza: dal Task 8 il
 * filtro di default "Attive" è data-based (check_out >= oggi) e
 * nasconderebbe qualunque prenotazione con check_out nel passato (es. quelle
 * create con createPastBookingViaDrawer), facendo uscire questa funzione in
 * anticipo senza eliminare nulla. "Tutte" è un superset e non ha effetti
 * collaterali sulle prenotazioni future, quindi resta l'unica funzione di
 * cancellazione condivisa. `viewFilter` è stato client indipendente dal
 * fetch dei dati, quindi impostarlo subito (prima che la lista sia
 * caricata) è sicuro: si applica comunque a qualunque dato arrivi dopo.
 *
 * Il controllo di presenza usa un locator Playwright con retry incorporato
 * (`waitFor`), non un singolo `page.evaluate` subito dopo `goto`: la lista
 * si popola in modo asincrono dopo il mount (fetch client-side lanciata da
 * un effect), quindi `page.goto` che si risolve NON garantisce che i dati
 * siano già arrivati e renderizzati. Un controllo "istantaneo" può correre
 * prima che la fetch risolva, leggere la tabella ancora vuota/in caricamento
 * e concludere erroneamente che la prenotazione "non esiste" — pulizia
 * saltata in silenzio, nessun assert fallito, nessun errore nei log del
 * test. Bug reale verificato interrogando direttamente il DB del progetto
 * di test dopo run "verdi": righe rimaste in `bookings` nonostante i test
 * riportassero successo, tanto più probabile quanto più la tabella
 * `bookings` dell'account reale cresce (fetch più lenta, finestra di race
 * più ampia — proprio l'effetto degli stessi residui che questa funzione
 * dovrebbe ripulire).
 */
export async function deleteBookingByTag(page: Page, tag: string): Promise<void> {
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Tutte" }).click();
  const row = findBookingRow(page, tag);
  const present = await row
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch((err: unknown) => {
      // Solo un timeout ("la riga non è mai comparsa") significa "niente da
      // pulire". Qualunque altro errore (pagina/contesto crashato, frame
      // staccato, navigazione interrotta) va rilanciato: inghiottirlo qui
      // nasconderebbe un fallimento reale della pulizia dietro lo stesso
      // "non esiste" silenzioso che questa funzione doveva eliminare.
      if (err instanceof Error && err.name === "TimeoutError") return false;
      throw err;
    });
  if (!present) return;

  await row.getByRole("button", { name: "Elimina" }).click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminare la prenotazione?" });
  await confirmDialog.waitFor({ state: "visible" });
  await confirmDialog.getByRole("button", { name: "Elimina" }).click();
  await expect(row).toBeHidden();
}

/** Crea una prenotazione dal drawer "Nuova prenotazione" sulla pagina /bookings (deve essere già aperta o si apre qui). */
export async function createBookingViaDrawer(
  page: Page,
  params: { checkIn: string; checkOut: string; guests: string; channel: string; amount: string; note: string; guestReference?: string },
): Promise<void> {
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
  if (params.guestReference) {
    await page.locator("#booking-guest-reference").fill(params.guestReference);
  }
  await page.getByLabel("Check-in").fill(params.checkIn);
  await page.getByLabel("Check-out").fill(params.checkOut);
  await page.getByLabel("Ospiti").fill(params.guests);
  await page.locator("#booking-channel").fill(params.channel);
  await page.locator('input[name="total_amount"]').fill(params.amount);
  await page.getByLabel("Note").fill(params.note);
  await page.getByRole("button", { name: "Crea prenotazione" }).click();
  await expect(findBookingRow(page, params.note)).toBeVisible();
}

/**
 * Come createBookingViaDrawer, ma per prenotazioni con check_out nel
 * passato. Dal Task 8 il filtro di default "Attive" su /bookings è
 * data-based (check_out >= oggi): appena salvata, una prenotazione conclusa
 * sparirebbe subito dalla vista di default, facendo fallire l'asserzione di
 * visibilità finale di createBookingViaDrawer (che parte sempre da
 * "Attive" via il suo `page.goto("/bookings")` interno). Passiamo a "Tutte"
 * prima di aprire il drawer così la riga resta visibile per la verifica; è
 * uno stato client (React), non persistito, quindi resta attivo per il
 * resto della sessione di pagina corrente finché non si ricarica.
 */
export async function createPastBookingViaDrawer(
  page: Page,
  params: { checkIn: string; checkOut: string; guests: string; channel: string; amount: string; note: string },
): Promise<void> {
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Tutte" }).click();
  await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
  await page.getByLabel("Check-in").fill(params.checkIn);
  await page.getByLabel("Check-out").fill(params.checkOut);
  await page.getByLabel("Ospiti").fill(params.guests);
  await page.locator("#booking-channel").fill(params.channel);
  await page.locator('input[name="total_amount"]').fill(params.amount);
  await page.getByLabel("Note").fill(params.note);
  await page.getByRole("button", { name: "Crea prenotazione" }).click();
  await expect(findBookingRow(page, params.note)).toBeVisible();
}
