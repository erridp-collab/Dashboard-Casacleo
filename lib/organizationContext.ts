import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  readActiveOrganizationId,
  readSessionTokens,
  verifySessionTokens,
  writeActiveOrganizationCookie,
  writeSessionCookies,
} from "@/lib/supabaseAuth";

export type OrganizationRole = "owner" | "admin" | "staff";

export type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
};

export type OrganizationSettings = {
  onboarding_completed?: boolean;
  onboarding_completed_at?: string;
  [key: string]: unknown;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  settings: OrganizationSettings;
};

export type OrganizationContext = {
  organizationId: string;
  role: OrganizationRole;
  userId: string;
  email: string | null;
};

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

function toOrganizationSettings(value: unknown): OrganizationSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OrganizationSettings;
}

export function isOnboardingComplete(settings: OrganizationSettings | null | undefined): boolean {
  return Boolean(settings?.onboarding_completed);
}

export async function resolveDefaultOrganizationId(): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

export async function resolveOrganizationId(explicitOrganizationId?: string | null): Promise<string | null> {
  if (explicitOrganizationId) return explicitOrganizationId;
  return resolveDefaultOrganizationId();
}

export async function getOrganizationRecord(organizationId: string): Promise<OrganizationRecord | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, currency_code, timezone, settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;

  return {
    id: String(data.id),
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    currency_code: String(data.currency_code ?? "EUR"),
    timezone: String(data.timezone ?? "Europe/Rome"),
    settings: toOrganizationSettings(data.settings),
  };
}

export async function findPrimaryOrganizationForUser(
  userId: string,
  preferredOrganizationId?: string | null,
): Promise<OrganizationRecord | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const memberships = (data ?? [])
    .map((row) => String(row.organization_id ?? ""))
    .filter(Boolean);

  if (memberships.length === 0) return null;

  const targetOrganizationId =
    memberships.find((organizationId) => organizationId === preferredOrganizationId) ??
    memberships[0];

  return getOrganizationRecord(targetOrganizationId);
}

export async function requireOrganizationContext(): Promise<OrganizationContext> {
  const cookieStore = await cookies();
  const tokens = readSessionTokens(cookieStore);
  const verified = await verifySessionTokens(tokens);

  if (!verified.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  if (verified.refreshed && verified.session) {
    writeSessionCookies(cookieStore, verified.session);
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("user_roles")
    .select("organization_id, role")
    .eq("user_id", verified.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const memberships = (data ?? [])
    .map((row) => ({
      organization_id: String(row.organization_id ?? ""),
      role: String(row.role ?? "") as OrganizationRole,
    }))
    .filter((row) => row.organization_id && row.role);

  if (memberships.length === 0) {
    throw new ForbiddenError("No organization membership found");
  }

  const requestedOrgId = readActiveOrganizationId(cookieStore);
  const membership =
    memberships.find((row) => row.organization_id === requestedOrgId) ??
    memberships[0];

  if (!requestedOrgId || requestedOrgId !== membership.organization_id) {
    writeActiveOrganizationCookie(cookieStore, membership.organization_id);
  }

  return {
    organizationId: membership.organization_id,
    role: membership.role,
    userId: verified.user.id,
    email: verified.user.email ?? null,
  };
}

export async function requireOrganizationState(): Promise<{
  context: OrganizationContext;
  organization: OrganizationRecord;
}> {
  const context = await requireOrganizationContext();
  const organization = await getOrganizationRecord(context.organizationId);

  if (!organization) {
    throw new ForbiddenError("Organization not found");
  }

  return { context, organization };
}
