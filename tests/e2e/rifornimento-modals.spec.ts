import { expect, test } from "@playwright/test";
import {
  cleanupOwnerFlowFixture,
  createOwnerFlowFixture,
  getProductQuantityByName,
  getSupabase,
  type OwnerFlowFixture,
} from "./helpers";
import { resolveProductSchema } from "../../lib/products-schema";

test.describe("rifornimento kpi modals", () => {
  let fixture: OwnerFlowFixture;
  const consumableName = "Detersivo piatti E2E";

  test.beforeAll(async () => {
    fixture = await createOwnerFlowFixture();

    const supabase = getSupabase();

    // Mark onboarding complete directly so the test can go straight to the
    // app instead of walking through the onboarding wizard (already covered
    // by owner-flow.spec.ts).
    await supabase
      .from("organizations")
      .update({ settings: { onboarding_completed: true } })
      .eq("id", fixture.orgId);

    // Seed one status-managed consumable (no linen_role, not a linen
    // category/name keyword) alongside the linen products the fixture
    // already seeds, so both KPI-card modals have something to show.
    const schema = await resolveProductSchema(supabase);
    const record: Record<string, unknown> = {
      organization_id: fixture.orgId,
      name: consumableName,
      category: "Pulizia",
      unit: "pz",
      threshold: 1,
      max_qty: 0,
      linen_role: null,
      stock_status: "PIENO",
    };
    record[schema.quantityColumn] = 5;
    if (schema.idColumn === "sku") record.sku = `detersivo_e2e_${Date.now()}`;
    const { error } = await supabase.from("products").insert(record);
    if (error) throw new Error(`seed consumable: ${error.message}`);
  });

  test.afterAll(async () => {
    await cleanupOwnerFlowFixture(fixture);
  });

  test("consumabili: cambio stato dal modal si salva su Supabase", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(fixture.email);
    await page.locator("#password").fill(fixture.password);
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Accedi" }).click();
    await page.waitForURL(/\/($|onboarding$)/);

    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Rifornimento" })).toBeVisible();

    await page.getByText("Consumabili In Evidenza").click();
    await expect(page.getByRole("heading", { name: "Consumabili a Stati" })).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(consumableName) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "A metà" }).click();

    await expect
      .poll(
        async () => {
          const supabase = getSupabase();
          const { data } = await supabase
            .from("products")
            .select("stock_status")
            .eq("organization_id", fixture.orgId)
            .eq("name", consumableName)
            .maybeSingle();
          return data?.stock_status ?? null;
        },
        { message: "stock_status should become A_META in Supabase after clicking the button" },
      )
      .toBe("A_META");

    // UI reflects the change too: the button now reads as active/pressed.
    await expect(row.getByRole("button", { name: "A metà" })).toHaveClass(/bg-amber-100/);
  });

  test("biancheria: rifornimento dal modal aggiorna la quantità su Supabase", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(fixture.email);
    await page.locator("#password").fill(fixture.password);
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Accedi" }).click();
    await page.waitForURL(/\/($|onboarding$)/);

    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Rifornimento" })).toBeVisible();

    const productName = fixture.seededProductNames[0];
    const before = await getProductQuantityByName(fixture.orgId, productName);
    expect(before).not.toBeNull();

    await page.getByText("Biancheria In Evidenza").click();
    await expect(page.getByRole("heading", { name: "Biancheria a Quantità" })).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(productName) });
    await expect(row).toBeVisible();
    await row.getByPlaceholder("+qta").fill("3");
    await row.getByRole("button", { name: "Registra" }).click();

    await expect
      .poll(
        async () => getProductQuantityByName(fixture.orgId, productName),
        { message: "quantity should increase by 3 in Supabase after clicking Registra" },
      )
      .toBe((before ?? 0) + 3);

    // UI reflects the new quantity without needing a reload.
    await expect(row.getByText(String((before ?? 0) + 3)).first()).toBeVisible();
  });
});
