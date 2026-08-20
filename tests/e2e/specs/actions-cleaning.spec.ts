import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";
import { createBookingViaDrawer, deleteBookingByTag } from "../helpers/bookings";

test.describe("actions & cleaning", () => {
  test("completes a PULIZIA action through the modal and logs a maintenance note @smoke", async ({ page }) => {
    const tag = e2eTag("actions-cleaning");
    // Checkout lontano nel futuro e quindi unico: evita di dover distinguere
    // la nostra azione PULIZIA da quelle reali già presenti nell'account.
    const checkIn = addDays(today(), 410);
    const checkOut = addDays(today(), 412);

    await createBookingViaDrawer(page, {
      checkIn,
      checkOut,
      guests: "2",
      channel: "airbnb",
      amount: "120.00",
      note: tag,
    });

    // Le azioni (PULIZIA/BIANCHERIA) non vengono generate in automatico
    // dalla sola creazione della prenotazione: serve una resync esplicita,
    // come già fa tests/e2e/specs/fixtures/owner-flow.spec.ts.
    const resyncResult = await page.evaluate(async () => {
      const r = await fetch("/api/bookings/resync", { method: "POST" });
      return { ok: r.ok, status: r.status };
    });
    expect(resyncResult.ok, `resync fallita con status ${resyncResult.status}`).toBe(true);

    try {
      await page.goto("/actions");
      await expect(page.getByRole("heading", { name: "Azioni", exact: true })).toBeVisible();

      // Filtra al solo giorno del checkout, dove è stata generata la PULIZIA,
      // così l'azione è isolabile senza ambiguità dalle azioni reali.
      await page.getByRole("button", { name: "Periodo personalizzato" }).click();
      await page.locator("#actions-from-date").fill(checkOut);
      await page.locator("#actions-to-date").fill(checkOut);
      await page.getByRole("button", { name: "Applica periodo" }).click();

      await page.getByRole("button", { name: /Pulizia/ }).click();
      await expect(page.getByRole("heading", { name: "Check pulizie" })).toBeVisible();

      await page.getByRole("button", { name: "Fatta da me" }).click();

      // La textarea di manutenzione non è avvolta da un <label> (verificato
      // con un dump diretto del DOM): niente getByLabel, si passa dal
      // placeholder, univoco in pagina.
      const maintenanceNote = page.getByPlaceholder(/perdita sotto il lavandino/);
      await clearRealistically(maintenanceNote);
      await expectKeepsFocus(maintenanceNote, () => typeRealistically(maintenanceNote, tag));
      await expect(maintenanceNote).toHaveValue(tag);

      await page.getByRole("button", { name: "Salva check pulizie" }).click();
      await expect(page.getByText("Check pulizie salvato!")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Check pulizie" })).toBeHidden();

      // Le azioni completate sono nascoste di default dalla lista — la
      // PULIZIA appena salvata non sparisce, semplicemente non è più
      // visibile finché non si spunta "Mostra completate".
      await page.getByRole("checkbox", { name: "Mostra completate" }).check();
      await expect(page.getByText("Completata").first()).toBeVisible();

      // La segnalazione manutenzione compilata deve aver creato una nuova
      // azione MANUTENZIONE visibile nello stesso giorno filtrato.
      await expect(page.getByRole("button", { name: new RegExp(`Manutenzione.*${tag}`) })).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });
});
