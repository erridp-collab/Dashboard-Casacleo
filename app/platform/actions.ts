"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureOwnerMembership,
  createOrganization,
  resolveOrCreateAuthUser,
} from "@/lib/accountProvisioning";
import {
  requirePlatformAdmin,
  PlatformUnauthorizedError,
  PlatformForbiddenError,
} from "@/lib/platformAdmin";
import { getSiteUrl } from "@/lib/siteUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWelcomeEmail } from "@/lib/email/resend";

type SignupRequestRecord = {
  id: string;
  email: string;
  full_name: string | null;
  organization_name: string;
  status: "pending" | "approved" | "rejected" | "failed";
  notes: string | null;
  auth_user_id: string | null;
  organization_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function getRequestId(formData: FormData): string {
  return formData.get("request_id")?.toString().trim() ?? "";
}

async function requirePlatformAdminForAction() {
  try {
    return await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof PlatformUnauthorizedError) redirect("/login");
    if (error instanceof PlatformForbiddenError) redirect("/");
    throw error;
  }
}

function buildRequestsRedirect(params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`/platform/requests?${search.toString()}`);
}

function buildAccountsRedirect(params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`/platform/accounts?${search.toString()}`);
}

function formatProvisioningNote(message: string): string {
  const normalized = message.trim() || "Errore sconosciuto";
  return `Provisioning failed: ${normalized.slice(0, 400)}`;
}

function isRedirectSignal(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const digest =
    "digest" in error && typeof error.digest === "string"
      ? error.digest
      : "";

  return error.message === "NEXT_REDIRECT" || digest.startsWith("NEXT_REDIRECT");
}

async function loadSignupRequest(requestId: string): Promise<SignupRequestRecord | null> {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("signup_requests")
    .select(
      "id, email, full_name, organization_name, status, notes, auth_user_id, organization_id, reviewed_by, reviewed_at, created_at, updated_at",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as SignupRequestRecord | null;
}

async function patchSignupRequest(requestId: string, payload: Partial<SignupRequestRecord>): Promise<void> {
  const supabase = supabaseAdmin();
  const result = await supabase.from("signup_requests").update(payload).eq("id", requestId);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function approveSignupRequestAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdminForAction();
  const requestId = getRequestId(formData);

  if (!requestId) {
    buildRequestsRedirect({ error: "invalid-request" });
  }

  const request = await loadSignupRequest(requestId);
  if (!request) {
    buildRequestsRedirect({ error: "request-not-found" });
  }

  if (request.status === "approved") {
    buildRequestsRedirect({ notice: "already-approved" });
  }

  if (request.status === "rejected") {
    buildRequestsRedirect({ error: "approval-not-allowed" });
  }

  const headersList = await headers();
  const siteUrl = getSiteUrl(headersList);

  if (!siteUrl) {
    await patchSignupRequest(request.id, {
      status: "failed",
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
      notes: formatProvisioningNote("Configurazione URL piattaforma non disponibile"),
    });
    revalidatePath("/platform/requests");
    buildRequestsRedirect({ error: "approval-failed" });
  }

  let authUserId = request.auth_user_id;
  let organizationId = request.organization_id;

  try {
    const authUser = await resolveOrCreateAuthUser({
      existingUserId: request.auth_user_id,
      email: request.email,
      fullName: request.full_name,
    });
    authUserId = authUser.id;

    await patchSignupRequest(request.id, {
      auth_user_id: authUserId,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    });

    organizationId =
      request.organization_id ??
      (await createOrganization(request.organization_name));

    await patchSignupRequest(request.id, {
      auth_user_id: authUserId,
      organization_id: organizationId,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    });

    await ensureOwnerMembership(organizationId, authUserId);

    const { data: linkData, error: linkError } = await supabaseAdmin().auth.admin.generateLink({
      type: "recovery",
      email: request.email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      throw new Error(linkError?.message ?? "Impossibile generare il link di attivazione");
    }

    // Email failure non deve bloccare il provisioning: l'admin può usare "Reinvia link" se necessario.
    await sendWelcomeEmail({
      email: request.email,
      fullName: request.full_name,
      organizationName: request.organization_name,
      setPasswordUrl: linkData.properties.action_link,
      siteUrl,
    }).catch((emailErr) => {
      console.error("[approveSignupRequestAction] welcome email failed:", emailErr);
    });

    await patchSignupRequest(request.id, {
      status: "approved",
      auth_user_id: authUserId,
      organization_id: organizationId,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
      notes: null,
    });

    revalidatePath("/platform/requests");
    buildRequestsRedirect({
      notice: request.status === "failed" ? "retry-approved" : "approved",
    });
  } catch (error) {
    if (isRedirectSignal(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Errore sconosciuto";

    await patchSignupRequest(request.id, {
      status: "failed",
      auth_user_id: authUserId,
      organization_id: organizationId,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
      notes: formatProvisioningNote(message),
    });

    revalidatePath("/platform/requests");
    buildRequestsRedirect({ error: "approval-failed" });
  }
}

export async function rejectSignupRequestAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdminForAction();
  const requestId = getRequestId(formData);

  if (!requestId) {
    buildRequestsRedirect({ error: "invalid-request" });
  }

  const request = await loadSignupRequest(requestId);
  if (!request) {
    buildRequestsRedirect({ error: "request-not-found" });
  }

  if (request.status === "approved" || request.status === "failed") {
    buildRequestsRedirect({ error: "rejection-not-allowed" });
  }

  await patchSignupRequest(request.id, {
    status: "rejected",
    reviewed_by: admin.userId,
    reviewed_at: new Date().toISOString(),
    notes: null,
  });

  revalidatePath("/platform/requests");
  buildRequestsRedirect({ notice: "rejected" });
}

export async function resendAccountResetLinkAction(formData: FormData): Promise<void> {
  await requirePlatformAdminForAction();

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email) {
    buildAccountsRedirect({ error: "invalid-account" });
  }

  const headersList = await headers();
  const siteUrl = getSiteUrl(headersList);
  if (!siteUrl) {
    buildAccountsRedirect({ email, error: "reset-unavailable" });
  }

  try {
    const { data: linkData, error: linkError } = await supabaseAdmin().auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      throw new Error(linkError?.message ?? "Impossibile generare il link di reset");
    }

    await sendWelcomeEmail({
      email,
      fullName: null,
      organizationName: "",
      setPasswordUrl: linkData.properties.action_link,
      siteUrl,
    });
  } catch (err) {
    console.error("[resendAccountResetLinkAction]", err);
    buildAccountsRedirect({ email, error: "reset-failed" });
  }

  revalidatePath("/platform/accounts");
  buildAccountsRedirect({ email, notice: "reset-sent" });
}

export async function disablePlatformAccountAction(formData: FormData): Promise<void> {
  await requirePlatformAdminForAction();

  const userId = formData.get("user_id")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!userId || !email) {
    buildAccountsRedirect({ error: "invalid-account" });
  }

  const supabase = supabaseAdmin();
  const result = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (result.error) {
    buildAccountsRedirect({ email, error: "disable-failed" });
  }

  revalidatePath("/platform/accounts");
  buildAccountsRedirect({ email, notice: "account-disabled" });
}

export async function reactivatePlatformAccountAction(formData: FormData): Promise<void> {
  await requirePlatformAdminForAction();

  const userId = formData.get("user_id")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!userId || !email) {
    buildAccountsRedirect({ error: "invalid-account" });
  }

  const supabase = supabaseAdmin();
  const result = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (result.error) {
    buildAccountsRedirect({ email, error: "reactivate-failed" });
  }

  revalidatePath("/platform/accounts");
  buildAccountsRedirect({ email, notice: "account-reactivated" });
}
