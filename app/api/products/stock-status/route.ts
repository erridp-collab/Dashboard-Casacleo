import { NextResponse } from "next/server";
import { resolveProductSchema } from "@/lib/products-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type StockStatusPayload = {
  updates: { id: string; stock_status: "PIENO" | "A_META" | "TERMINATO" }[];
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as StockStatusPayload;
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Missing updates[]" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    for (const item of updates) {
      if (!item.id || !["PIENO", "A_META", "TERMINATO"].includes(item.stock_status)) {
        return NextResponse.json({ error: `Valore non valido per ${item.id}` }, { status: 400 });
      }
      const { error } = await supabase
        .from("products")
        .update({ stock_status: item.stock_status })
        .eq(schema.idColumn, item.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await syncShoppingAction();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
