import { supabaseTest } from "./fixtures";
import "./loadEnv";

let cachedOrgId: string | null = null;

/**
 * Resolves the organization_id for the personal E2E test account
 * (E2E_USER_EMAIL), caching it for the process lifetime. Specs that run on
 * the personal account (via storageState, see setup/auth.setup.ts) use this
 * instead of creating a throwaway org — there is only one org to resolve.
 */
export async function resolveTestOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;

  const email = process.env.E2E_USER_EMAIL;
  if (!email) {
    throw new Error(
      "E2E_USER_EMAIL mancante in .env.local — necessaria per risolvere l'organizzazione dell'account di test personale.",
    );
  }

  const supabase = supabaseTest();
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw new Error(`resolveTestOrgId: ${usersError.message}`);

  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`resolveTestOrgId: nessun utente Supabase con email ${email}`);

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (roleError) throw new Error(`resolveTestOrgId: ${roleError.message}`);
  if (!role?.organization_id) throw new Error(`resolveTestOrgId: nessuna organizzazione per l'utente ${email}`);

  cachedOrgId = String(role.organization_id);
  return cachedOrgId;
}

/** Prefix for every piece of test data an authenticated-account spec creates, e.g. `e2eTag("finance")` -> "E2E-finance-1734500000000". Identifiable and safe to bulk-find/delete. */
export function e2eTag(specName: string): string {
  return `E2E-${specName}-${Date.now()}`;
}
