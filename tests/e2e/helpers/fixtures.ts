import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LinenRole } from "../../../lib/linen-roles";
import { addDaysLocalIT, todayLocalIT } from "../../../lib/localDate";
import { resolveProductSchema } from "../../../lib/products-schema";
import "./loadEnv";

type TestSupabase = ReturnType<typeof supabaseTest>;

type SeededProduct = {
  name: string;
  linenRole: LinenRole;
  quantity: number;
  threshold: number;
};

export type OwnerFlowFixture = {
  orgId: string;
  orgSlug: string;
  userId: string;
  email: string;
  password: string;
  workspaceName: string;
  seededProductNames: string[];
};

const SEEDED_LINEN_PRODUCTS: SeededProduct[] = [
  { name: "Set letto estivo", linenRole: "set_estivo", quantity: 10, threshold: 2 },
  { name: "Asciugamani corpo", linenRole: "asciugamano_corpo", quantity: 10, threshold: 2 },
  { name: "Asciugamani bidet", linenRole: "asciugamano_bidet", quantity: 10, threshold: 2 },
  { name: "Asciugamani viso", linenRole: "asciugamano_viso", quantity: 10, threshold: 2 },
  { name: "Asciugamani doccia", linenRole: "asciugamano_doccia", quantity: 10, threshold: 2 },
  { name: "Tappetino doccia", linenRole: "tappetino_doccia", quantity: 10, threshold: 1 },
  { name: "Strofinacci", linenRole: "mappina_cucina", quantity: 10, threshold: 1 },
];

export function supabaseTest() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function today(): string {
  return todayLocalIT();
}

export function addDays(date: string, days: number): string {
  return addDaysLocalIT(date, days);
}

export async function createTestOrg(
  supabase: TestSupabase,
  suffix: string,
): Promise<{ id: string; slug: string }> {
  const slug = `test-org-${suffix}-${Date.now()}`;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: `Test Org ${suffix}`, slug, currency_code: "EUR", timezone: "Europe/Rome" })
    .select("id, slug")
    .single();

  if (error) throw new Error(`createTestOrg: ${error.message}`);
  return { id: String(data.id), slug: String(data.slug) };
}

export async function cleanupOrg(supabase: TestSupabase, orgId: string): Promise<void> {
  await supabase.from("organizations").delete().eq("id", orgId);
}

function makeSku(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${normalized || "product"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function insertLinenProducts(
  supabase: TestSupabase,
  organizationId: string,
): Promise<string[]> {
  const schema = await resolveProductSchema(supabase);
  const rows = SEEDED_LINEN_PRODUCTS.map((product) => {
    const record: Record<string, unknown> = {
      organization_id: organizationId,
      name: product.name,
      category: "Lenzuola e coperte",
      unit: "pz",
      threshold: product.threshold,
      max_qty: product.quantity,
      linen_role: product.linenRole,
      stock_status: null,
    };
    record[schema.quantityColumn] = product.quantity;
    if (schema.idColumn === "sku") {
      record.sku = makeSku(product.name);
    }
    return record;
  });

  const { error } = await supabase.from("products").insert(rows);
  if (error) throw new Error(`insertLinenProducts: ${error.message}`);

  return SEEDED_LINEN_PRODUCTS.map((product) => product.name);
}

async function createAuthUser(
  supabase: TestSupabase,
  email: string,
  password: string,
): Promise<string> {
  const result = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (result.error || !result.data.user?.id) {
    throw new Error(`createAuthUser: ${result.error?.message ?? "unknown error"}`);
  }

  return result.data.user.id;
}

async function attachOwnerMembership(
  supabase: TestSupabase,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("user_roles").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "owner",
  });

  if (error) throw new Error(`attachOwnerMembership: ${error.message}`);
}

export async function createOwnerFlowFixture(): Promise<OwnerFlowFixture> {
  const supabase = supabaseTest();
  const suffix = `owner-flow-${randomUUID().slice(0, 8)}`;
  const password = "OwnerFlow123!";
  const workspaceName = `E2E Workspace ${suffix}`;
  const email = `e2e.${suffix}@example.com`;

  const org = await createTestOrg(supabase, suffix);
  const userId = await createAuthUser(supabase, email, password);

  try {
    await attachOwnerMembership(supabase, org.id, userId);
    const seededProductNames = await insertLinenProducts(supabase, org.id);

    return {
      orgId: org.id,
      orgSlug: org.slug,
      userId,
      email,
      password,
      workspaceName,
      seededProductNames,
    };
  } catch (error) {
    await cleanupOwnerFlowFixture({
      orgId: org.id,
      orgSlug: org.slug,
      userId,
      email,
      password,
      workspaceName,
      seededProductNames: [],
    });
    throw error;
  }
}

export async function cleanupOwnerFlowFixture(fixture: OwnerFlowFixture): Promise<void> {
  const supabase = supabaseTest();
  await cleanupOrg(supabase, fixture.orgId);

  const deleteResult = await supabase.auth.admin.deleteUser(fixture.userId);
  if (deleteResult.error) {
    throw new Error(`cleanupOwnerFlowFixture: ${deleteResult.error.message}`);
  }
}

export async function getOnboardingComplete(organizationId: string): Promise<boolean> {
  const supabase = supabaseTest();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(`getOnboardingComplete: ${error.message}`);

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return Boolean(settings.onboarding_completed);
}

export async function findBookingByNotes(
  organizationId: string,
  notes: string,
): Promise<{ id: string; checkIn: string; checkOut: string } | null> {
  const supabase = supabaseTest();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .eq("organization_id", organizationId)
    .eq("notes", notes)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findBookingByNotes: ${error.message}`);
  if (!data?.id) return null;

  return {
    id: String(data.id),
    checkIn: String(data.check_in),
    checkOut: String(data.check_out),
  };
}

export async function listBookingActionTypes(
  organizationId: string,
  bookingId: string,
): Promise<string[]> {
  const supabase = supabaseTest();
  const { data, error } = await supabase
    .from("actions")
    .select("action_type")
    .eq("organization_id", organizationId)
    .eq("booking_id", bookingId)
    .order("action_date", { ascending: true });

  if (error) throw new Error(`listBookingActionTypes: ${error.message}`);
  return (data ?? []).map((row) => String(row.action_type));
}

export async function getProductQuantityByName(
  organizationId: string,
  name: string,
): Promise<number | null> {
  const supabase = supabaseTest();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.quantityColumn}, name`)
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(`getProductQuantityByName: ${error.message}`);
  if (!data) return null;

  const quantity = Number((data as Record<string, unknown>)[schema.quantityColumn]);
  return Number.isFinite(quantity) ? quantity : null;
}

export async function createShoppingAction(
  organizationId: string,
  details = "Prodotti da reintegrare:\n- Caffe: 0",
): Promise<string> {
  const supabase = supabaseTest();
  const actionDate = today();
  const payloads = [
    { organization_id: organizationId, action_type: "SPESA", action_date: actionDate, status: "DA_FARE", details, booking_id: null, amount: 0 },
    { organization_id: organizationId, action_type: "SPESA", action_date: actionDate, status: "DA_FARE", details, booking_id: null },
    { organization_id: organizationId, action_type: "SPESA", action_date: actionDate, status: "DA_FARE", details },
  ];

  for (const payload of payloads) {
    const { data, error } = await supabase.from("actions").insert(payload).select("id").single();
    if (!error && data?.id) return String(data.id);
  }

  throw new Error("createShoppingAction: unable to insert SPESA action");
}

export async function findExpenseForAction(
  organizationId: string,
  actionId: string,
): Promise<{ amount: number; category: string; description: string } | null> {
  const supabase = supabaseTest();
  const result = await supabase
    .from("expenses")
    .select("amount, category, description")
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .limit(1)
    .maybeSingle();

  if (!result.error && result.data) {
    return {
      amount: Number(result.data.amount ?? 0),
      category: String(result.data.category ?? ""),
      description: String(result.data.description ?? ""),
    };
  }

  const fallback = await supabase
    .from("expenses")
    .select("amount, category, description")
    .eq("organization_id", organizationId)
    .eq("category", "Rifornimento")
    .eq("description", "Rifornimento")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error) throw new Error(`findExpenseForAction: ${fallback.error.message}`);
  if (!fallback.data) return null;

  return {
    amount: Number(fallback.data.amount ?? 0),
    category: String(fallback.data.category ?? ""),
    description: String(fallback.data.description ?? ""),
  };
}

export function getSupabase(): SupabaseClient {
  return supabaseTest();
}
