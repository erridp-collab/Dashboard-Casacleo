import { NextResponse } from "next/server";
import { syncBookingAutomations } from "@/lib/booking-automation";
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
      .order("check_in", { ascending: false });

    // Backward-compatible fallback when total_amount is not present in older schemas.
    if (isMissingTotalAmountError(error)) {
      const retry = await supabase
        .from("bookings")
        .select("id, check_in, check_out, guests, channel, notes")
        .order("check_in", { ascending: false });
      data = (retry.data ?? []).map((row) => ({ ...row, total_amount: null }));
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ bookings: data ?? [] }, { status: 200 });
  } catch (e: unknown) {
    console.error("[GET /api/bookings]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBookingPayload;
    const { check_in, check_out, guests, channel, notes, total_amount } = body;
    const parsedGuests = Number(guests);
    const parsedAmount = toAmount(total_amount);

    if (!check_in || !check_out || !parsedGuests) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isValidIsoDate(check_in) || !isValidIsoDate(check_out)) {
      return NextResponse.json({ error: "Formato data non valido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (check_in >= check_out) {
      return NextResponse.json({ error: "Check-out deve essere successivo al check-in" }, { status: 400 });
    }
    if (parsedGuests <= 0) {
      return NextResponse.json({ error: "Numero ospiti non valido" }, { status: 400 });
    }
    if (total_amount !== undefined && total_amount !== null && parsedAmount === null) {
      return NextResponse.json({ error: "Importo non valido" }, { status: 400 });
    }

    const conflict = await hasDateConflict(check_in, check_out);
    if (conflict) {
      return NextResponse.json(
        { error: "Esiste gia una prenotazione nello stesso giorno o in sovrapposizione" },
        { status: 409 },
      );
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
        return NextResponse.json(
          { error: "La colonna bookings.total_amount non esiste nel database. Aggiungila per salvare l'importo." },
          { status: 400 },
        );
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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bookingId = data?.id ?? null;
    if (!bookingId) {
      return NextResponse.json({ error: "Creazione prenotazione fallita" }, { status: 400 });
    }

    // Fire-and-forget: run in background, don't block the response.
    void syncBookingAutomations()
      .catch((err: unknown) => console.error("Booking post-create sync failed", err));

    return NextResponse.json({ booking_id: bookingId }, { status: 200 });
  } catch (e: unknown) {
    console.error("[POST /api/bookings]", e);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
