import "server-only";
import { createClient, type Session, type User } from "@supabase/supabase-js";

export const AUTH_ACCESS_COOKIE = "sb-access-token";
export const AUTH_REFRESH_COOKIE = "sb-refresh-token";
export const ACTIVE_ORG_COOKIE = "active-organization-id";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CookieWriter = {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    },
  ): void;
};

type CookieRemover = {
  delete(name: string): void;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string | null;
};

export type VerifiedSession = {
  user: User | null;
  session: Session | null;
  refreshed: boolean;
};

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function supabaseAuthClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error("Missing Supabase auth environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function readSessionTokens(cookiesStore: CookieReader): SessionTokens | null {
  const accessToken = cookiesStore.get(AUTH_ACCESS_COOKIE)?.value ?? "";
  const refreshToken = cookiesStore.get(AUTH_REFRESH_COOKIE)?.value ?? "";

  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: refreshToken || null,
  };
}

export function readActiveOrganizationId(cookiesStore: CookieReader): string | null {
  const value = cookiesStore.get(ACTIVE_ORG_COOKIE)?.value ?? "";
  return value || null;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function writeSessionCookies(cookiesStore: CookieWriter, session: Session): void {
  const expiresAt = Number(session.expires_at ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxAge = expiresAt > nowSeconds ? expiresAt - nowSeconds : 60 * 60;

  cookiesStore.set(AUTH_ACCESS_COOKIE, session.access_token, cookieOptions(maxAge));
  cookiesStore.set(AUTH_REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

export function writeActiveOrganizationCookie(cookiesStore: CookieWriter, organizationId: string): void {
  cookiesStore.set(ACTIVE_ORG_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
}

export function clearActiveOrganizationCookie(cookiesStore: CookieRemover): void {
  cookiesStore.delete(ACTIVE_ORG_COOKIE);
}

export function clearAuthCookies(cookiesStore: CookieRemover): void {
  cookiesStore.delete(AUTH_ACCESS_COOKIE);
  cookiesStore.delete(AUTH_REFRESH_COOKIE);
  cookiesStore.delete(ACTIVE_ORG_COOKIE);
}

export async function verifySessionTokens(tokens: SessionTokens | null): Promise<VerifiedSession> {
  if (!tokens?.accessToken) {
    return { user: null, session: null, refreshed: false };
  }

  const authClient = supabaseAuthClient();
  const verified = await authClient.auth.getUser(tokens.accessToken);

  if (!verified.error && verified.data.user) {
    return {
      user: verified.data.user,
      session: null,
      refreshed: false,
    };
  }

  if (!tokens.refreshToken) {
    return { user: null, session: null, refreshed: false };
  }

  const refreshed = await authClient.auth.refreshSession({
    refresh_token: tokens.refreshToken,
  });

  if (refreshed.error || !refreshed.data.user || !refreshed.data.session) {
    return { user: null, session: null, refreshed: false };
  }

  return {
    user: refreshed.data.user,
    session: refreshed.data.session,
    refreshed: true,
  };
}
