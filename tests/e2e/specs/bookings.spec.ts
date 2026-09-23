import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";
import {
  createBookingViaDrawer,
  createPastBookingViaDrawer,
  deleteBookingByTag,
  findBookingRow,
  uniqueFutureDayOffset,
  uniquePastDayOffset,
} from "../helpers/bookings";

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

  test("il riferimento è visibile in lista ed è ricercabile", async ({ page }) => {
    const tag = e2eTag("bookings-reference");
    const offset = uniqueFutureDayOffset(1800);
    const reference = `Ospite ${tag}`;
    try {
      await createBookingViaDrawer(page, {
        checkIn: addDays(base, offset),
        checkOut: addDays(base, offset + 2),
        guests: "2",
        channel: "airbnb",
        amount: "150.00",
        note: tag,
        guestReference: reference,
      });

      const row = findBookingRow(page, tag);
      await expect(row.getByText(reference)).toBeVisible();

      await page.getByRole("searchbox", { name: "Cerca prenotazione" }).fill(reference);
      await expect(findBookingRow(page, tag)).toBeVisible();

      await page.getByRole("searchbox", { name: "Cerca prenotazione" }).fill("nessuna corrispondenza xyz");
      await expect(page.getByText("Nessuna prenotazione corrisponde al filtro o alla ricerca attuali.")).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  test("il filtro 'Concluse' nasconde una prenotazione futura, 'Tutte' la mostra di nuovo", async ({ page }) => {
    const tag = e2eTag("bookings-filter");
    const offset = uniqueFutureDayOffset(2100);
    try {
      await createBookingViaDrawer(page, {
        checkIn: addDays(base, offset),
        checkOut: addDays(base, offset + 2),
        guests: "2",
        channel: "airbnb",
        amount: "120.00",
        note: tag,
      });

      await expect(findBookingRow(page, tag)).toBeVisible();

      await page.getByRole("button", { name: "Concluse" }).click();
      await expect(page.getByText(tag)).toHaveCount(0);

      await page.getByRole("button", { name: "Tutte" }).click();
      await expect(findBookingRow(page, tag)).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });

  // Task 8 ha reso "Attive" (il filtro di default su /bookings) basato sulla
  // data (check_out >= oggi): una prenotazione il cui soggiorno è concluso ma
  // la cui pulizia è ancora DA_FARE sparisce quindi dalla vista di default.
  // Questo è sicuro solo perché la card "Arretrate" della dashboard (Task
  // 1-4 dello stesso piano) sorveglia esattamente questo caso a prescindere
  // dal filtro di /bookings. Verifichiamo l'invariante end-to-end: la
  // prenotazione passata è nascosta in "Attive", visibile in "Tutte", e
  // conteggiata in "Arretrate" sulla dashboard.
  test("una prenotazione passata è nascosta in 'Attive' ma resta visibile in 'Tutte' e conteggiata in 'Arretrate'", async ({
    page,
  }) => {
    const tag = e2eTag("bookings-past-overdue");
    const offset = uniquePastDayOffset(3400);
    const checkIn = addDays(today(), offset);
    const checkOut = addDays(today(), offset + 2);

    try {
      // check_out è nel passato: createPastBookingViaDrawer passa a "Tutte"
      // prima di creare, altrimenti la sua stessa asserzione di visibilità
      // fallirebbe contro il filtro di default "Attive" (data-based).
      await createPastBookingViaDrawer(page, {
        checkIn,
        checkOut,
        guests: "2",
        channel: "airbnb",
        amount: "95.00",
        note: tag,
      });

      const resyncResult = await page.evaluate(async () => {
        const response = await fetch("/api/bookings/resync", { method: "POST" });
        return { ok: response.ok, status: response.status };
      });
      expect(resyncResult.ok, `resync fallita con status ${resyncResult.status}`).toBe(true);

      // Assente dalla vista di default "Attive" (data-based, Task 8): la
      // navigazione a /bookings riparte sempre dal filtro di default.
      await page.goto("/bookings");
      await expect(page.getByText(tag)).toHaveCount(0);

      // Presente sotto "Tutte": non è persa, solo filtrata.
      await page.getByRole("button", { name: "Tutte" }).click();
      await expect(findBookingRow(page, tag)).toBeVisible();

      // Conteggiata dalla card "Arretrate" della dashboard, a prescindere
      // dal filtro di /bookings.
      await page.goto("/");
      const arretrateCard = page.getByRole("button", { name: /Arretrate/ });
      await expect(arretrateCard).toBeVisible();
      const arretrateValue = await arretrateCard.locator("p").filter({ hasText: /^\d+$/ }).first().innerText();
      expect(Number(arretrateValue)).toBeGreaterThan(0);
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
