import { resolveProductSchema } from "@/lib/products-schema";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CleaningCompletion = {
  mode?: "SELF" | "EXTERNAL" | "SPESA";
  external_amount?: number | null;
  amount?: number | null;
  note?: string | null;
};

function isCleaningAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("PULIZIA");
}

function isLaundryAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("LAVATRICI");
}

function isShoppingAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase() === "SPESA";
}

function isLaundryProduct(name: string, category: string | null): boolean {
  const c = String(category ?? "").toUpperCase();
  if (c === "ASCIUGAMANI E BAGNO" || c === "LENZUOLA E COPERTE" || c === "TESSILI E BIANCHERIA") return true;
  const n = String(name ?? "").toUpperCase();
  return (
    n.includes("ASCIUGAMANI") ||
    n.includes("LENZUO") ||
    n.includes("FEDER") ||
    n.includes("COPRIPIUM") ||
    n.includes("TAPPETINI")
  );
}

async function upsertCleaningExpense(
  actionId: string,
  actionDate: string,
  amount: number,
  note?: string | null,
) {
  const supabase = supabaseAdmin();
  const description = note?.trim()
    ? `Pulizia esterna - ${note.trim()}`
    : "Pulizia esterna";

  const payload = {
    expense_date: actionDate,
    amount,
    category: "Pulizie",
    description,
    notes: description,
    origin: "automatica_da_pulizia",
    source_action_id: actionId,
  };

  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const update = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", existing.data.id);
    if (!update.error) return;
  }

  let insert = await supabase.from("expenses").insert(payload);
  if (!insert.error) return;

  insert = await supabase.from("expenses").insert({
    expense_date: actionDate,
    amount,
    category: "Pulizie",
    notes: description,
  });
  if (insert.error) throw new Error(insert.error.message);
}

async function deleteCleaningExpense(actionId: string) {
  const supabase = supabaseAdmin();
  const directDelete = await supabase
    .from("expenses")
    .delete()
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia");
  if (!directDelete.error) return;
}

async function regenerateLaundryStock() {
  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, category, ${schema.quantityColumn}, max_qty`);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const maxQty = Number(row.max_qty);
    if (!Number.isFinite(maxQty) || maxQty <= 0) continue;
    const name = String(row.name ?? "");
    const category = row.category === null || row.category === undefined ? null : String(row.category);
    if (!isLaundryProduct(name, category)) continue;

    const id = String(row[schema.idColumn] ?? "");
    if (!id) continue;

    const { error: updateErr } = await supabase
      .from("products")
      .update({ [schema.quantityColumn]: maxQty })
      .eq(schema.idColumn, id);
    if (updateErr) throw new Error(updateErr.message);
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
  const payload = {
    expense_date: actionDate,
    amount,
    category: "Rifornimento",
    description,
    notes: description,
    origin: "automatica_da_rifornimento",
    source_action_id: actionId,
  };

  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const update = await supabase.from("expenses").update(payload).eq("id", existing.data.id);
    if (!update.error) return;
  }

  let insert = await supabase.from("expenses").insert(payload);
  if (!insert.error) return;

  insert = await supabase.from("expenses").insert({
    expense_date: actionDate,
    amount,
    category: "Rifornimento",
    notes: description,
  });
  if (insert.error) throw new Error(insert.error.message);
}

async function deleteShoppingExpense(actionId: string) {
  const supabase = supabaseAdmin();
  await supabase
    .from("expenses")
    .delete()
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_rifornimento");
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

  if (isLaundryAction(actionType) && nextStatus === "FATTO") {
    await regenerateLaundryStock();
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
