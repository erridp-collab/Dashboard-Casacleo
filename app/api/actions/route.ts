import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionStatus } from "@/types/db";

type CleaningCompletion = {
  mode?: "SELF" | "EXTERNAL";
  external_amount?: number | null;
  note?: string | null;
};

type PatchActionPayload =
  | { id: string; status: ActionStatus; completion?: CleaningCompletion }
  | { date: string; status?: ActionStatus; onlyPending?: boolean };

function isCleaningAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("PULIZIA");
}

async function upsertCleaningExpense(
  actionId: string,
  actionDate: string,
  amount: number,
  note?: string | null,
) {
  const supabase = supabaseAdmin();
  const description = note?.trim()
    ? `Pulizia esterna - ${note.trim()}`
    : "Pulizia esterna";

  const payload = {
    expense_date: actionDate,
    amount,
    category: "Pulizie",
    description,
    notes: description,
    origin: "automatica_da_pulizia",
    source_action_id: actionId,
  };

  const existing = await supabase
    .from("expenses")
    .select("id")
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const update = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", existing.data.id);
    if (!update.error) return;
  }

  let insert = await supabase.from("expenses").insert(payload);
  if (!insert.error) return;

  // Fallback for older schemas without origin/source_action_id/description columns.
  insert = await supabase.from("expenses").insert({
    expense_date: actionDate,
    amount,
    category: "Pulizie",
    notes: description,
  });
  if (insert.error) throw new Error(insert.error.message);
}

async function deleteCleaningExpense(actionId: string) {
  const supabase = supabaseAdmin();
  const directDelete = await supabase
    .from("expenses")
    .delete()
    .eq("source_action_id", actionId)
    .eq("origin", "automatica_da_pulizia");
  if (!directDelete.error) return;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const bookingId = searchParams.get("bookingId");

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

      const { data: actionRow, error: actionErr } = await supabase
        .from("actions")
        .select("id, action_type, action_date")
        .eq("id", body.id)
        .maybeSingle();
      if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 400 });
      if (!actionRow) return NextResponse.json({ error: "Action not found" }, { status: 404 });

      const { error } = await supabase.from("actions").update({ status: body.status }).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if (isCleaningAction(String(actionRow.action_type))) {
        if (body.status === "FATTO") {
          const mode = body.completion?.mode ?? "SELF";
          const amount = Number(body.completion?.external_amount ?? 0);
          if (mode === "EXTERNAL" && Number.isFinite(amount) && amount > 0) {
            await upsertCleaningExpense(body.id, String(actionRow.action_date), amount, body.completion?.note);
          }
        }
        if (body.status === "DA_FARE") {
          await deleteCleaningExpense(body.id);
        }
      }

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
