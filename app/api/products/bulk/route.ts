import { errJson, okJson } from "@/lib/http/apiResponse";
import { requireRouteContext } from "@/lib/routeAuth";
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
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as { updates?: ProductBulkUpdate[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();

    const normalized: Record<string, unknown>[] = [];

    for (const item of updates) {
      if (!item?.id) {
        return errJson("Missing product id", 400, { item });
      }

      const payload: Record<string, unknown> = { id: item.id };
      let hasUpdates = false;

      if (item.quantity !== undefined) {
        if (!isFiniteNumber(item.quantity)) {
          return errJson("Invalid quantity", 400, { item });
        }
        payload.quantity = item.quantity;
        hasUpdates = true;
      }

      if (item.threshold !== undefined) {
        if (!isFiniteNumber(item.threshold)) {
          return errJson("Invalid threshold", 400, { item });
        }
        payload.threshold = item.threshold;
        hasUpdates = true;
      }

      if (item.max_qty !== undefined) {
        if (item.max_qty !== null && !isFiniteNumber(item.max_qty)) {
          return errJson("Invalid max_qty", 400, { item });
        }
        payload.max_qty = item.max_qty;
        hasUpdates = true;
      }

      if (item.consumption_per_checkout !== undefined) {
        if (
          item.consumption_per_checkout !== null &&
          !isFiniteNumber(item.consumption_per_checkout)
        ) {
          return errJson("Invalid consumption_per_checkout", 400, { item });
        }
        payload.consumption_per_checkout = item.consumption_per_checkout;
        hasUpdates = true;
      }

      if (hasUpdates) {
        normalized.push(payload);
      }
    }

    if (normalized.length > 0) {
      const { error } = await supabase.rpc("bulk_update_products", {
        p_updates: normalized,
        p_organization_id: organizationId,
      });
      if (error) return errJson(error.message, 400);
    }

    await syncShoppingAction(organizationId);

    return okJson({ ok: true, updated: updates.length });
  } catch (e: unknown) {
    console.error("[PUT /api/products/bulk]", e);
    return errJson("Errore interno del server", 500);
  }
}
