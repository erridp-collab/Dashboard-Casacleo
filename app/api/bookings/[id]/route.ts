import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateBookingPayload = {
  check_in?: string;
  check_out?: string;
  guests?: number;
  channel?: string | null;
  notes?: string | null;
  total_amount?: number | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });

    const body = (await req.json()) as UpdateBookingPayload;
    const updates: Record<string, unknown> = {};

    if (body.check_in !== undefined) updates.check_in = body.check_in;
    if (body.check_out !== undefined) updates.check_out = body.check_out;
    if (body.guests !== undefined) updates.guests = body.guests;
    if (body.channel !== undefined) updates.channel = body.channel;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.total_amount !== undefined) updates.total_amount = body.total_amount;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select("id, check_in, check_out, guests, channel, notes, total_amount, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ booking: data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: actionRows, error: actionErr } = await supabase
      .from("actions")
      .select("id")
      .eq("booking_id", id);

    if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 400 });

    const actionIds = (actionRows ?? []).map((r) => r.id).filter(Boolean);

    if (actionIds.length > 0) {
      const { error: checklistErr } = await supabase
        .from("action_checklist")
        .delete()
        .in("action_id", actionIds);
      if (checklistErr) return NextResponse.json({ error: checklistErr.message }, { status: 400 });

      const { error: actionsDeleteErr } = await supabase.from("actions").delete().eq("booking_id", id);
      if (actionsDeleteErr) {
        return NextResponse.json({ error: actionsDeleteErr.message }, { status: 400 });
      }
    }

    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

