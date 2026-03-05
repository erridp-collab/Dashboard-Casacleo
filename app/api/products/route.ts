import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProductPatch = {
  id: string;
  quantity?: number;
  threshold?: number;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ products: data ?? [] }, { status: 200 });
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
    for (const item of updates) {
      const payload: Record<string, unknown> = {};
      if (item.quantity !== undefined) payload.quantity = item.quantity;
      if (item.threshold !== undefined) payload.threshold = item.threshold;
      if (Object.keys(payload).length === 0) continue;

      const { error } = await supabase.from("products").update(payload).eq("id", item.id);
      if (error) return NextResponse.json({ error: error.message, item }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
