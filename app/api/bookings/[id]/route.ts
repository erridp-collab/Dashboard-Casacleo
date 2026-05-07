import { errJson, okJson } from "@/lib/http/apiResponse";
import { scheduleBookingDomainResync } from "@/lib/booking-automation";
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
const LINEN_KEYS = [
  "sets_estivo",
  "sets_invernale",
  "towels_bidet",
  "towels_viso",
  "towels_doccia",
  "tappetino",
  "mappine",
  "carta_igienica",
  "spugne_piatti",
] as const;

type LinenKey = typeof LINEN_KEYS[number];
type LinenRestore = Partial<Record<LinenKey, number>>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseLinenRestore(details: string): { ok: true; linen: LinenRestore | null } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(details);
  } catch {
    return { ok: false, error: "details non è JSON valido" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "details deve essere un oggetto JSON" };
  }

  const source = isRecord(parsed.linen_applied)
    ? parsed.linen_applied
    : isRecord(parsed.linen)
      ? parsed.linen
      : null;

  if (!source) return { ok: true, linen: null };

  const normalized: LinenRestore = {};
  for (const key of LINEN_KEYS) {
    const raw = source[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) {
      return { ok: false, error: `valore non valido per ${key}` };
    }
    if (qty > 0) {
      normalized[key] = Number(qty.toFixed(2));
    }
  }

  return { ok: true, linen: Object.keys(normalized).length > 0 ? normalized : null };
}

function accumulateLinenRestore(target: LinenRestore, linen: LinenRestore): LinenRestore {
  for (const key of LINEN_KEYS) {
    const next = Number(linen[key] ?? 0);
    if (next <= 0) continue;
    target[key] = Number(((target[key] ?? 0) + next).toFixed(2));
  }
  return target;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return errJson("Missing booking id", 400);
    if (!UUID_LIKE.test(id)) {
      return errJson("Invalid booking id format", 400);
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

    if (error) return errJson(formatDbError(error), 400);
    if (!data) return errJson("Booking not found", 404);
    return okJson({ booking: data });
  } catch (e: unknown) {
    console.error("[GET /api/bookings/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return errJson("Missing booking id", 400);
    if (!UUID_LIKE.test(id)) {
      return errJson("Invalid booking id format", 400);
    }

    const body = (await req.json()) as UpdateBookingPayload;
    const updates: Record<string, unknown> = {};
    const supabase = supabaseAdmin();

    // Fetch current booking and validate body fields (no DB needed) before any query.
    if (body.total_amount !== undefined) {
      const amount = toAmount(body.total_amount);
      if (body.total_amount !== null && body.total_amount !== "" && amount === null) {
        return errJson("Importo non valido", 400);
      }
      updates.total_amount = amount;
    }
    if (body.check_in !== undefined) updates.check_in = body.check_in;
    if (body.check_out !== undefined) updates.check_out = body.check_out;
    if (body.guests !== undefined) updates.guests = body.guests;
    if (body.channel !== undefined) updates.channel = body.channel;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return errJson("No updates provided", 400);
    }

    // Fetch current booking first — need it to resolve final check_in/out/guests.
    const { data: current, error: currentErr } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) return errJson(formatDbError(currentErr), 400);
    if (!current) return errJson("Booking not found", 404);

    const nextCheckIn = String(body.check_in ?? current.check_in);
    const nextCheckOut = String(body.check_out ?? current.check_out);
    const nextGuests = Number(body.guests ?? current.guests);

    if (!isValidIsoDate(nextCheckIn) || !isValidIsoDate(nextCheckOut)) {
      return errJson("Formato data non valido (YYYY-MM-DD)", 400);
    }
    if (nextCheckIn >= nextCheckOut) {
      return errJson("Check-out deve essere successivo al check-in", 400);
    }
    if (!Number.isFinite(nextGuests) || nextGuests <= 0) {
      return errJson("Numero ospiti non valido", 400);
    }

    // Half-open interval [check_in, check_out) — allows same-day turnover.
    const { data: conflictRows, error: conflictErr } = await supabase
      .from("bookings")
      .select("id")
      .neq("id", id)
      .lt("check_in", nextCheckOut)
      .gt("check_out", nextCheckIn)
      .limit(1);

    if (conflictErr) return errJson(formatDbError(conflictErr), 400);
    if ((conflictRows ?? []).length > 0) {
      return errJson("Esiste gia una prenotazione nello stesso giorno o in sovrapposizione", 409);
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
        return errJson("La colonna bookings.total_amount non esiste nel database. Aggiungila per salvare l'importo.", 400);
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

    if (error) return errJson(formatDbError(error), 400);
    if (!data) return errJson("Booking not found", 404);

    scheduleBookingDomainResync("bookings.update", { bookingId: id });

    return okJson({
      booking: data,
      sync: { mode: "eventual", status: "scheduled" },
    });
  } catch (e: unknown) {
    console.error("[PATCH /api/bookings/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return errJson("Missing booking id", 400);
    if (!UUID_LIKE.test(id)) {
      return errJson("Invalid booking id format", 400);
    }

    const supabase = supabaseAdmin();
    const { data: bookingRow, error: bookingFindErr } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests")
      .eq("id", id)
      .maybeSingle();
    if (bookingFindErr) return errJson(formatDbError(bookingFindErr), 400);
    if (!bookingRow) return errJson("Booking not found", 404);

    const { data: actionRows, error: actionErr } = await supabase
      .from("actions")
      .select("id, action_type, status, details")
      .eq("booking_id", id);

    if (actionErr) return errJson(formatDbError(actionErr), 400);

    const linenActions = (actionRows ?? []).filter((row) => {
      const type = String(row.action_type ?? "").toUpperCase();
      return type.includes("BIANCHERIA") && String(row.status ?? "").toUpperCase() === "FATTO" && row.details;
    });

    const linenRestoreTotals: LinenRestore = {};
    for (const row of linenActions) {
      const parsed = parseLinenRestore(String(row.details));
      if (!parsed.ok) {
        console.error("[DELETE /api/bookings/[id]] invalid BIANCHERIA details", {
          bookingId: id,
          actionId: String(row.id ?? ""),
          error: parsed.error,
        });
        return errJson("Dettagli biancheria non validi: impossibile eliminare la prenotazione in sicurezza", 409);
      }
      if (parsed.linen) {
        accumulateLinenRestore(linenRestoreTotals, parsed.linen);
      }
    }

    const { error } = await supabase.rpc("delete_booking_atomic", {
      p_booking_id: id,
      p_linen_restore: linenRestoreTotals,
    });
    if (error) return errJson(formatDbError(error), 400);

    scheduleBookingDomainResync("bookings.delete", { bookingId: id });

    return okJson({
      ok: true,
      sync: { mode: "eventual", status: "scheduled" },
    });
  } catch (e: unknown) {
    console.error("[DELETE /api/bookings/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}
