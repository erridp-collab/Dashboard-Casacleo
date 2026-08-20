import { expect, test } from "@playwright/test";
import {
  cleanupOwnerFlowFixture,
  createOwnerFlowFixture,
  getSupabase,
  type OwnerFlowFixture,
} from "./helpers";

test.describe("drawer keystroke handling", () => {
  let fixture: OwnerFlowFixture;

  test.beforeAll(async () => {
    fixture = await createOwnerFlowFixture();

    // Mark onboarding complete directly so the test can go straight to the
    // app instead of walking through the onboarding wizard (already covered
    // by owner-flow.spec.ts).
    await getSupabase()
      .from("organizations")
      .update({ settings: { onboarding_completed: true } })
      .eq("id", fixture.orgId);
  });

  test.afterAll(async () => {
    await cleanupOwnerFlowFixture(fixture);
  });

  test("keeps keystrokes typed into a drawer field instead of losing focus on every re-render", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(fixture.email);
    await page.locator("#password").fill(fixture.password);
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Accedi" }).click();
    await page.waitForURL("**/");

    await page.goto("/bookings");
    await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
    await expect(page.getByRole("dialog", { name: "Nuova prenotazione" })).toBeVisible();

    // Digitazione realistica, tasto per tasto, con una piccola pausa fra un
    // tasto e l'altro (come un utente vero, non un fill() istantaneo): ogni
    // onChange aggiorna lo stato del form, che fa ri-renderizzare il
    // componente padre del Drawer. Se il Drawer ruba il focus ad ogni
    // re-render, il secondo tasto va perso.
    const guestsInput = page.getByLabel("Ospiti");
    await guestsInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(200);
    await page.keyboard.press("Digit2");
    await page.waitForTimeout(200);

    await expect(guestsInput).toHaveValue("12");

    // Stesso comportamento atteso su un campo di testo qualunque del drawer.
    const channelInput = page.locator("#booking-channel");
    await channelInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    await page.keyboard.type("airbnb", { delay: 200 });

    await expect(channelInput).toHaveValue("airbnb");
  });
});
