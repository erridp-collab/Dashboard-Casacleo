import { expect, test, type Page } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";

async function findBookingRow(page: Page, tag: string) {
  return page.locator("tr", { hasText: tag }).first();
}

async function deleteBookingByTag(page: Page, tag: string): Promise<void> {
  await page.goto("/bookings");
  const present = await page.evaluate((t) => document.body.innerText.includes(t), tag);
  if (!present) return;

  const row = await findBookingRow(page, tag);
  await row.getByRole("button", { name: "Elimina" }).click();
  const confirmDialog = page.getByRole("alertdialog", { name: "Eliminare la prenotazione?" });
  await confirmDialog.waitFor({ state: "visible" });
  await confirmDialog.getByRole("button", { name: "Elimina" }).click();
  await expect(row).toBeHidden();
}

test.describe("bookings CRUD", () => {
  // Date relative a oggi, ben distanziate tra loro e nel futuro: prenotazioni
  // con date fisse nel passato o sovrapposte tra run diverse vengono
  // rifiutate dal validatore anti-sovrapposizione dell'app (scoperto il
  // 2026-08-20 debuggando questa stessa spec).
  const base = today();

  test("creates a booking through the drawer and shows it in the list @smoke", async ({ page }) => {
    const tag = e2eTag("bookings-create");
    const checkIn = addDays(base, 200);
    const checkOut = addDays(base, 202);
    try {
      await page.goto("/bookings");
      await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
      await expect(page.getByRole("dialog", { name: "Nuova prenotazione" })).toBeVisible();

      await page.getByLabel("Check-in").fill(checkIn);
      await page.getByLabel("Check-out").fill(checkOut);
      await page.getByLabel("Ospiti").fill("3");
      await page.locator("#booking-channel").fill("booking.com");
      await page.locator('input[name="total_amount"]').fill("199.00");
      await page.getByLabel("Note").fill(tag);
      await page.getByRole("button", { name: "Crea prenotazione" }).click();

      const row = await findBookingRow(page, tag);
      await expect(row).toBeVisible();
      await expect(row.getByText("BOOKING.COM")).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  test("edits an existing booking's guest count without losing keystrokes", async ({ page }) => {
    const tag = e2eTag("bookings-edit");
    const checkIn = addDays(base, 210);
    const checkOut = addDays(base, 211);
    try {
      await page.goto("/bookings");
      await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
      await page.getByLabel("Check-in").fill(checkIn);
      await page.getByLabel("Check-out").fill(checkOut);
      await page.getByLabel("Ospiti").fill("2");
      await page.locator("#booking-channel").fill("airbnb");
      await page.locator('input[name="total_amount"]').fill("80.00");
      await page.getByLabel("Note").fill(tag);
      await page.getByRole("button", { name: "Crea prenotazione" }).click();

      const row = await findBookingRow(page, tag);
      await expect(row).toBeVisible();

      // Una volta cliccato "Modifica", la riga esce dalla modalità di sola
      // lettura e la nota (il nostro tag) diventa il *value* di un input,
      // non più testo visibile: il locator `row` (hasText: tag) smetterebbe
      // di risolvere qualunque cosa. Da qui in poi si usano locator a
      // livello pagina — solo una riga alla volta può essere in modifica,
      // quindi restano univoci.
      await row.getByRole("button", { name: "Modifica" }).click();
      const guestsInput = page.getByLabel("Ospiti");
      await clearRealistically(guestsInput);
      await expectKeepsFocus(guestsInput, () => typeRealistically(guestsInput, "4"));
      await expect(guestsInput).toHaveValue("4");

      await page.getByRole("button", { name: "Salva" }).click();
      const savedRow = await findBookingRow(page, tag);
      await expect(savedRow.getByText("4", { exact: true })).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  test("deletes a booking via the confirm dialog", async ({ page }) => {
    const tag = e2eTag("bookings-delete");
    const checkIn = addDays(base, 220);
    const checkOut = addDays(base, 221);
    await page.goto("/bookings");
    await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
    await page.getByLabel("Check-in").fill(checkIn);
    await page.getByLabel("Check-out").fill(checkOut);
    await page.getByLabel("Ospiti").fill("2");
    await page.locator("#booking-channel").fill("airbnb");
    await page.locator('input[name="total_amount"]').fill("60.00");
    await page.getByLabel("Note").fill(tag);
    await page.getByRole("button", { name: "Crea prenotazione" }).click();

    const row = await findBookingRow(page, tag);
    await expect(row).toBeVisible();

    await deleteBookingByTag(page, tag);
    const stillPresent = await page.evaluate((t) => document.body.innerText.includes(t), tag);
    expect(stillPresent).toBe(false);
  });
});
