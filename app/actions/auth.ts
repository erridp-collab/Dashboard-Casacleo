"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveDefaultOrganizationId } from "@/lib/organizationContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearAuthCookies, supabaseAuthClient, writeActiveOrganizationCookie, writeSessionCookies } from "@/lib/supabaseAuth";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minuti

// Fallback locale se la tabella DB non è ancora presente.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult = { blocked: boolean; remaining: number };
type LoginActionState = { error?: string } | null;

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function findUserPrimaryOrganization(userId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.organization_id ? String(data.organization_id) : null;
}

async function createOrganizationForUser(userId: string, organizationName: string): Promise<string> {
  const supabase = supabaseAdmin();
  const baseSlug = slugify(organizationName) || "workspace";

  let organizationId = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSuffix()}`;
    const insert = await supabase
      .from("organizations")
      .insert({
        name: organizationName.trim(),
        slug,
      })
      .select("id")
      .single();

    if (!insert.error && insert.data?.id) {
      organizationId = String(insert.data.id);
      break;
    }

    if (insert.error && String(insert.error.code) !== "23505") {
      throw new Error(insert.error.message);
    }
  }

  if (!organizationId) {
    throw new Error("Unable to create organization");
  }

  const membership = await supabase.from("user_roles").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "owner",
  });

  if (membership.error) {
    throw new Error(membership.error.message);
  }

  return organizationId;
}

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

    const { data, error } = await supabase.rpc("upsert_rate_limit", {
      p_ip: ip,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_ms: WINDOW_MS,
    });

    if (error) {
      if (isMissingRateLimitTable(error)) return checkRateLimitInMemory(ip);
      // RPC non ancora presente (ambiente senza migration) — fallback in-memory
      if (String(error.code) === "42883" || String(error.message ?? "").includes("upsert_rate_limit")) {
        return checkRateLimitInMemory(ip);
      }
      throw new Error(error.message);
    }

    const result = data as { blocked: boolean; attempt_count: number } | null;
    if (!result) return checkRateLimitInMemory(ip);

    return {
      blocked: result.blocked,
      remaining: Math.max(0, MAX_ATTEMPTS - result.attempt_count),
    };
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

export async function loginAction(prevState: LoginActionState, formData: FormData) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const { blocked } = await checkRateLimit(ip);

  if (blocked) {
    return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  }

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString();
  if (!email || !password) {
    return { error: "Email e password sono obbligatorie" };
  }

  const authClient = supabaseAuthClient();
  const signIn = await authClient.auth.signInWithPassword({ email, password });

  if (signIn.error || !signIn.data.user || !signIn.data.session) {
    return { error: "Credenziali non valide" };
  }

  const organizationId =
    (await findUserPrimaryOrganization(signIn.data.user.id)) ??
    (await resolveDefaultOrganizationId());

  if (!organizationId) {
    return { error: "Nessuna organizzazione associata a questo utente" };
  }

  await resetRateLimit(ip);
  const cookieStore = await cookies();
  writeSessionCookies(cookieStore, signIn.data.session);
  writeActiveOrganizationCookie(cookieStore, organizationId);

  redirect("/");
}

export async function signupAction(prevState: LoginActionState, formData: FormData) {
  const organizationName = formData.get("organization_name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";

  if (!organizationName || !email || !password) {
    return { error: "Organizzazione, email e password sono obbligatorie" };
  }

  if (password.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri" };
  }

  const authClient = supabaseAuthClient();
  const signUp = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (signUp.error) {
    return { error: signUp.error.message };
  }

  if (!signUp.data.user?.id) {
    return { error: "Registrazione non completata" };
  }

  let organizationId: string;
  try {
    organizationId = await createOrganizationForUser(signUp.data.user.id, organizationName);
  } catch (error) {
    console.error("Organization bootstrap failed", error);
    return { error: "Utente creato ma provisioning organizzazione fallito" };
  }

  if (!signUp.data.session) {
    return { error: "Utente creato. Completa il login per continuare." };
  }

  const cookieStore = await cookies();
  writeSessionCookies(cookieStore, signUp.data.session);
  writeActiveOrganizationCookie(cookieStore, organizationId);

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  clearAuthCookies(cookieStore);
  redirect("/login");
}
