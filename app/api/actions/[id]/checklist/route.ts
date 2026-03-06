import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing action id" }, { status: 400 });

    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("action_checklist")
      .select("*")
      .eq("action_id", id)
      .order("sort_order", { ascending: true });

    // Backward-compatible fallback for schemas without sort_order.
    if (error?.code === "42703" && error.message.includes("sort_order")) {
      const retry = await supabase
        .from("action_checklist")
        .select("*")
        .eq("action_id", id);
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const checklist = (data ?? []).map((row) => ({
      id: row.id,
      action_id: row.action_id,
      label: row.label ?? row.item_text ?? row.item ?? "Checklist item",
      done: Boolean(row.done),
      sort_order: row.sort_order ?? null,
      created_at: row.created_at ?? null,
    }));
    return NextResponse.json({ checklist }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
