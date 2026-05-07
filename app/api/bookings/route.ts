import { errJson, okJson } from "@/lib/http/apiResponse";
import { scheduleBookingDomainResync } from "@/lib/booking-automation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateBookingPayload = {
  check_in: string;
  check_out: string;
  guests: number;
  channel?: string | null;
  notes?: string | null;
  total_amount?: number | string | null;
};

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

async function hasDateConflict(checkIn: string, checkOut: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    // Overlap on half-open intervals: [check_in, check_out)
    // This allows same-day turnover (existing.check_out === new.check_in).
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests, channel, notes, total_amount")
      .order("check_in", { ascending: true });

    // Backward-compatible fallback when total_amount is not present in older schemas.
    if (isMissingTotalAmountError(error)) {
      const retry = await supabase
        .from("bookings")
        .select("id, check_in, check_out, guests, channel, notes")
        .order("check_in", { ascending: true });
      data = (retry.data ?? []).map((row) => ({ ...row, total_amount: null }));
      error = retry.error;
    }

    if (error) return errJson(error.message, 400);

    const bookings = data ?? [];
    const bookingIds = bookings.map((row) => String(row.id)).filter(Boolean);
    const cleaningStatusByBookingId = new Map<string, "DA_FARE" | "FATTO" | null>();

    if (bookingIds.length > 0) {
      const { data: actionsData, error: actionsErr } = await supabase
        .from("actions")
        .select("booking_id, action_type, status")
        .in("booking_id", bookingIds);

      if (actionsErr) return errJson(actionsErr.message, 400);

      for (const row of actionsData ?? []) {
        const bookingId = row.booking_id ? String(row.booking_id) : "";
        const actionType = String(row.action_type ?? "").toUpperCase();
        const status = row.status === "FATTO" ? "FATTO" : row.status === "DA_FARE" ? "DA_FARE" : null;
        if (!bookingId || !actionType.includes("PULIZIA")) continue;
        cleaningStatusByBookingId.set(bookingId, status);
      }
    }

    return okJson({
      bookings: bookings.map((row) => ({
        ...row,
        cleaning_status: cleaningStatusByBookingId.get(String(row.id)) ?? null,
      })),
    });
  } catch (e: unknown) {
    console.error("[GET /api/bookings]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBookingPayload;
    const { check_in, check_out, guests, channel, notes, total_amount } = body;
    const parsedGuests = Number(guests);
    const parsedAmount = toAmount(total_amount);

    if (!check_in || !check_out || !parsedGuests) {
      return errJson("Missing required fields", 400);
    }
    if (!isValidIsoDate(check_in) || !isValidIsoDate(check_out)) {
      return errJson("Formato data non valido (YYYY-MM-DD)", 400);
    }
    if (check_in >= check_out) {
      return errJson("Check-out deve essere successivo al check-in", 400);
    }
    if (parsedGuests <= 0) {
      return errJson("Numero ospiti non valido", 400);
    }
    if (total_amount !== undefined && total_amount !== null && parsedAmount === null) {
      return errJson("Importo non valido", 400);
    }

    const conflict = await hasDateConflict(check_in, check_out);
    if (conflict) {
      return errJson("Esiste gia una prenotazione nello stesso giorno o in sovrapposizione", 409);
    }

    const payload = {
      check_in,
      check_out,
      guests: parsedGuests,
      channel: channel ?? null,
      notes: notes ?? null,
      total_amount: parsedAmount,
    };

    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("bookings")
      .insert(payload)
      .select("id, check_in, check_out")
      .single();

    // Backward-compatible fallback when total_amount is not present in older schemas.
    if (isMissingTotalAmountError(error)) {
      if (parsedAmount !== null) {
        return errJson("La colonna bookings.total_amount non esiste nel database. Aggiungila per salvare l'importo.", 400);
      }
      const legacyPayload: Record<string, unknown> = { ...payload };
      delete legacyPayload.total_amount;
      const retry = await supabase
        .from("bookings")
        .insert(legacyPayload)
        .select("id, check_in, check_out")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return errJson(error.message, 400);

    const bookingId = data?.id ?? null;
    if (!bookingId) {
      return errJson("Creazione prenotazione fallita", 400);
    }

    scheduleBookingDomainResync("bookings.create", { bookingId: String(bookingId) });

    return okJson({
      booking_id: bookingId,
      sync: { mode: "eventual", status: "scheduled" },
    });
  } catch (e: unknown) {
    console.error("[POST /api/bookings]", e);
    return errJson("Errore interno del server", 500);
  }
}
