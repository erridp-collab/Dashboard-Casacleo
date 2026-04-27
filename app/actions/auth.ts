"use server";

import { createHash, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthToken } from "@/lib/authToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minuti

// Fallback locale se la tabella DB non è ancora presente.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult = { blocked: boolean; remaining: number };
type LoginActionState = { error?: string } | null;

function getClientIp(headersList: Awaited<ReturnType<typeof headers>>): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimitInMemory(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false, remaining: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { blocked: true, remaining: 0 };
  }

  entry.count += 1;
  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count };
}

function resetRateLimitInMemory(ip: string): void {
  loginAttempts.delete(ip);
}

function isMissingRateLimitTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes("auth_rate_limits");
}

async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const { data, error } = await supabase
      .from("auth_rate_limits")
      .select("attempt_count, reset_at")
      .eq("ip", ip)
      .maybeSingle();

    if (error) {
      if (isMissingRateLimitTable(error)) return checkRateLimitInMemory(ip);
      throw new Error(error.message);
    }

    const resetAt = data?.reset_at ? new Date(String(data.reset_at)) : null;
    if (!data || !resetAt || !Number.isFinite(resetAt.getTime()) || now >= resetAt) {
      const nextReset = new Date(now.getTime() + WINDOW_MS).toISOString();
      const upsert = await supabase.from("auth_rate_limits").upsert({
        ip,
        attempt_count: 1,
        reset_at: nextReset,
      });
      if (upsert.error) {
        if (isMissingRateLimitTable(upsert.error)) return checkRateLimitInMemory(ip);
        throw new Error(upsert.error.message);
      }
      return { blocked: false, remaining: MAX_ATTEMPTS - 1 };
    }

    const attemptCount = Number(data.attempt_count ?? 0);
    if (attemptCount >= MAX_ATTEMPTS) {
      return { blocked: true, remaining: 0 };
    }

    const update = await supabase
      .from("auth_rate_limits")
      .update({ attempt_count: attemptCount + 1 })
      .eq("ip", ip);
    if (update.error) {
      if (isMissingRateLimitTable(update.error)) return checkRateLimitInMemory(ip);
      throw new Error(update.error.message);
    }

    return { blocked: false, remaining: MAX_ATTEMPTS - (attemptCount + 1) };
  } catch (error) {
    console.error("Rate limit storage failed, using in-memory fallback", error);
    return checkRateLimitInMemory(ip);
  }
}

async function resetRateLimit(ip: string): Promise<void> {
  resetRateLimitInMemory(ip);
  try {
    const supabase = supabaseAdmin();
    const result = await supabase.from("auth_rate_limits").delete().eq("ip", ip);
    if (result.error && !isMissingRateLimitTable(result.error)) {
      console.error("Failed to reset DB-backed rate limit", result.error);
    }
  } catch (error) {
    console.error("Failed to reset DB-backed rate limit", error);
  }
}

function safeEqualSecret(input: string, secret: string): boolean {
  const inputHash = createHash("sha256").update(input).digest();
  const secretHash = createHash("sha256").update(secret).digest();
  return timingSafeEqual(inputHash, secretHash);
}

export async function loginAction(prevState: LoginActionState, formData: FormData) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const { blocked } = await checkRateLimit(ip);

  if (blocked) {
    return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  }

  const password = formData.get("password")?.toString();
  const envPassword = process.env.APP_PASSWORD;

  if (!envPassword) {
    return { error: "Variabile di ambiente APP_PASSWORD non configurata nel server" };
  }

  if (password && safeEqualSecret(password, envPassword)) {
    await resetRateLimit(ip);
    const cookieStore = await cookies();
    cookieStore.set("auth-token", createAuthToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    redirect("/");
  } else {
    return { error: "Password errata" };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/login");
}
