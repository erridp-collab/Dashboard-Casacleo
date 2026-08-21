import { expect, test } from "@playwright/test";
import { clearRealistically, expectKeepsFocus, typeRealistically } from "../helpers/interactions";

test.describe("drawer keystroke handling", () => {
  test("keeps keystrokes typed into a drawer field instead of losing focus on every re-render @smoke", async ({ page }) => {
    await page.goto("/bookings");
    await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
    await expect(page.getByRole("dialog", { name: "Nuova prenotazione" })).toBeVisible();

    const guestsInput = page.getByLabel("Ospiti");
    await clearRealistically(guestsInput);
    await expectKeepsFocus(guestsInput, () => typeRealistically(guestsInput, "12"));
    await expect(guestsInput).toHaveValue("12");

    const channelInput = page.locator("#booking-channel");
    await clearRealistically(channelInput);
    await expectKeepsFocus(channelInput, () => typeRealistically(channelInput, "airbnb"));
    await expect(channelInput).toHaveValue("airbnb");

    // Chiude senza inviare: questo test verifica solo la meccanica di
    // digitazione del Drawer, non crea nessuna prenotazione — nessun
    // cleanup dati necessario.
    await page.getByRole("button", { name: "Chiudi" }).click();
  });
});
