import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export type ProvisionedAuthUser = {
  id: string;
  email: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
};

export async function createOrganization(organizationName: string): Promise<string> {
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

  return organizationId;
}

export async function ensureOwnerMembership(organizationId: string, userId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const membership = await supabase.from("user_roles").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (membership.error) {
    throw new Error(membership.error.message);
  }
}

export async function createOrganizationForUser(userId: string, organizationName: string): Promise<string> {
  const organizationId = await createOrganization(organizationName);
  await ensureOwnerMembership(organizationId, userId);
  return organizationId;
}

export async function findAuthUserByEmail(email: string): Promise<ProvisionedAuthUser | null> {
  const supabase = supabaseAdmin();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const result = await supabase.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      throw new Error(result.error.message);
    }

    const match = result.data.users.find(
      (user) => user.email?.trim().toLowerCase() === email.trim().toLowerCase(),
    );

    if (match) {
      return {
        id: match.id,
        email: match.email ?? null,
        created_at: match.created_at,
        last_sign_in_at: match.last_sign_in_at ?? null,
        email_confirmed_at: match.email_confirmed_at ?? null,
        banned_until: match.banned_until ?? null,
      };
    }

    if (result.data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

export async function resolveOrCreateAuthUser({
  existingUserId,
  email,
  fullName,
}: {
  existingUserId?: string | null;
  email: string;
  fullName?: string | null;
}): Promise<ProvisionedAuthUser> {
  const supabase = supabaseAdmin();

  if (existingUserId) {
    const existing = await supabase.auth.admin.getUserById(existingUserId);
    if (!existing.error && existing.data.user) {
      return {
        id: existing.data.user.id,
        email: existing.data.user.email ?? null,
      };
    }
  }

  const byEmail = await findAuthUserByEmail(email);
  if (byEmail) {
    return byEmail;
  }

  const password = `Tmp-${randomUUID()}-Aa1!`;
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "Unable to create auth user");
  }

  return {
    id: created.data.user.id,
    email: created.data.user.email ?? null,
    created_at: created.data.user.created_at,
    last_sign_in_at: created.data.user.last_sign_in_at ?? null,
    email_confirmed_at: created.data.user.email_confirmed_at ?? null,
    banned_until: created.data.user.banned_until ?? null,
  };
}
