import { errJson, okJson } from "@/lib/http/apiResponse";
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
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    for (const item of updates) {
      if (!item.id || !["PIENO", "A_META", "TERMINATO"].includes(item.stock_status)) {
        return errJson(`Valore non valido per ${item.id}`, 400);
      }
      const { error } = await supabase
        .from("products")
        .update({ stock_status: item.stock_status })
        .eq(schema.idColumn, item.id);
      if (error) return errJson(error.message, 400);
    }

    await syncShoppingAction();

    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products/stock-status]", e);
    return errJson("Errore interno del server", 500);
  }
}
