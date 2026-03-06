import { NextResponse } from "next/server";
import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";
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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const products = (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        ...row,
        id: getProductId(row, schema),
        quantity: getProductQuantity(row, schema),
      };
    });
    return NextResponse.json({ products }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { updates?: ProductPatch[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Missing updates[]" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    for (const item of updates) {
      const payload: Record<string, unknown> = {};
      if (item.quantity !== undefined) payload[schema.quantityColumn] = item.quantity;
      if (item.threshold !== undefined) payload.threshold = item.threshold;
      if (Object.keys(payload).length === 0) continue;

      const { error } = await supabase.from("products").update(payload).eq(schema.idColumn, item.id);
      if (error) return NextResponse.json({ error: error.message, item }, { status: 400 });
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
