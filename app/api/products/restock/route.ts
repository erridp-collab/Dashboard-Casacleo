import { errJson, okJson } from "@/lib/http/apiResponse";
import { applyProductQuantityDeltas } from "@/lib/product-quantity";
import { resolveProductSchema } from "@/lib/products-schema";
import { todayLocalIT } from "@/lib/localDate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type RestockPayload = {
  id: string;
  add_quantity: number;
  amount?: number | null;
  note?: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RestockPayload;
    const addQuantity = toNumber(body.add_quantity, NaN);
    const amount = body.amount === null || body.amount === undefined ? null : toNumber(body.amount, NaN);

    if (!body.id) return errJson("Missing product id", 400);
    if (!Number.isFinite(addQuantity) || addQuantity <= 0) {
      return errJson("Quantita rifornimento non valida", 400);
    }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      return errJson("Importo rifornimento non valido", 400);
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    const { data: row, error: findErr } = await supabase
      .from("products")
      .select(`${schema.idColumn}, ${schema.quantityColumn}, name, category`)
      .eq(schema.idColumn, body.id)
      .maybeSingle();
    if (findErr) return errJson(findErr.message, 400);
    if (!row) return errJson("Product not found", 404);

    const currentQty = toNumber((row as Record<string, unknown>)[schema.quantityColumn], 0);
    const [result] = await applyProductQuantityDeltas(
      supabase,
      schema,
      [{ id: body.id, currentQty, delta: addQuantity }],
      { floorAtZero: true },
    );
    const nextQty = result?.nextQty ?? Number((currentQty + addQuantity).toFixed(2));

    const rowData = row as Record<string, unknown>;
    const isCleaningProduct = typeof rowData.category === "string" && rowData.category.toLowerCase().includes("pulizia");
    if (isCleaningProduct) {
      const { error: updateErr } = await supabase
        .from("products")
        .update({ stock_status: "PIENO" })
        .eq(schema.idColumn, body.id);
      if (updateErr) return errJson(updateErr.message, 400);
    }

    if (amount !== null) {
      const description = body.note?.trim()
        ? `Rifornimento ${(row as Record<string, unknown>).name ?? ""} - ${body.note.trim()}`
        : `Rifornimento ${(row as Record<string, unknown>).name ?? ""}`;

      const today = todayLocalIT();
      let expenseInsert = await supabase.from("expenses").insert({
        expense_date: today,
        amount,
        category: "Rifornimento",
        description,
        notes: description,
        origin: "automatica_da_rifornimento",
        source_action_id: null,
      });

      if (expenseInsert.error) {
        expenseInsert = await supabase.from("expenses").insert({
          expense_date: today,
          amount,
          category: "Rifornimento",
          description,
        });
      }

      if (expenseInsert.error && String(expenseInsert.error.code) === "42703" && String(expenseInsert.error.message).includes("expense_date")) {
        expenseInsert = await supabase.from("expenses").insert({
          date: today,
          amount,
          category: "Rifornimento",
          description,
        });
      }

      if (expenseInsert.error) {
        return errJson(expenseInsert.error.message, 400);
      }
    }

    await syncShoppingAction();

    return okJson({ ok: true, quantity: nextQty });
  } catch (e: unknown) {
    console.error("[POST /api/products/restock]", e);
    return errJson("Errore interno del server", 500);
  }
}
