"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationState } from "@/lib/organizationContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type OnboardingState = {
  error?: string;
} | null;

function normalizeWorkspaceName(value: FormDataEntryValue | null): string {
  return value?.toString().trim() ?? "";
}

function normalizeField(value: FormDataEntryValue | null, fallback: string): string {
  const normalized = value?.toString().trim() ?? "";
  return normalized || fallback;
}

export async function completeOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { context, organization } = await requireOrganizationState();

  const name = normalizeWorkspaceName(formData.get("name"));
  const currencyCode = normalizeField(formData.get("currency_code"), organization.currency_code).toUpperCase();
  const timezone = normalizeField(formData.get("timezone"), organization.timezone);
  const contactName = formData.get("contact_name")?.toString().trim() ?? "";

  if (!name) {
    return { error: "Il nome del workspace e obbligatorio" };
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: "La valuta deve essere un codice di 3 lettere, ad esempio EUR" };
  }

  const settings = {
    ...(organization.settings ?? {}),
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    contact_name: contactName || null,
  };

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      currency_code: currencyCode,
      timezone,
      settings,
    })
    .eq("id", context.organizationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  redirect("/");
}

export async function updateWorkspaceSettingsAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { context, organization } = await requireOrganizationState();

  const name = normalizeWorkspaceName(formData.get("name"));
  const currencyCode = normalizeField(formData.get("currency_code"), organization.currency_code).toUpperCase();
  const timezone = normalizeField(formData.get("timezone"), organization.timezone);
  const contactName = formData.get("contact_name")?.toString().trim() ?? "";

  if (!name) {
    return { error: "Il nome del workspace e obbligatorio" };
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: "La valuta deve essere un codice di 3 lettere, ad esempio EUR" };
  }

  const settings = {
    ...(organization.settings ?? {}),
    contact_name: contactName || null,
  };

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      currency_code: currencyCode,
      timezone,
      settings,
    })
    .eq("id", context.organizationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return null;
}
