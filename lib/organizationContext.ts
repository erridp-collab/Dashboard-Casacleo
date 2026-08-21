import "server-only";
import { cookies } from "next/headers";
import {
  MEMBERSHIP_WITH_ORGANIZATION_SELECT,
  organizationFromMembershipRows,
  type OrganizationProjectionRecord,
} from "@/lib/data/organizations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  readActiveOrganizationId,
  readSessionTokens,
  verifyAccessTokenSubject,
  verifySessionTokens,
  writeActiveOrganizationCookie,
  writeSessionCookies,
} from "@/lib/supabaseAuth";
import { timed, type TimingEntry } from "@/lib/timing/serverTiming";

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

export type OrganizationRecord = OrganizationProjectionRecord;

export type OrganizationContext = {
  organizationId: string;
  role: OrganizationRole;
  userId: string;
  email: string | null;
};

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

async function membershipsForUser(userId: string): Promise<OrganizationMembership[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("user_roles")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => ({
      organization_id: String(row.organization_id ?? ""),
      role: String(row.role ?? "") as OrganizationRole,
    }))
    .filter((row) => row.organization_id && row.role);
}

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
    .select(MEMBERSHIP_WITH_ORGANIZATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return organizationFromMembershipRows(
    (data ?? []) as unknown as Record<string, unknown>[],
    preferredOrganizationId,
  );
}

export async function requireOrganizationContext(phases: TimingEntry[] = []): Promise<OrganizationContext> {
  const cookieStore = await cookies();
  const tokens = readSessionTokens(cookieStore);
  // getUser remains authoritative and is always awaited. A locally verified JWT
  // subject only lets the independent membership lookup begin earlier.
  const authPromise = timed(phases, "auth", () => verifySessionTokens(tokens));
  const claimedUserId = await timed(phases, "claims", () => verifyAccessTokenSubject(tokens));
  const claimedMembershipsPromise = claimedUserId
    ? timed(phases, "roles", () => membershipsForUser(claimedUserId))
    : Promise.resolve<OrganizationMembership[] | null>(null);
  const [authResult, claimedMembershipsResult] = await Promise.allSettled([
    authPromise,
    claimedMembershipsPromise,
  ]);

  if (authResult.status === "rejected") throw authResult.reason;
  const verified = authResult.value;

  if (!verified.user) {
    throw new UnauthorizedError("Unauthorized");
  }

  if (verified.refreshed && verified.session) {
    writeSessionCookies(cookieStore, verified.session);
  }

  const userId = verified.user.id;
  let memberships: OrganizationMembership[];
  if (claimedUserId === userId) {
    if (claimedMembershipsResult.status === "rejected") throw claimedMembershipsResult.reason;
    memberships = claimedMembershipsResult.value ?? [];
  } else {
    // A mismatch cannot authorize the speculative subject. Query again using
    // only the user id returned by the authoritative getUser verification.
    memberships = await timed(phases, "roles", () => membershipsForUser(userId));
  }

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
