import { expect, test } from "@playwright/test";
import {
  today,
  addDays,
  cleanupOwnerFlowFixture,
  createOwnerFlowFixture,
  createShoppingAction,
  findBookingByNotes,
  findExpenseForAction,
  getOnboardingComplete,
  getProductQuantityByName,
  listBookingActionTypes,
  type OwnerFlowFixture,
} from "./helpers";

test.describe("owner flow", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: OwnerFlowFixture;

  test.beforeAll(async () => {
    fixture = await createOwnerFlowFixture();
  });

  test.afterAll(async () => {
    await cleanupOwnerFlowFixture(fixture);
  });

  test("completes onboarding and validates downstream booking, action, inventory, and finance flows", async ({
    page,
  }) => {
    const checkIn = today();
    const checkOut = addDays(checkIn, 2);
    const bookingAmount = "345.00";
    const bookingNote = `E2E booking ${Date.now()}`;

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();

    await page.locator("#email").fill(fixture.email);
    await page.locator("#password").fill(fixture.password);
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Accedi" }).click();

    await page.waitForURL(/\/($|onboarding$)/);
    if (!page.url().endsWith("/onboarding")) {
      await page.goto("/onboarding");
    }
    await expect(page.getByRole("heading", { name: "Configura il tuo workspace" })).toBeVisible();

    await page.getByLabel("Nome attività").fill(fixture.workspaceName);
    await page.getByLabel("Nome referente").fill("Owner Flow QA");
    await page.getByRole("button", { name: "Completa onboarding" }).click();

    await page.waitForURL("**/");
    await expect(page.getByRole("heading", { name: "Riepilogo" })).toBeVisible();
    await expect
      .poll(async () => getOnboardingComplete(fixture.orgId), {
        message: "onboarding should be persisted on the organization settings",
      })
      .toBe(true);

    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "Prenotazioni", exact: true })).toBeVisible();

    // Il form "Nuova prenotazione" vive in un drawer, chiuso di default
    // (IMPLEMENTATION_PLAN_UI_UX.md, sezione 6): va aperto esplicitamente.
    await page.getByRole("button", { name: "Nuova prenotazione" }).first().click();
    await expect(page.getByRole("dialog", { name: "Nuova prenotazione" })).toBeVisible();

    await page.getByLabel("Check-in").fill(checkIn);
    await page.getByLabel("Check-out").fill(checkOut);
    await page.getByLabel("Ospiti").fill("2");
    await page.getByLabel("Canale").fill("airbnb");
    await page.locator('input[name="total_amount"]').fill(bookingAmount);
    await page.getByLabel("Note").fill(bookingNote);
    await page.getByRole("button", { name: "Crea prenotazione" }).click();

    await expect
      .poll(async () => findBookingByNotes(fixture.orgId, bookingNote), {
        message: "booking should be written in the database",
      })
      .not.toBeNull();

    const resyncResult = await page.evaluate(async () => {
      const response = await fetch("/api/bookings/resync", { method: "POST" });
      return { ok: response.ok, status: response.status };
    });
    expect(resyncResult.ok, `manual resync failed with status ${resyncResult.status}`).toBe(true);

    await expect
      .poll(async () => {
        const currentBooking = await findBookingByNotes(fixture.orgId, bookingNote);
        if (!currentBooking) return [];
        return listBookingActionTypes(fixture.orgId, currentBooking.id);
      }, {
        message: "managed actions should be generated for the new booking",
      })
      .toEqual(expect.arrayContaining(["PULIZIA", "BIANCHERIA"]));

    await page.goto("/actions");
    await expect(page.getByRole("heading", { name: "Azioni", exact: true })).toBeVisible();

    await page.getByRole("button", { name: /BIANCHERIA/i }).click();
    await expect(page.getByRole("heading", { name: "Cambio biancheria" })).toBeVisible();
    await expect(page.getByLabel("Set letto estivo")).toHaveValue("1");
    await expect(page.getByLabel("Asciugamani bidet")).toHaveValue("2");
    await expect(page.getByLabel("Asciugamani doccia")).toHaveValue("2");
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByRole("heading", { name: "Cambio biancheria" })).toBeHidden();

    await expect
      .poll(async () => getProductQuantityByName(fixture.orgId, "Set letto estivo"), {
        message: "linen completion should decrement the seeded set stock",
      })
      .toBe(9);
    await expect
      .poll(async () => getProductQuantityByName(fixture.orgId, "Asciugamani bidet"))
      .toBe(8);
    await expect
      .poll(async () => getProductQuantityByName(fixture.orgId, "Asciugamani doccia"))
      .toBe(8);

    const shoppingActionId = await createShoppingAction(fixture.orgId);
    await page.reload();

    await expect(page.getByRole("button", { name: /SPESA/i })).toBeVisible();
    await page.getByRole("button", { name: /SPESA/i }).click();
    await expect(page.getByRole("heading", { name: "Registra spesa" })).toBeVisible();
    await page.getByLabel(/Importo speso/i).fill("34.50");
    await page.getByRole("button", { name: "Segna come fatto" }).click();

    await expect
      .poll(async () => findExpenseForAction(fixture.orgId, shoppingActionId), {
        message: "completing the SPESA action should create a finance expense",
      })
      .toEqual({
        amount: 34.5,
        category: "Rifornimento",
        description: "Rifornimento",
      });

    await page.goto("/finance");
    await expect(page.getByRole("heading", { name: "Spese", exact: true })).toBeVisible();
    await expect(page.getByText(`Booking ${checkIn} -> ${checkOut} (airbnb)`)).toBeVisible();
    await expect(page.getByText("+ EUR 345.00")).toBeVisible();
    await expect(page.locator("main").getByText("Rifornimento", { exact: true })).toBeVisible();
    await expect(page.getByText("- EUR 34.50")).toBeVisible();
  });
});
