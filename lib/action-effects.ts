import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";
import { resolveOrganizationId } from "@/lib/organizationContext";
import { applyProductQuantityDeltas } from "@/lib/product-quantity";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LinenRole } from "@/lib/linen-roles";

export type CleaningCompletion = {
  mode?: "SELF" | "EXTERNAL" | "SPESA" | "BIANCHERIA" | "LAVATRICI";
  external_amount?: number | null;
  amount?: number | null;
  note?: string | null;
  linen?: LinenCompletion | null;
  laundry?: LaundryCompletion | null;
};

export type LinenCompletion = {
  sets_estivo?: number | null;
  sets_invernale?: number | null;
  towels_corpo?: number | null;
  towels_bidet?: number | null;
  towels_viso?: number | null;
  towels_doccia?: number | null;
  tappetino?: number | null;
  mappine?: number | null;
  carta_igienica?: number | null;
  spugne_piatti?: number | null;
};

export type LaundryCompletion = {
  sets_estivo?: number | null;
  sets_invernale?: number | null;
  towels_corpo?: number | null;
  towels_bidet?: number | null;
  towels_viso?: number | null;
  towels_doccia?: number | null;
  tappetino?: number | null;
  mappine?: number | null;
};

type StoredActionDetails = {
  linen?: LinenCompletion;
  linen_applied?: LinenCompletion;
  laundry?: LaundryCompletion;
  laundry_applied?: LaundryCompletion;
};

type QuantityItem = {
  key: string;
  linen_role?: LinenRole | null;
  names: string[];
  qty: number;
};

type ProductRow = Record<string, unknown>;

type DbError = { code?: string; message?: string } | null;

function isMissingColumn(error: DbError, column?: string): boolean {
  if (!error) return false;
  const code = String(error.code);
  // 42703 = PostgreSQL "column does not exist"; PGRST204 = PostgREST schema cache miss
  if (code !== "42703" && code !== "PGRST204") return false;
  const msg = String(error.message ?? "");
  return column ? msg.includes(column) : true;
}

async function tryInsertExpense(payloads: Record<string, unknown>[]): Promise<void> {
  const supabase = supabaseAdmin();
  let lastError: DbError = null;
  for (const payload of payloads) {
    const result = await supabase.from("expenses").insert(payload);
    if (!result.error) return;
    lastError = result.error;
    if (!isMissingColumn(result.error)) {
      throw new Error(result.error.message);
    }
  }
  if (lastError) throw new Error(String(lastError.message ?? "Unable to insert expense"));
}

async function tryUpdateExpense(
  expenseId: string,
  payloads: Record<string, unknown>[],
  organizationId?: string,
): Promise<boolean> {
  const supabase = supabaseAdmin();
  for (const payload of payloads) {
    let updateQuery = supabase.from("expenses").update(payload).eq("id", expenseId);
    if (organizationId) updateQuery = updateQuery.eq("organization_id", organizationId);
    const update = await updateQuery;
    if (!update.error) return true;
    if (!isMissingColumn(update.error)) {
      throw new Error(update.error.message);
    }
  }
  return false;
}

function isCleaningAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("PULIZIA");
}

function isLaundryAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("LAVATRICI");
}

function isShoppingAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase() === "SPESA";
}

async function upsertCleaningExpense(
  actionId: string,
  actionDate: string,
  amount: number,
  organizationId: string,
  note?: string | null,
) {
  const supabase = supabaseAdmin();
  const baseLabel = `Pulizia esterna - €${amount.toFixed(2)}`;
  const description = note?.trim()
    ? `${baseLabel} (${note.trim()})`
    : baseLabel;

  const payloads = [
    {
      expense_date: actionDate,
      amount,
      category: "Pulizie",
      description,
      origin: "automatica_da_pulizia",
      source_action_id: actionId,
      organization_id: organizationId,
    },
    {
      expense_date: actionDate,
      amount,
      category: "Pulizie",
      description,
    },
    {
      date: actionDate,
      amount,
      category: "Pulizie",
      description,
    },
  ];

  // Try to find existing record (column may not exist — ignore errors).
  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const updated = await tryUpdateExpense(existing.data.id, payloads, organizationId);
    if (updated) return;
  }

  await tryInsertExpense(payloads);
}

async function deleteCleaningExpense(actionId: string, organizationId: string) {
  const supabase = supabaseAdmin();
  const directDelete = await supabase
    .from("expenses")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia");
  if (!directDelete.error || isMissingColumn(directDelete.error)) return;
}

async function upsertLaundryExpense(actionId: string, actionDate: string, amount: number, organizationId: string) {
  const supabase = supabaseAdmin();
  const description = `Lavanderia - €${amount.toFixed(2)}`;
  const payloads = [
    {
      expense_date: actionDate,
      amount,
      category: "Lavanderia",
      description,
      origin: "automatica_da_lavatrici",
      source_action_id: actionId,
      organization_id: organizationId,
    },
    {
      expense_date: actionDate,
      amount,
      category: "Lavanderia",
      description,
    },
    {
      date: actionDate,
      amount,
      category: "Lavanderia",
      description,
    },
  ];

  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_lavatrici")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const updated = await tryUpdateExpense(existing.data.id, payloads, organizationId);
    if (updated) return;
  }

  await tryInsertExpense(payloads);
}

async function deleteLaundryExpense(actionId: string, organizationId: string) {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("expenses")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_lavatrici");
  if (result.error && !isMissingColumn(result.error)) {
    throw new Error(result.error.message);
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundQty(value: number): number {
  return Number(value.toFixed(2));
}

function getRowQuantity(row: ProductRow, quantityColumn: string): number {
  return toNumber(row[quantityColumn]);
}

function selectPreferredProductRow(
  byName: Map<string, ProductRow[]>,
  names: string[],
  quantityColumn: string,
): ProductRow | null {
  const candidates = names.flatMap((name, index) =>
    (byName.get(normalizeName(name)) ?? []).map((row) => ({ row, index })),
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const qtyA = getRowQuantity(a.row, quantityColumn);
    const qtyB = getRowQuantity(b.row, quantityColumn);
    if (qtyB !== qtyA) return qtyB - qtyA;
    return a.index - b.index;
  });

  return candidates[0]?.row ?? null;
}

function parseActionDetails(details: string | null): StoredActionDetails {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details) as StoredActionDetails;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseShoppingDetails(details: string | null): string[] {
  if (!details) return [];
  const names: string[] = [];
  for (const line of String(details).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    const name = trimmed.slice(2).split(":")[0]?.trim();
    if (!name) continue;
    names.push(name);
  }
  return names;
}

async function upsertShoppingExpense(
  actionId: string,
  actionDate: string,
  amount: number,
  organizationId: string,
  note?: string | null,
) {
  const supabase = supabaseAdmin();
  const description = note?.trim() ? `Rifornimento - ${note.trim()}` : "Rifornimento";
  const payloads = [
    {
      expense_date: actionDate,
      amount,
      category: "Rifornimento",
      description,
      origin: "automatica_da_rifornimento",
      source_action_id: actionId,
      organization_id: organizationId,
    },
    {
      expense_date: actionDate,
      amount,
      category: "Rifornimento",
      description,
    },
    {
      date: actionDate,
      amount,
      category: "Rifornimento",
      description,
    },
  ];

  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const updated = await tryUpdateExpense(existing.data.id, payloads, organizationId);
    if (updated) return;
  }

  await tryInsertExpense(payloads);
}

async function deleteShoppingExpense(actionId: string, organizationId: string) {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("expenses")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento");
  if (result.error && !isMissingColumn(result.error)) {
    throw new Error(result.error.message);
  }
}

async function applyShoppingRestock(actionId: string, details: string | null, organizationId: string) {
  const names = parseShoppingDetails(details);
  if (names.length === 0) return;

  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, ${schema.quantityColumn}, threshold, max_qty, stock_status`)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  const byName = new Map<string, Record<string, unknown>>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    byName.set(normalizeName(String(row.name ?? "")), row);
  }

  const deltas: Array<{
    id: string;
    currentQty: number;
    delta: number;
    maxQty: number | null;
  }> = [];
  const fullStockIds: string[] = [];

  for (const name of names) {
    const row = byName.get(normalizeName(name));
    if (!row) continue;
    const id = String(row[schema.idColumn] ?? "");
    if (!id) continue;
    const threshold = Number(row.threshold);
    const maxQty = Number(row.max_qty);
    const currentQty = getProductQuantity(row, schema);
    const targetQty = Number.isFinite(maxQty) && maxQty > 0
      ? maxQty
      : Number.isFinite(threshold)
        ? Math.max(1, threshold + 1)
        : 1;

    deltas.push({
      id,
      currentQty,
      delta: Number((targetQty - currentQty).toFixed(2)),
      maxQty: Number.isFinite(maxQty) ? maxQty : null,
    });
    fullStockIds.push(id);
  }

  await applyProductQuantityDeltas(supabase, schema, deltas, {
    capToMaxQty: true,
    floorAtZero: true,
  });

  if (fullStockIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("products")
      .update({ stock_status: "PIENO" })
      .eq("organization_id", organizationId)
      .in(schema.idColumn, fullStockIds);
    if (updateErr) throw new Error(updateErr.message);
  }
}

function parseLinenDetails(details: string | null): LinenCompletion | null {
  return parseActionDetails(details).linen ?? null;
}

function parseAppliedLinenDetails(details: string | null): LinenCompletion | null {
  const parsed = parseActionDetails(details);
  return parsed.linen_applied ?? parsed.linen ?? null;
}

function parseLaundryDetails(details: string | null): LaundryCompletion | null {
  return parseActionDetails(details).laundry ?? null;
}

function parseAppliedLaundryDetails(details: string | null): LaundryCompletion | null {
  const parsed = parseActionDetails(details);
  return parsed.laundry_applied ?? parsed.laundry ?? null;
}

function buildLinenQuantityItems(linen: LinenCompletion): QuantityItem[] {
  return [
    { key: "sets_estivo",    linen_role: "set_estivo",          names: ["set letto estivo", "completi letto completi"],              qty: toNumber(linen.sets_estivo) },
    { key: "sets_invernale", linen_role: "set_invernale",        names: ["set letto invernale", "copripiumini + federe"],             qty: toNumber(linen.sets_invernale) },
    { key: "towels_corpo",   linen_role: "asciugamano_corpo",    names: ["asciugamano corpo", "asciugamani corpo"],                  qty: toNumber(linen.towels_corpo) },
    { key: "towels_bidet",   linen_role: "asciugamano_bidet",    names: ["asciugamano bidet", "asciugamani bidet"],                  qty: toNumber(linen.towels_bidet) },
    { key: "towels_viso",    linen_role: "asciugamano_viso",     names: ["asciugamano viso", "asciugamani viso"],                    qty: toNumber(linen.towels_viso) },
    { key: "towels_doccia",  linen_role: "asciugamano_doccia",   names: ["asciugamano doccia", "asciugamani doccia"],                qty: toNumber(linen.towels_doccia) },
    { key: "tappetino",      linen_role: "tappetino_doccia",     names: ["tappetino doccia", "tappetini doccia"],                    qty: toNumber(linen.tappetino) },
    { key: "mappine",        linen_role: "mappina_cucina",        names: ["strofinacci", "mappina cucina", "mappine cucina"],         qty: toNumber(linen.mappine) },
    { key: "carta_igienica",                                       names: ["carta igienica"],                                         qty: toNumber(linen.carta_igienica) },
    { key: "spugne_piatti",                                        names: ["spugnette lavapiatti", "spugna piatti", "spugne piatti"], qty: toNumber(linen.spugne_piatti) },
  ];
}

function buildLaundryQuantityItems(laundry: LaundryCompletion): QuantityItem[] {
  return [
    { key: "sets_estivo",    linen_role: "set_estivo",          names: ["set letto estivo", "completi letto completi"],      qty: toNumber(laundry.sets_estivo) },
    { key: "sets_invernale", linen_role: "set_invernale",        names: ["set letto invernale", "copripiumini + federe"],     qty: toNumber(laundry.sets_invernale) },
    { key: "towels_corpo",   linen_role: "asciugamano_corpo",    names: ["asciugamano corpo", "asciugamani corpo"],          qty: toNumber(laundry.towels_corpo) },
    { key: "towels_bidet",   linen_role: "asciugamano_bidet",    names: ["asciugamano bidet", "asciugamani bidet"],          qty: toNumber(laundry.towels_bidet) },
    { key: "towels_viso",    linen_role: "asciugamano_viso",     names: ["asciugamano viso", "asciugamani viso"],            qty: toNumber(laundry.towels_viso) },
    { key: "towels_doccia",  linen_role: "asciugamano_doccia",   names: ["asciugamano doccia", "asciugamani doccia"],        qty: toNumber(laundry.towels_doccia) },
    { key: "tappetino",      linen_role: "tappetino_doccia",     names: ["tappetino doccia", "tappetini doccia"],            qty: toNumber(laundry.tappetino) },
    { key: "mappine",        linen_role: "mappina_cucina",        names: ["strofinacci", "mappina cucina", "mappine cucina"], qty: toNumber(laundry.mappine) },
  ];
}

async function applyProductQuantityDelta(
  items: QuantityItem[],
  operation: "consume" | "add",
  options?: { capToMaxQty?: boolean },
  organizationId?: string,
): Promise<Record<string, number>> {
  const resolvedOrganizationId = organizationId ?? null;
  if (!resolvedOrganizationId) throw new Error("organizationId is required");

  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, linen_role, ${schema.quantityColumn}, max_qty`)
    .eq("organization_id", resolvedOrganizationId);
  if (error) throw new Error(error.message);

  const byLinenRole = new Map<string, ProductRow>();
  const byName = new Map<string, ProductRow[]>();
  for (const raw of data ?? []) {
    const row = raw as ProductRow;
    const role = String(row.linen_role ?? "");
    if (role) byLinenRole.set(role, row);
    const normalized = normalizeName(String(row.name ?? ""));
    const existing = byName.get(normalized);
    if (existing) {
      existing.push(row);
    } else {
      byName.set(normalized, [row]);
    }
  }

  const keyById = new Map<string, string>();
  const deltas: Array<{ id: string; currentQty: number; delta: number; maxQty: number | null }> = [];

  for (const item of items) {
    if (item.qty <= 0) continue;
    const row =
      (item.linen_role ? byLinenRole.get(item.linen_role) ?? null : null) ??
      selectPreferredProductRow(byName, item.names, schema.quantityColumn);
    if (!row) continue;

    const id = getProductId(row, schema);
    if (!id) continue;

    const currentQty = getProductQuantity(row, schema);
    keyById.set(id, item.key);
    deltas.push({
      id,
      currentQty,
      delta: roundQty(operation === "consume" ? -item.qty : item.qty),
      maxQty: Number.isFinite(Number(row.max_qty)) ? Number(row.max_qty) : null,
    });
  }

  const results = await applyProductQuantityDeltas(supabase, schema, deltas, {
    capToMaxQty: options?.capToMaxQty,
    floorAtZero: operation === "consume",
  });

  const applied: Record<string, number> = {};
  for (const result of results) {
    const key = keyById.get(result.id);
    const appliedQty = roundQty(Math.abs(result.appliedDelta));
    if (!key || appliedQty <= 0) continue;
    applied[key] = appliedQty;
  }

  return applied;
}

function toLinenCompletion(applied: Record<string, number>): LinenCompletion {
  return {
    sets_estivo: applied.sets_estivo ?? 0,
    sets_invernale: applied.sets_invernale ?? 0,
    towels_corpo: applied.towels_corpo ?? 0,
    towels_bidet: applied.towels_bidet ?? 0,
    towels_viso: applied.towels_viso ?? 0,
    towels_doccia: applied.towels_doccia ?? 0,
    tappetino: applied.tappetino ?? 0,
    mappine: applied.mappine ?? 0,
    carta_igienica: applied.carta_igienica ?? 0,
    spugne_piatti: applied.spugne_piatti ?? 0,
  };
}

function toLaundryCompletion(applied: Record<string, number>): LaundryCompletion {
  return {
    sets_estivo: applied.sets_estivo ?? 0,
    sets_invernale: applied.sets_invernale ?? 0,
    towels_corpo: applied.towels_corpo ?? 0,
    towels_bidet: applied.towels_bidet ?? 0,
    towels_viso: applied.towels_viso ?? 0,
    towels_doccia: applied.towels_doccia ?? 0,
    tappetino: applied.tappetino ?? 0,
    mappine: applied.mappine ?? 0,
  };
}

async function saveActionDetails(
  actionId: string,
  details: StoredActionDetails,
  organizationId: string,
): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("actions")
    .update({ details: JSON.stringify(details) })
    .eq("id", actionId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

async function applyLinenConsumption(linen: LinenCompletion, organizationId?: string): Promise<LinenCompletion> {
  const applied = await applyProductQuantityDelta(buildLinenQuantityItems(linen), "consume", undefined, organizationId);
  return toLinenCompletion(applied);
}

async function restoreLinenConsumption(linen: LinenCompletion, organizationId?: string): Promise<void> {
  await applyProductQuantityDelta(buildLinenQuantityItems(linen), "add", undefined, organizationId);
}

export async function applyLinenConsumptionDelta(
  linen: LinenCompletion,
  direction: 1 | -1,
  organizationId?: string,
): Promise<void> {
  if (direction === 1) {
    await applyLinenConsumption(linen, organizationId);
  } else {
    await restoreLinenConsumption(linen, organizationId);
  }
  await syncShoppingAction(organizationId);
}

async function applyLaundryRestock(laundry: LaundryCompletion, organizationId?: string): Promise<LaundryCompletion> {
  const applied = await applyProductQuantityDelta(
    buildLaundryQuantityItems(laundry),
    "add",
    { capToMaxQty: true },
    organizationId,
  );
  return toLaundryCompletion(applied);
}

async function revertLaundryRestock(laundry: LaundryCompletion, organizationId?: string): Promise<void> {
  await applyProductQuantityDelta(buildLaundryQuantityItems(laundry), "consume", undefined, organizationId);
}

export async function applyActionStatusEffects(
  actionId: string,
  nextStatus: "DA_FARE" | "FATTO",
  completion?: CleaningCompletion,
  organizationId?: string,
) {
  const supabase = supabaseAdmin();
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  if (!resolvedOrganizationId) throw new Error("Unable to resolve organization");
  const { data: actionRow, error: actionErr } = await supabase
    .from("actions")
    .select("id, action_type, action_date, details")
    .eq("organization_id", resolvedOrganizationId)
    .eq("id", actionId)
    .maybeSingle();
  if (actionErr) throw new Error(actionErr.message);
  if (!actionRow) throw new Error("Action not found");

  const actionType = String(actionRow.action_type ?? "");
  const storedDetails = parseActionDetails(actionRow.details);

  if (isCleaningAction(actionType)) {
    if (nextStatus === "FATTO") {
      const mode = completion?.mode ?? "SELF";
      const amount = Number(completion?.external_amount ?? 0);
      if (mode === "EXTERNAL" && Number.isFinite(amount) && amount > 0) {
        await upsertCleaningExpense(actionId, String(actionRow.action_date), amount, resolvedOrganizationId, completion?.note);
      }
    } else {
      await deleteCleaningExpense(actionId, resolvedOrganizationId);
    }
  }

  if (isLaundryAction(actionType)) {
    if (nextStatus === "FATTO") {
      const laundry = completion?.laundry ?? parseLaundryDetails(actionRow.details);
      if (laundry) {
        storedDetails.laundry = laundry;
        storedDetails.laundry_applied = await applyLaundryRestock(laundry, resolvedOrganizationId);
        await saveActionDetails(actionId, storedDetails, resolvedOrganizationId);
      }
      const laundryAmount = Number(completion?.amount ?? 1.5);
      if (Number.isFinite(laundryAmount) && laundryAmount > 0) {
        await upsertLaundryExpense(actionId, String(actionRow.action_date), laundryAmount, resolvedOrganizationId);
      }
    } else {
      const laundry = parseAppliedLaundryDetails(actionRow.details);
      if (laundry) {
        await revertLaundryRestock(laundry, resolvedOrganizationId);
        storedDetails.laundry_applied = undefined;
        await saveActionDetails(actionId, storedDetails, resolvedOrganizationId);
      }
      await deleteLaundryExpense(actionId, resolvedOrganizationId);
    }
  }

  if (actionType.toUpperCase().includes("BIANCHERIA")) {
    if (nextStatus === "FATTO") {
      const linen = completion?.linen ?? parseLinenDetails(actionRow.details);
      if (linen) {
        storedDetails.linen = linen;
        storedDetails.linen_applied = await applyLinenConsumption(linen, resolvedOrganizationId);
        await saveActionDetails(actionId, storedDetails, resolvedOrganizationId);
      }
    } else {
      const linen = parseAppliedLinenDetails(actionRow.details);
      if (linen) {
        await restoreLinenConsumption(linen, resolvedOrganizationId);
        storedDetails.linen_applied = undefined;
        await saveActionDetails(actionId, storedDetails, resolvedOrganizationId);
      }
    }
  }

  if (isShoppingAction(actionType)) {
    if (nextStatus === "FATTO") {
      await applyShoppingRestock(actionId, String(actionRow.details ?? ""), resolvedOrganizationId);
      const amount = Number(completion?.amount ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        await upsertShoppingExpense(actionId, String(actionRow.action_date), amount, resolvedOrganizationId, completion?.note);
      }
    } else {
      await deleteShoppingExpense(actionId, resolvedOrganizationId);
    }
  }

  await syncShoppingAction(resolvedOrganizationId);
}
