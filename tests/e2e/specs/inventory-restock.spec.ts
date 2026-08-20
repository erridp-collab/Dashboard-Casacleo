import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";

// Nota di scope: questa spec gira sull'account personale, con i prodotti
// REALI dell'utente — non una fixture usa-e-getta. Per non lasciare i dati
// veri alterati da un run automatico, qui si verifica solo l'apertura dei
// modali e la meccanica di interazione (digitazione realistica), senza
// inviare mutazioni permanenti (nessun click su "Registra" o sui bottoni di
// stato). La copertura con mutazioni reali e verifica su Supabase esiste
// già su dati usa-e-getta in specs/fixtures/rifornimento-modals.spec.ts.
test.describe("inventory & restock", () => {
  test("opens the consumables and linen KPI modals @smoke", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Rifornimento" })).toBeVisible();

    await page.getByRole("button", { name: /Consumabili In Evidenza/ }).click();
    await expect(page.getByRole("dialog", { name: "Consumabili a Stati" })).toBeVisible();
    await page.getByRole("button", { name: "Chiudi" }).click();
    await expect(page.getByRole("dialog", { name: "Consumabili a Stati" })).toBeHidden();

    await page.getByRole("button", { name: /Biancheria In Evidenza/ }).click();
    await expect(page.getByRole("dialog", { name: "Biancheria a Quantità" })).toBeVisible();
    await page.getByRole("button", { name: "Chiudi" }).click();
    await expect(page.getByRole("dialog", { name: "Biancheria a Quantità" })).toBeHidden();
  });

  test("keeps keystrokes when typing a linen restock quantity (no submit)", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Biancheria In Evidenza/ }).click();
    const dialog = page.getByRole("dialog", { name: "Biancheria a Quantità" });
    await expect(dialog).toBeVisible();

    const firstQtyInput = dialog.getByPlaceholder("+qta").first();
    const hasRow = (await firstQtyInput.count()) > 0;
    test.skip(!hasRow, "nessuna biancheria monitorata sull'account di test in questo momento");

    await clearRealistically(firstQtyInput);
    await expectKeepsFocus(firstQtyInput, () => typeRealistically(firstQtyInput, "3"));
    await expect(firstQtyInput).toHaveValue("3");

    // Chiude senza cliccare "Registra": nessuna mutazione permanente sui
    // dati reali dell'account.
    await page.getByRole("button", { name: "Chiudi" }).click();
  });
});
