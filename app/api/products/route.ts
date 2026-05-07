import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type ProductPatch = {
  id: string;
  quantity?: number;
  threshold?: number;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });

    if (error) return errJson(error.message, 400);
    const products = (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        id: getProductId(row, schema),
        name: String(row.name ?? ""),
        category: row.category === null || row.category === undefined ? null : String(row.category),
        unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
        quantity: getProductQuantity(row, schema),
        threshold: Number(row.threshold ?? 0) || 0,
        max_qty: row.max_qty === null || row.max_qty === undefined ? null : Number(row.max_qty),
        consumption_per_checkout:
          row.consumption_per_checkout === null || row.consumption_per_checkout === undefined
            ? null
            : Number(row.consumption_per_checkout),
        stock_status: row.stock_status === null || row.stock_status === undefined ? null : row.stock_status,
        updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
      };
    });
    return okJson({ products });
  } catch (e: unknown) {
    console.error("[GET /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { updates?: ProductPatch[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    for (const item of updates) {
      const payload: Record<string, unknown> = {};
      if (item.quantity !== undefined) payload[schema.quantityColumn] = item.quantity;
      if (item.threshold !== undefined) payload.threshold = item.threshold;
      if (Object.keys(payload).length === 0) continue;

      const { error } = await supabase.from("products").update(payload).eq(schema.idColumn, item.id);
      if (error) return errJson(error.message, 400, { item });
    }

    await syncShoppingAction();

    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}
