import { NextResponse } from "next/server";
import { resolveProductSchema } from "@/lib/products-schema";
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

    if (!body.id) return NextResponse.json({ error: "Missing product id" }, { status: 400 });
    if (!Number.isFinite(addQuantity) || addQuantity <= 0) {
      return NextResponse.json({ error: "Quantita rifornimento non valida" }, { status: 400 });
    }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      return NextResponse.json({ error: "Importo rifornimento non valido" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    const { data: row, error: findErr } = await supabase
      .from("products")
      .select(`${schema.idColumn}, ${schema.quantityColumn}, name, category`)
      .eq(schema.idColumn, body.id)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });
    if (!row) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const currentQty = toNumber((row as Record<string, unknown>)[schema.quantityColumn], 0);
    const nextQty = Number((currentQty + addQuantity).toFixed(2));

    const rowData = row as Record<string, unknown>;
    const isCleaningProduct = typeof rowData.category === "string" && rowData.category.toLowerCase().includes("pulizia");
    const updatePayload: Record<string, unknown> = { [schema.quantityColumn]: nextQty };
    if (isCleaningProduct) updatePayload.stock_status = "PIENO";

    const { error: updateErr } = await supabase
      .from("products")
      .update(updatePayload)
      .eq(schema.idColumn, body.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    if (amount !== null) {
      const description = body.note?.trim()
        ? `Rifornimento ${(row as Record<string, unknown>).name ?? ""} - ${body.note.trim()}`
        : `Rifornimento ${(row as Record<string, unknown>).name ?? ""}`;

      const today = new Date().toISOString().slice(0, 10);
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
        return NextResponse.json({ error: expenseInsert.error.message }, { status: 400 });
      }
    }

    await syncShoppingAction();

    return NextResponse.json({ ok: true, quantity: nextQty }, { status: 200 });
  } catch (e: unknown) {
    console.error("[POST /api/products/restock]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
