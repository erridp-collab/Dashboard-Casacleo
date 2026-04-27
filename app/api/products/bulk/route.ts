import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Missing updates[]" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    for (const item of updates) {
      if (!item?.id) {
        return NextResponse.json({ error: "Missing product id", item }, { status: 400 });
      }

      const payload: Record<string, unknown> = {};

      if (item.quantity !== undefined) {
        if (!isFiniteNumber(item.quantity)) {
          return NextResponse.json({ error: "Invalid quantity", item }, { status: 400 });
        }
        payload[schema.quantityColumn] = item.quantity;
      }

      if (item.threshold !== undefined) {
        if (!isFiniteNumber(item.threshold)) {
          return NextResponse.json({ error: "Invalid threshold", item }, { status: 400 });
        }
        payload.threshold = item.threshold;
      }

      if (item.max_qty !== undefined) {
        if (item.max_qty !== null && !isFiniteNumber(item.max_qty)) {
          return NextResponse.json({ error: "Invalid max_qty", item }, { status: 400 });
        }
        payload.max_qty = item.max_qty;
      }

      if (item.consumption_per_checkout !== undefined) {
        if (
          item.consumption_per_checkout !== null &&
          !isFiniteNumber(item.consumption_per_checkout)
        ) {
          return NextResponse.json(
            { error: "Invalid consumption_per_checkout", item },
            { status: 400 },
          );
        }
        payload.consumption_per_checkout = item.consumption_per_checkout;
      }

      if (Object.keys(payload).length === 0) continue;

      const { error } = await supabase.from("products").update(payload).eq(schema.idColumn, item.id);
      if (error) return NextResponse.json({ error: error.message, item }, { status: 400 });
    }

    await syncShoppingAction();

    return NextResponse.json({ ok: true, updated: updates.length }, { status: 200 });
  } catch (e: unknown) {
    console.error("[PUT /api/products/bulk]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
