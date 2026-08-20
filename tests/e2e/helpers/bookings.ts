import { expect, type Page } from "@playwright/test";

/** Trova la riga della tabella prenotazioni che contiene `tag` (tipicamente nella colonna Note). */
export function findBookingRow(page: Page, tag: string) {
  return page.locator("tr", { hasText: tag }).first();
}

/**
 * Elimina, se esiste, la prenotazione taggata `tag` sulla pagina /bookings.
 * Naviga sempre a /bookings prima di controllare — un controllo di
 * visibilità immediato su una pagina appena caricata (`isVisible()` senza
 * attesa) può dare un falso negativo mentre la tabella sta ancora
 * caricando, saltando la pulizia (successo il 2026-08-20 debuggando
 * actions-cleaning.spec.ts). `page.evaluate` dopo `goto` aspetta invece che
 * la navigazione sia completa.
 */
export async function deleteBookingByTag(page: Page, tag: string): Promise<void> {
  await page.goto("/bookings");
  const present = await page.evaluate((t) => document.body.innerText.includes(t), tag);
  if (!present) return;

  const row = findBookingRow(page, tag);
  await row.getByRole("button", { name: "Elimina" }).click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminare la prenotazione?" });
  await confirmDialog.waitFor({ state: "visible" });
  await confirmDialog.getByRole("button", { name: "Elimina" }).click();
  await expect(row).toBeHidden();
}

/** Crea una prenotazione dal drawer "Nuova prenotazione" sulla pagina /bookings (deve essere già aperta o si apre qui). */
export async function createBookingViaDrawer(
  page: Page,
  params: { checkIn: string; checkOut: string; guests: string; channel: string; amount: string; note: string },
): Promise<void> {
  await page.goto("/bookings");
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
