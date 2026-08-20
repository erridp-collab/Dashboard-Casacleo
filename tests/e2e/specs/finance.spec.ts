import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

test.describe("finance", () => {
  test("adds a manual expense through the drawer and deletes it @smoke", async ({ page }) => {
    const tag = e2eTag("finance-expense");
    await page.goto("/finance");
    await expect(page.getByRole("heading", { name: "Spese", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Aggiungi spesa" }).click();
    await page.getByLabel("Data").fill(today());

    const amountInput = page.getByLabel("Importo (EUR)");
    await clearRealistically(amountInput);
    await expectKeepsFocus(amountInput, () => typeRealistically(amountInput, "45,50"));
    await expect(amountInput).toHaveValue("45,50");

    await page.getByLabel("Categoria").selectOption({ label: "Manutenzione" });
    await page.getByLabel("Descrizione").fill(tag);
    await page.getByRole("button", { name: "Salva spesa" }).click();

    const descriptionText = page.getByText(tag, { exact: true });
    await expect(descriptionText).toBeVisible();
    await expect(page.getByText("- 45,50 €")).toBeVisible();

    // I "Movimenti" non sono una <table> ma una lista di card: il modo
    // affidabile di trovare il bottone Elimina della NOSTRA riga (potrebbero
    // essercene altre già presenti nel mese) è il primo "Elimina" che segue
    // la descrizione nell'ordine del documento, non un contenitore <tr>/<li>
    // che qui non esiste.
    const deleteButton = descriptionText.locator("xpath=following::button[@aria-label='Elimina'][1]");
    await deleteButton.click();
    const confirmDialog = page.getByRole("alertdialog", { name: "Eliminare la spesa?" });
    await confirmDialog.waitFor({ state: "visible" });
    await confirmDialog.getByRole("button", { name: "Elimina" }).click();
    await expect(descriptionText).toBeHidden();
  });

  test("attributes a cross-month booking's revenue only to the check-in month", async ({ page }) => {
    const tag = e2eTag("finance-crossmonth");

    // Costruisce un soggiorno che attraversa davvero un cambio mese,
    // indipendentemente da quando gira il test: l'ultimo giorno di un mese
    // abbastanza lontano nel futuro da non collidere con altri dati.
    const anchor = addDays(today(), 400);
    const [ay, am] = anchor.split("-").map(Number);
    const lastDayOfMonth = new Date(ay, am, 0); // giorno 0 del mese successivo = ultimo giorno del mese corrente
    const checkInDate = lastDayOfMonth;
    const checkOutDate = new Date(ay, am, 4); // 4 giorni dentro il mese successivo
    const checkIn = ymd(checkInDate);
    const checkOut = ymd(checkOutDate);
    const checkInMonth = ym(checkInDate);
    const checkOutMonth = ym(checkOutDate);
    expect(checkInMonth).not.toBe(checkOutMonth);

    await page.goto("/bookings");
    await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
    await page.getByLabel("Check-in").fill(checkIn);
    await page.getByLabel("Check-out").fill(checkOut);
    await page.getByLabel("Ospiti").fill("2");
    await page.locator("#booking-channel").fill("airbnb");
    await page.locator('input[name="total_amount"]').fill("500.00");
    await page.getByLabel("Note").fill(tag);
    await page.getByRole("button", { name: "Crea prenotazione" }).click();
    await expect(page.locator("tr", { hasText: tag })).toBeVisible();

    try {
      const checkInMonthResp = await page.evaluate(
        async (month) => (await fetch(`/api/finance?month=${month}`)).json(),
        checkInMonth,
      );
      const checkOutMonthResp = await page.evaluate(
        async (month) => (await fetch(`/api/finance?month=${month}`)).json(),
        checkOutMonth,
      );

      const entryInCheckInMonth = checkInMonthResp.entries?.find((e: { description?: string }) =>
        e.description?.includes(checkIn),
      );
      const entryInCheckOutMonth = checkOutMonthResp.entries?.find((e: { description?: string }) =>
        e.description?.includes(checkIn),
      );

      expect(entryInCheckInMonth, "l'incasso deve comparire nel mese del check-in").toBeTruthy();
      expect(entryInCheckInMonth.amount).toBe(500);
      expect(entryInCheckOutMonth, "l'incasso NON deve comparire nel mese del check-out").toBeUndefined();
    } finally {
      const row = page.locator("tr", { hasText: tag }).first();
      await row.getByRole("button", { name: "Elimina" }).click();
      const confirmDialog = page.getByRole("alertdialog", { name: "Eliminare la prenotazione?" });
      await confirmDialog.waitFor({ state: "visible" });
      await confirmDialog.getByRole("button", { name: "Elimina" }).click();
      await expect(row).toBeHidden();
    }
  });
});
