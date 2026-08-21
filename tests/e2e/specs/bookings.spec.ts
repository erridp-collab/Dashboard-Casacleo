import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";
import { createBookingViaDrawer, deleteBookingByTag, findBookingRow, uniqueFutureDayOffset } from "../helpers/bookings";

test.describe("bookings CRUD", () => {
  // Date relative a oggi e "jitterizzate" per run (uniqueFutureDayOffset):
  // un offset fisso collide con eventuali residui di run precedenti nello
  // stesso giorno di calendario, rifiutato dal validatore anti-sovrapposizione
  // dell'app (scoperto il 2026-08-20 rilanciando la suite molte volte).
  const base = today();

  test("creates a booking through the drawer and shows it in the list @smoke", async ({ page }) => {
    const tag = e2eTag("bookings-create");
    const offset = uniqueFutureDayOffset(200);
    try {
      await createBookingViaDrawer(page, {
        checkIn: addDays(base, offset),
        checkOut: addDays(base, offset + 2),
        guests: "3",
        channel: "booking.com",
        amount: "199.00",
        note: tag,
      });
      const row = findBookingRow(page, tag);
      await expect(row.getByText("BOOKING.COM")).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  test("edits an existing booking's guest count without losing keystrokes", async ({ page }) => {
    const tag = e2eTag("bookings-edit");
    const offset = uniqueFutureDayOffset(600);
    try {
      await createBookingViaDrawer(page, {
        checkIn: addDays(base, offset),
        checkOut: addDays(base, offset + 1),
        guests: "2",
        channel: "airbnb",
        amount: "80.00",
        note: tag,
      });
      const row = findBookingRow(page, tag);

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
      const savedRow = findBookingRow(page, tag);
      await expect(savedRow.getByText("4", { exact: true })).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  test("deletes a booking via the confirm dialog", async ({ page }) => {
    const tag = e2eTag("bookings-delete");
    const offset = uniqueFutureDayOffset(1200);
    await createBookingViaDrawer(page, {
      checkIn: addDays(base, offset),
      checkOut: addDays(base, offset + 1),
      guests: "2",
      channel: "airbnb",
      amount: "60.00",
      note: tag,
    });

    await deleteBookingByTag(page, tag);
    const stillPresent = await page.evaluate((t) => document.body.innerText.includes(t), tag);
    expect(stillPresent).toBe(false);
  });
});
