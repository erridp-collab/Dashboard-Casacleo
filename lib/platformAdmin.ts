import "server-only";
import { cookies } from "next/headers";
import { readSessionTokens, verifySessionTokens, writeSessionCookies } from "@/lib/supabaseAuth";

export type PlatformAdminContext = {
  userId: string;
  email: string | null;
};

export class PlatformUnauthorizedError extends Error {}
export class PlatformForbiddenError extends Error {}

export function isPlatformAdminClaims(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object" || Array.isArray(appMetadata)) {
    return false;
  }

  return (appMetadata as Record<string, unknown>).is_platform_admin === true;
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const cookieStore = await cookies();
  const tokens = readSessionTokens(cookieStore);
  const verified = await verifySessionTokens(tokens);

  if (!verified.user) {
    throw new PlatformUnauthorizedError("Unauthorized");
  }

  if (verified.refreshed && verified.session) {
    writeSessionCookies(cookieStore, verified.session);
  }

  if (!isPlatformAdminClaims(verified.user.app_metadata)) {
    throw new PlatformForbiddenError("Forbidden");
  }

  return {
    userId: verified.user.id,
    email: verified.user.email ?? null,
  };
}
