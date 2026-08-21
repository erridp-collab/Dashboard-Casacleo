import { test as setup } from "@playwright/test";
import * as path from "node:path";
import "../helpers/loadEnv";

const authFile = path.join(__dirname, "../../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD mancanti in .env.local — servono le credenziali " +
        "dell'account personale di test per gli E2E autenticati (vedi Task 7 del piano).",
    );
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.waitForURL(/\/($|onboarding$)/);

  await page.context().storageState({ path: authFile });
});
