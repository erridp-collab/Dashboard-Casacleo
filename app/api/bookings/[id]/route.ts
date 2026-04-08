import { NextResponse } from "next/server";
import { syncBookingAutomations } from "@/lib/booking-automation";
import { applyLinenConsumptionDelta } from "@/lib/action-effects";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateBookingPayload = {
  check_in?: string;
  check_out?: string;
  guests?: number;
  channel?: string | null;
  notes?: string | null;
  total_amount?: number | string | null;
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDbError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  const details = [error.message, error.code && `code=${error.code}`, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");
  return details || "Database error";
}

function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidIsoDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isMissingTotalAmountError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    String(error.message ?? "").includes("total_amount")
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    if (!UUID_LIKE.test(id)) {
      return NextResponse.json({ error: "Invalid booking id format" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests, channel, notes, total_amount, created_at")
      .eq("id", id)
      .maybeSingle();

    if (isMissingTotalAmountError(error)) {
      const retry = await supabase
        .from("bookings")
        .select("id, check_in, check_out, guests, channel, notes, created_at")
        .eq("id", id)
        .maybeSingle();
      data = retry.data ? { ...retry.data, total_amount: null } : retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: formatDbError(error) }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json({ booking: data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    if (!UUID_LIKE.test(id)) {
      return NextResponse.json({ error: "Invalid booking id format" }, { status: 400 });
    }

    const body = (await req.json()) as UpdateBookingPayload;
    const updates: Record<string, unknown> = {};
    const supabase = supabaseAdmin();

    // Fetch current booking and validate body fields (no DB needed) before any query.
    if (body.total_amount !== undefined) {
      const amount = toAmount(body.total_amount);
      if (body.total_amount !== null && body.total_amount !== "" && amount === null) {
        return NextResponse.json({ error: "Importo non valido" }, { status: 400 });
      }
      updates.total_amount = amount;
    }
    if (body.check_in !== undefined) updates.check_in = body.check_in;
    if (body.check_out !== undefined) updates.check_out = body.check_out;
    if (body.guests !== undefined) updates.guests = body.guests;
    if (body.channel !== undefined) updates.channel = body.channel;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    // Fetch current booking first — need it to resolve final check_in/out/guests.
    const { data: current, error: currentErr } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) return NextResponse.json({ error: formatDbError(currentErr) }, { status: 400 });
    if (!current) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const nextCheckIn = String(body.check_in ?? current.check_in);
    const nextCheckOut = String(body.check_out ?? current.check_out);
    const nextGuests = Number(body.guests ?? current.guests);

    if (!isValidIsoDate(nextCheckIn) || !isValidIsoDate(nextCheckOut)) {
      return NextResponse.json({ error: "Formato data non valido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (nextCheckIn >= nextCheckOut) {
      return NextResponse.json({ error: "Check-out deve essere successivo al check-in" }, { status: 400 });
    }
    if (!Number.isFinite(nextGuests) || nextGuests <= 0) {
      return NextResponse.json({ error: "Numero ospiti non valido" }, { status: 400 });
    }

    // Half-open interval [check_in, check_out) — allows same-day turnover.
    const { data: conflictRows, error: conflictErr } = await supabase
      .from("bookings")
      .select("id")
      .neq("id", id)
      .lt("check_in", nextCheckOut)
      .gt("check_out", nextCheckIn)
      .limit(1);

    if (conflictErr) return NextResponse.json({ error: formatDbError(conflictErr) }, { status: 400 });
    if ((conflictRows ?? []).length > 0) {
      return NextResponse.json(
        { error: "Esiste gia una prenotazione nello stesso giorno o in sovrapposizione" },
        { status: 409 },
      );
    }

    let { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select("id, check_in, check_out, guests, channel, notes, total_amount, created_at")
      .maybeSingle();

    // Backward-compatible fallback when total_amount is not present in older schemas.
    if (isMissingTotalAmountError(error)) {
      if (updates.total_amount !== undefined && updates.total_amount !== null) {
        return NextResponse.json(
          { error: "La colonna bookings.total_amount non esiste nel database. Aggiungila per salvare l'importo." },
          { status: 400 },
        );
      }
      const retryUpdates = { ...updates };
      delete retryUpdates.total_amount;
      const retry = await supabase
        .from("bookings")
        .update(retryUpdates)
        .eq("id", id)
        .select("id, check_in, check_out, guests, channel, notes, created_at")
        .maybeSingle();

      data = retry.data ? { ...retry.data, total_amount: null } : retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: formatDbError(error) }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    // Fire-and-forget: run in background, don't block the response.
    void syncBookingAutomations()
      .catch((err: unknown) => console.error("Booking update automation sync failed", err));

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
    if (!UUID_LIKE.test(id)) {
      return NextResponse.json({ error: "Invalid booking id format" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: bookingRow, error: bookingFindErr } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests")
      .eq("id", id)
      .maybeSingle();
    if (bookingFindErr) return NextResponse.json({ error: formatDbError(bookingFindErr) }, { status: 400 });
    if (!bookingRow) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const { data: actionRows, error: actionErr } = await supabase
      .from("actions")
      .select("id, action_type, status, details")
      .eq("booking_id", id);

    if (actionErr) return NextResponse.json({ error: formatDbError(actionErr) }, { status: 400 });

    const actionIds = (actionRows ?? []).map((r) => r.id).filter(Boolean);

    const linenActions = (actionRows ?? []).filter((row) => {
      const type = String(row.action_type ?? "").toUpperCase();
      return type.includes("BIANCHERIA") && String(row.status ?? "").toUpperCase() === "FATTO" && row.details;
    });

    for (const row of linenActions) {
      try {
        const parsed = JSON.parse(String(row.details)) as { linen?: Record<string, unknown> };
        if (parsed?.linen) {
          await applyLinenConsumptionDelta(parsed.linen as Record<string, unknown>, -1);
        }
      } catch {
        // ignore parse errors
      }
    }

    if (actionIds.length > 0) {
      const { error: checklistErr } = await supabase
        .from("action_checklist")
        .delete()
        .in("action_id", actionIds);
      if (checklistErr) return NextResponse.json({ error: formatDbError(checklistErr) }, { status: 400 });

      const { error: actionsDeleteErr } = await supabase.from("actions").delete().eq("booking_id", id);
      if (actionsDeleteErr) {
        return NextResponse.json({ error: formatDbError(actionsDeleteErr) }, { status: 400 });
      }
    }

    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return NextResponse.json({ error: formatDbError(error) }, { status: 400 });

    // Fire-and-forget: run in background, don't block the response.
    void syncBookingAutomations()
      .catch((err: unknown) => console.error("Booking delete automation sync failed", err));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
