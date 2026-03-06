import { resolveProductSchema } from "@/lib/products-schema";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CleaningCompletion = {
  mode?: "SELF" | "EXTERNAL";
  external_amount?: number | null;
  note?: string | null;
};

function isCleaningAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("PULIZIA");
}

function isLaundryAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("LAVATRICI");
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

export async function applyActionStatusEffects(
  actionId: string,
  nextStatus: "DA_FARE" | "FATTO",
  completion?: CleaningCompletion,
) {
  const supabase = supabaseAdmin();
  const { data: actionRow, error: actionErr } = await supabase
    .from("actions")
    .select("id, action_type, action_date")
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

  await syncShoppingAction();
}
