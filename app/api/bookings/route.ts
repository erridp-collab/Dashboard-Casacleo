import { errJson, okJson } from "@/lib/http/apiResponse";
import { scheduleBookingDomainResync } from "@/lib/booking-automation";
import { BOOKING_SELECT, BOOKING_WITH_ACTIONS_SELECT, bookingWithCleaningStatus } from "@/lib/data/bookings";
import { requireRouteContext } from "@/lib/routeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { attachRouteTiming, navigationId, requestId } from "@/lib/timing/requestTiming";
import { timed, type TimingEntry } from "@/lib/timing/serverTiming";

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

export async function GET(req: Request) {
  const startedAt = performance.now();
  const reqId = requestId(req);
  const navId = navigationId(req);
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;
    const phases: TimingEntry[] = [...auth.timing];

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const includeCleaningStatus = searchParams.get("includeCleaningStatus") !== "false";
    if (from && !isValidIsoDate(from)) {
      return errJson("Formato data non valido (YYYY-MM-DD)", 400);
    }

    const supabase = supabaseAdmin();
    let bookings;

    if (includeCleaningStatus) {
      const { data, error } = await timed(phases, "db-bookings-with-cleaning", () => {
        let query = supabase
          .from("bookings")
          .select(BOOKING_WITH_ACTIONS_SELECT)
          .eq("organization_id", organizationId)
          .eq("actions.organization_id", organizationId)
          .order("check_in", { ascending: true });
        if (from) query = query.gte("check_out", from);
        return query;
      });

      if (error) {
        console.error("[GET /api/bookings] db error", error);
        return errJson("Errore nel recupero delle prenotazioni", 400);
      }
      bookings = (data ?? []).map((row) => bookingWithCleaningStatus(row, organizationId));
    } else {
      const { data, error } = await timed(phases, "db-bookings", () => {
        let query = supabase
          .from("bookings")
          .select(BOOKING_SELECT)
          .eq("organization_id", organizationId)
          .order("check_in", { ascending: true });
        if (from) query = query.gte("check_out", from);
        return query;
      });

      if (error) {
        console.error("[GET /api/bookings] db error", error);
        return errJson("Errore nel recupero delle prenotazioni", 400);
      }
      bookings = (data ?? []).map((row) => bookingWithCleaningStatus(row, organizationId));
    }

    return attachRouteTiming(
      okJson({
        bookings,
      }),
      reqId,
      "/api/bookings",
      phases,
      { navigationId: navId, wallMs: performance.now() - startedAt },
    );
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
