import { errJson, okJson } from "@/lib/http/apiResponse";
import { resolveProductSchema } from "@/lib/products-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type ProductBulkUpdate = {
  id: string;
  quantity?: number;
  threshold?: number;
  max_qty?: number | null;
  consumption_per_checkout?: number | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { updates?: ProductBulkUpdate[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    for (const item of updates) {
      if (!item?.id) {
        return errJson("Missing product id", 400, { item });
      }

      const payload: Record<string, unknown> = {};

      if (item.quantity !== undefined) {
        if (!isFiniteNumber(item.quantity)) {
          return errJson("Invalid quantity", 400, { item });
        }
        payload[schema.quantityColumn] = item.quantity;
      }

      if (item.threshold !== undefined) {
        if (!isFiniteNumber(item.threshold)) {
          return errJson("Invalid threshold", 400, { item });
        }
        payload.threshold = item.threshold;
      }

      if (item.max_qty !== undefined) {
        if (item.max_qty !== null && !isFiniteNumber(item.max_qty)) {
          return errJson("Invalid max_qty", 400, { item });
        }
        payload.max_qty = item.max_qty;
      }

      if (item.consumption_per_checkout !== undefined) {
        if (
          item.consumption_per_checkout !== null &&
          !isFiniteNumber(item.consumption_per_checkout)
        ) {
          return errJson("Invalid consumption_per_checkout", 400, { item });
        }
        payload.consumption_per_checkout = item.consumption_per_checkout;
      }

      if (Object.keys(payload).length === 0) continue;

      const { error } = await supabase.from("products").update(payload).eq(schema.idColumn, item.id);
      if (error) return errJson(error.message, 400, { item });
    }

    await syncShoppingAction();

    return okJson({ ok: true, updated: updates.length });
  } catch (e: unknown) {
    console.error("[PUT /api/products/bulk]", e);
    return errJson("Errore interno del server", 500);
  }
}
