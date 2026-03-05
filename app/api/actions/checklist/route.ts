import { NextResponse } from "next/server";
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
    const { error } = await supabase
      .from("action_checklist")
      .update({ done: body.done })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

