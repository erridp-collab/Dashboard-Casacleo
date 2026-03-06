import { NextResponse } from "next/server";
import { applyActionStatusEffects } from "@/lib/action-effects";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PatchChecklistPayload = {
  id: string;
  done: boolean;
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as PatchChecklistPayload;
    if (!body.id || typeof body.done !== "boolean") {
      return NextResponse.json({ error: "Missing id/done" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: itemRow, error: findErr } = await supabase
      .from("action_checklist")
      .select("id, action_id")
      .eq("id", body.id)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });
    if (!itemRow) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

    const { error } = await supabase
      .from("action_checklist")
      .update({ done: body.done })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: rows, error: rowsErr } = await supabase
      .from("action_checklist")
      .select("done")
      .eq("action_id", itemRow.action_id);
    if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 400 });

    const allDone = (rows ?? []).length > 0 && (rows ?? []).every((row) => Boolean(row.done));
    const nextStatus = allDone ? "FATTO" : "DA_FARE";

    const { error: actionErr } = await supabase
      .from("actions")
      .update({ status: nextStatus })
      .eq("id", itemRow.action_id);
    if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 400 });

    await applyActionStatusEffects(String(itemRow.action_id), nextStatus);

    return NextResponse.json(
      { ok: true, action_id: String(itemRow.action_id), next_status: nextStatus },
      { status: 200 },
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
