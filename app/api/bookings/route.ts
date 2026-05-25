import { errJson, okJson } from "@/lib/http/apiResponse";
import { scheduleBookingDomainResync } from "@/lib/booking-automation";
import { requireRouteContext } from "@/lib/routeAuth";
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

async function hasDateConflict(checkIn: string, checkOut: string, organizationId: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("organization_id", organizationId)
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
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests, channel, notes, total_amount")
      .eq("organization_id", organizationId)
      .order("check_in", { ascending: true });

    if (error) {
      console.error("[GET /api/bookings] db error", error);
      return errJson("Errore nel recupero delle prenotazioni", 400);
    }

    const bookings = data ?? [];
    const bookingIds = bookings.map((row) => String(row.id)).filter(Boolean);
    const cleaningStatusByBookingId = new Map<string, "DA_FARE" | "FATTO" | null>();

    if (bookingIds.length > 0) {
      const { data: actionsData, error: actionsErr } = await supabase
        .from("actions")
        .select("booking_id, action_type, status")
        .eq("organization_id", organizationId)
        .in("booking_id", bookingIds);

      if (actionsErr) {
        console.error("[GET /api/bookings] actions db error", actionsErr);
        return errJson("Errore nel recupero dello stato pulizie", 400);
      }

      for (const row of actionsData ?? []) {
        const bookingId = row.booking_id ? String(row.booking_id) : "";
        const actionType = String(row.action_type ?? "").toUpperCase();
        const status = row.status === "FATTO" ? "FATTO" : row.status === "DA_FARE" ? "DA_FARE" : null;
        if (!bookingId || !actionType.includes("PULIZIA")) continue;
        cleaningStatusByBookingId.set(bookingId, status);
      }
    }

    return okJson({
      bookings: bookings.map((row: Record<string, unknown>) => ({
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
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

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

    const conflict = await hasDateConflict(check_in, check_out, organizationId);
    if (conflict) {
      return errJson("Esiste gia una prenotazione nello stesso giorno o in sovrapposizione", 409);
    }

    const payload = {
      organization_id: organizationId,
      check_in,
      check_out,
      guests: parsedGuests,
      channel: channel ?? null,
      notes: notes ?? null,
      total_amount: parsedAmount,
    };

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .insert(payload)
      .select("id, check_in, check_out")
      .single();

    if (error) {
      if (String(error.code) === "23P01" || String(error.code) === "23505") {
        return errJson("Esiste gia una prenotazione nello stesso giorno o in sovrapposizione", 409);
      }
      console.error("[POST /api/bookings] db error", error);
      return errJson("Errore nel salvataggio della prenotazione", 400);
    }

    const bookingId = data?.id ?? null;
    if (!bookingId) {
      return errJson("Creazione prenotazione fallita", 400);
    }

    scheduleBookingDomainResync("bookings.create", { bookingId: String(bookingId) }, organizationId);

    return okJson({
      booking_id: bookingId,
      sync: { mode: "eventual", status: "scheduled" },
    });
  } catch (e: unknown) {
    console.error("[POST /api/bookings]", e);
    return errJson("Errore interno del server", 500);
  }
}
