import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  names: string[];
  qty: number;
};

type DbError = { code?: string; message?: string } | null;

function isMissingColumn(error: DbError, column?: string): boolean {
  if (!error) return false;
  if (String(error.code) !== "42703") return false;
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

async function tryUpdateExpense(expenseId: string, payloads: Record<string, unknown>[]): Promise<boolean> {
  const supabase = supabaseAdmin();
  for (const payload of payloads) {
    const update = await supabase.from("expenses").update(payload).eq("id", expenseId);
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
  note?: string | null,
) {
  const supabase = supabaseAdmin();
  const hoursLabel = `Pulizia esterna - ore ${amount}`;
  const description = note?.trim()
    ? `${hoursLabel} (${note.trim()})`
    : hoursLabel;

  const payloads = [
    {
      expense_date: actionDate,
      amount,
      category: "Pulizie",
      description,
      origin: "automatica_da_pulizia",
      source_action_id: actionId,
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
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const updated = await tryUpdateExpense(existing.data.id, payloads);
    if (updated) return;
  }

  await tryInsertExpense(payloads);
}

async function deleteCleaningExpense(actionId: string) {
  const supabase = supabaseAdmin();
  const directDelete = await supabase
    .from("expenses")
    .delete()
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia");
  if (!directDelete.error || isMissingColumn(directDelete.error)) return;
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

async function upsertShoppingExpense(actionId: string, actionDate: string, amount: number, note?: string | null) {
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
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const updated = await tryUpdateExpense(existing.data.id, payloads);
    if (updated) return;
  }

  await tryInsertExpense(payloads);
}

async function deleteShoppingExpense(actionId: string) {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("expenses")
    .delete()
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento");
  if (result.error && !isMissingColumn(result.error)) {
    throw new Error(result.error.message);
  }
}

async function applyShoppingRestock(actionId: string, details: string | null) {
  const names = parseShoppingDetails(details);
  if (names.length === 0) return;

  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, ${schema.quantityColumn}, threshold, max_qty`);
  if (error) throw new Error(error.message);

  const byName = new Map<string, Record<string, unknown>>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    byName.set(normalizeName(String(row.name ?? "")), row);
  }

  for (const name of names) {
    const row = byName.get(normalizeName(name));
    if (!row) continue;
    const id = String(row[schema.idColumn] ?? "");
    if (!id) continue;
    const threshold = Number(row.threshold);
    const maxQty = Number(row.max_qty);
    const nextQty = Number.isFinite(maxQty) && maxQty > 0 ? maxQty : Number.isFinite(threshold) ? Math.max(1, threshold + 1) : 1;
    const { error: updateErr } = await supabase
      .from("products")
      .update({ [schema.quantityColumn]: nextQty })
      .eq(schema.idColumn, id);
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
    { key: "sets_estivo", names: ["set letto estivo", "completi letto completi"], qty: toNumber(linen.sets_estivo) },
    { key: "sets_invernale", names: ["set letto invernale", "copripiumini + federe"], qty: toNumber(linen.sets_invernale) },
    { key: "towels_bidet", names: ["asciugamani bidet"], qty: toNumber(linen.towels_bidet) },
    { key: "towels_viso", names: ["asciugamani viso", "asciugamani corpo"], qty: toNumber(linen.towels_viso) },
    { key: "towels_doccia", names: ["asciugamani doccia"], qty: toNumber(linen.towels_doccia) },
    { key: "tappetino", names: ["tappetini doccia"], qty: toNumber(linen.tappetino) },
    { key: "mappine", names: ["mappine cucina"], qty: toNumber(linen.mappine) },
    { key: "carta_igienica", names: ["carta igienica"], qty: toNumber(linen.carta_igienica) },
    { key: "spugne_piatti", names: ["spugnette lavapiatti"], qty: toNumber(linen.spugne_piatti) },
  ];
}

function buildLaundryQuantityItems(laundry: LaundryCompletion): QuantityItem[] {
  return [
    { key: "sets_estivo", names: ["set letto estivo", "completi letto completi"], qty: toNumber(laundry.sets_estivo) },
    { key: "sets_invernale", names: ["set letto invernale", "copripiumini + federe"], qty: toNumber(laundry.sets_invernale) },
    { key: "towels_bidet", names: ["asciugamani bidet"], qty: toNumber(laundry.towels_bidet) },
    { key: "towels_viso", names: ["asciugamani viso", "asciugamani corpo"], qty: toNumber(laundry.towels_viso) },
    { key: "towels_doccia", names: ["asciugamani doccia"], qty: toNumber(laundry.towels_doccia) },
    { key: "tappetino", names: ["tappetini doccia"], qty: toNumber(laundry.tappetino) },
    { key: "mappine", names: ["mappine cucina"], qty: toNumber(laundry.mappine) },
  ];
}

async function applyProductQuantityDelta(
  items: QuantityItem[],
  operation: "consume" | "add",
  options?: { capToMaxQty?: boolean },
): Promise<Record<string, number>> {
  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, ${schema.quantityColumn}, max_qty`);
  if (error) throw new Error(error.message);

  const byName = new Map<string, Record<string, unknown>>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    byName.set(normalizeName(String(row.name ?? "")), row);
  }

  const applied: Record<string, number> = {};
  const updates: Array<{ id: string; nextQty: number }> = [];

  for (const item of items) {
    if (item.qty <= 0) continue;
    const row = item.names
      .map((name) => byName.get(normalizeName(name)))
      .find((match): match is Record<string, unknown> => Boolean(match));
    if (!row) continue;

    const id = getProductId(row, schema);
    if (!id) continue;

    const currentQty = getProductQuantity(row, schema);
    let nextQty = currentQty;

    if (operation === "consume") {
      nextQty = roundQty(Math.max(0, currentQty - item.qty));
    } else {
      const rawTarget = currentQty + item.qty;
      const maxQty = Number(row.max_qty);
      nextQty = roundQty(
        options?.capToMaxQty && Number.isFinite(maxQty) && maxQty > 0
          ? Math.min(maxQty, rawTarget)
          : rawTarget,
      );
    }

    const appliedQty = roundQty(Math.abs(nextQty - currentQty));
    if (appliedQty <= 0) continue;

    updates.push({ id, nextQty });
    applied[item.key] = appliedQty;
  }

  await Promise.all(
    updates.map(({ id, nextQty }) =>
      supabase
        .from("products")
        .update({ [schema.quantityColumn]: nextQty })
        .eq(schema.idColumn, id)
        .then(({ error: updateErr }) => {
          if (updateErr) throw new Error(updateErr.message);
        }),
    ),
  );

  return applied;
}

function toLinenCompletion(applied: Record<string, number>): LinenCompletion {
  return {
    sets_estivo: applied.sets_estivo ?? 0,
    sets_invernale: applied.sets_invernale ?? 0,
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
    towels_bidet: applied.towels_bidet ?? 0,
    towels_viso: applied.towels_viso ?? 0,
    towels_doccia: applied.towels_doccia ?? 0,
    tappetino: applied.tappetino ?? 0,
    mappine: applied.mappine ?? 0,
  };
}

async function saveActionDetails(actionId: string, details: StoredActionDetails): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("actions")
    .update({ details: JSON.stringify(details) })
    .eq("id", actionId);
  if (error) throw new Error(error.message);
}

async function applyLinenConsumption(linen: LinenCompletion): Promise<LinenCompletion> {
  const applied = await applyProductQuantityDelta(buildLinenQuantityItems(linen), "consume");
  return toLinenCompletion(applied);
}

async function restoreLinenConsumption(linen: LinenCompletion): Promise<void> {
  await applyProductQuantityDelta(buildLinenQuantityItems(linen), "add");
}

export async function applyLinenConsumptionDelta(linen: LinenCompletion, direction: 1 | -1): Promise<void> {
  if (direction === 1) {
    await applyLinenConsumption(linen);
  } else {
    await restoreLinenConsumption(linen);
  }
  await syncShoppingAction();
}

async function applyLaundryRestock(laundry: LaundryCompletion): Promise<LaundryCompletion> {
  const applied = await applyProductQuantityDelta(buildLaundryQuantityItems(laundry), "add", { capToMaxQty: true });
  return toLaundryCompletion(applied);
}

async function revertLaundryRestock(laundry: LaundryCompletion): Promise<void> {
  await applyProductQuantityDelta(buildLaundryQuantityItems(laundry), "consume");
}

export async function applyActionStatusEffects(
  actionId: string,
  nextStatus: "DA_FARE" | "FATTO",
  completion?: CleaningCompletion,
) {
  const supabase = supabaseAdmin();
  const { data: actionRow, error: actionErr } = await supabase
    .from("actions")
    .select("id, action_type, action_date, details")
    .eq("id", actionId)
    .maybeSingle();
  if (actionErr || !actionRow) return;

  const actionType = String(actionRow.action_type ?? "");
  const storedDetails = parseActionDetails(actionRow.details);

  if (isCleaningAction(actionType)) {
    if (nextStatus === "FATTO") {
      const mode = completion?.mode ?? "SELF";
      const amount = Number(completion?.external_amount ?? 0);
      if (mode === "EXTERNAL" && Number.isFinite(amount) && amount > 0) {
        await upsertCleaningExpense(actionId, String(actionRow.action_date), amount, completion?.note);
      }
    } else {
      await deleteCleaningExpense(actionId);
    }
  }

  if (isLaundryAction(actionType)) {
    if (nextStatus === "FATTO") {
      const laundry = completion?.laundry ?? parseLaundryDetails(actionRow.details);
      if (laundry) {
        storedDetails.laundry = laundry;
        storedDetails.laundry_applied = await applyLaundryRestock(laundry);
        await saveActionDetails(actionId, storedDetails);
      }
    } else {
      const laundry = parseAppliedLaundryDetails(actionRow.details);
      if (laundry) {
        await revertLaundryRestock(laundry);
        storedDetails.laundry_applied = undefined;
        await saveActionDetails(actionId, storedDetails);
      }
    }
  }

  if (actionType.toUpperCase().includes("BIANCHERIA")) {
    if (nextStatus === "FATTO") {
      const linen = completion?.linen ?? parseLinenDetails(actionRow.details);
      if (linen) {
        storedDetails.linen = linen;
        storedDetails.linen_applied = await applyLinenConsumption(linen);
        await saveActionDetails(actionId, storedDetails);
      }
    } else {
      const linen = parseAppliedLinenDetails(actionRow.details);
      if (linen) {
        await restoreLinenConsumption(linen);
        storedDetails.linen_applied = undefined;
        await saveActionDetails(actionId, storedDetails);
      }
    }
  }

  if (isShoppingAction(actionType)) {
    if (nextStatus === "FATTO") {
      await applyShoppingRestock(actionId, String(actionRow.details ?? ""));
      const amount = Number(completion?.amount ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        await upsertShoppingExpense(actionId, String(actionRow.action_date), amount, completion?.note);
      }
    } else {
      await deleteShoppingExpense(actionId);
    }
  }

  await syncShoppingAction();
}


