import { NextResponse } from "next/server";
import { applyActionStatusEffects, type CleaningCompletion } from "@/lib/action-effects";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionStatus } from "@/types/db";

type PatchActionPayload =
  | { id: string; status: ActionStatus; completion?: CleaningCompletion }
  | { date: string; status?: ActionStatus; onlyPending?: boolean };

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const bookingId = searchParams.get("bookingId");

    try {
      await syncShoppingAction();
    } catch (syncErr: unknown) {
      console.error("Non-blocking shopping sync failed in actions GET", syncErr);
    }

    const supabase = supabaseAdmin();
    let q = supabase
      .from("actions")
      .select("id, booking_id, action_date, action_type, status, details, amount, created_at")
      .order("action_date", { ascending: true });

    if (from) q = q.gte("action_date", from);
    if (to) q = q.lte("action_date", to);
    if (bookingId) q = q.eq("booking_id", bookingId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ actions: data ?? [] }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as PatchActionPayload;
    const supabase = supabaseAdmin();

    if ("id" in body) {
      if (!body.id || !body.status) {
        return NextResponse.json({ error: "Missing id/status" }, { status: 400 });
      }

      const patch: Record<string, unknown> = { status: body.status };
      const completedAmount = Number(body.completion?.amount ?? NaN);
      if (Number.isFinite(completedAmount) && completedAmount > 0) {
        patch.amount = completedAmount;
      }

      const { error } = await supabase.from("actions").update(patch).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await applyActionStatusEffects(body.id, body.status, body.completion);

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!body.date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    let updateQuery = supabase
      .from("actions")
      .update({ status: body.status ?? "FATTO" })
      .eq("action_date", body.date);

    if (body.onlyPending !== false) {
      updateQuery = updateQuery.eq("status", "DA_FARE");
    }

    const { error } = await updateQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
