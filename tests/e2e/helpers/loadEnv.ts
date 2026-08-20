import * as fs from "node:fs";
import * as path from "node:path";

let loaded = false;

/**
 * Loads .env.local into process.env once per process. Playwright's test
 * runner (like Vitest) does not load it automatically the way `next dev`
 * does for the app server — every E2E helper that needs SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, E2E_USER_EMAIL, etc. must import this module.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();
