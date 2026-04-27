"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthToken } from "@/lib/authToken";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minuti

// In-memory per Lambda: protegge attacchi concentrati sulla stessa istanza.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(headersList: Awaited<ReturnType<typeof headers>>): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
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

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

export async function loginAction(prevState: any, formData: FormData) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const { blocked } = checkRateLimit(ip);

  if (blocked) {
    return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  }

  const password = formData.get("password")?.toString();
  const envPassword = process.env.APP_PASSWORD;

  if (!envPassword) {
    return { error: "Variabile di ambiente APP_PASSWORD non configurata nel server" };
  }

  if (password === envPassword) {
    resetRateLimit(ip);
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
