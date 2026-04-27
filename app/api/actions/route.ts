import { NextResponse } from "next/server";
import { applyActionStatusEffects, type CleaningCompletion } from "@/lib/action-effects";
import { syncShoppingAction } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionStatus } from "@/types/db";

type PatchActionPayload =
  | { id: string; status: ActionStatus; completion?: CleaningCompletion }
  | { date: string; status?: ActionStatus; onlyPending?: boolean };

type PostActionPayload = {
  action_type: string;
  action_date: string;
  details?: string;
  status?: ActionStatus;
  booking_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostActionPayload;
    if (!body.action_type || !body.action_date) {
      return NextResponse.json({ error: "Missing action_type or action_date" }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("actions")
      .insert({
        action_type: body.action_type,
        action_date: body.action_date,
        details: body.details ?? null,
        status: body.status ?? "DA_FARE",
        booking_id: body.booking_id ?? null,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data?.id }, { status: 201 });
  } catch (e: unknown) {
    console.error("[POST /api/actions]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

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
      .select("id, booking_id, action_date, action_type, status, details, amount")
      .order("action_date", { ascending: true });

    if (from) q = q.gte("action_date", from);
    if (to) q = q.lte("action_date", to);
    if (bookingId) q = q.eq("booking_id", bookingId);

    let { data, error } = await q;

    if (error && String(error.code) === "42703") {
      let retryQ = supabase
        .from("actions")
        .select("id, booking_id, action_date, action_type, status, details")
        .order("action_date", { ascending: true });
      if (from) retryQ = retryQ.gte("action_date", from);
      if (to) retryQ = retryQ.lte("action_date", to);
      if (bookingId) retryQ = retryQ.eq("booking_id", bookingId);
      const retry = await retryQ;
      data = (retry.data ?? []).map((row) => ({ ...row, amount: null }));
      error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ actions: data ?? [] }, { status: 200 });
  } catch (e: unknown) {
    console.error("[GET /api/actions]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
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

      if (body.completion?.linen || body.completion?.laundry) {
        const { data: actionRow, error: actionErr } = await supabase
          .from("actions")
          .select("id, action_type")
          .eq("id", body.id)
          .maybeSingle();
        if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 400 });
        const actionType = String(actionRow?.action_type ?? "").toUpperCase();
        if (actionRow && actionType.includes("BIANCHERIA") && body.completion?.linen) {
          patch.details = JSON.stringify({ linen: body.completion.linen });
        }
        if (actionRow && actionType.includes("LAVATRICI") && body.completion?.laundry) {
          patch.details = JSON.stringify({ laundry: body.completion.laundry });
        }
      }

      const { error } = await supabase.from("actions").update(patch).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Fire-and-forget side effects (expenses, stock) — never crash the response.
      void applyActionStatusEffects(body.id, body.status, body.completion).catch(
        (err: unknown) => console.error("applyActionStatusEffects failed", err),
      );

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
    console.error("[PATCH /api/actions]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
