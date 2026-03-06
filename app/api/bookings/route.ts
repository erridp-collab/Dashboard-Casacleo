import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateBookingPayload = {
  check_in: string;
  check_out: string;
  guests: number;
  channel?: string | null;
  notes?: string | null;
  total_amount?: number | string | null;
};

const CLEANING_CHECKLIST = [
  "Spolvera tutte le superfici",
  "Pulisci bagno e sanitari",
  "Cambia e sistema la biancheria",
  "Controlla e svuota i cestini",
];

const MAINTENANCE_CHECKLIST = [
  "Verifica luci e prese elettriche",
  "Controlla rubinetti e scarichi",
  "Verifica climatizzazione/riscaldamento",
  "Segnala eventuali danni o anomalie",
];

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

async function hasDateConflict(checkIn: string, checkOut: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .lte("check_in", checkOut)
    .gte("check_out", checkIn)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function ensureActionWithChecklist(
  bookingId: string,
  actionDate: string,
  actionType: "PULIZIA" | "MANUTENZIONE",
  checklist: string[],
) {
  const supabase = supabaseAdmin();
  const { data: existing, error: existingErr } = await supabase
    .from("actions")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("action_type", actionType)
    .eq("action_date", actionDate)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  let actionId = existing?.id ?? null;
  if (!actionId) {
    const { data: created, error: createErr } = await supabase
      .from("actions")
      .insert({
        booking_id: bookingId,
        action_date: actionDate,
        action_type: actionType,
        status: "DA_FARE",
        details: null,
      })
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    actionId = created.id;
  }

  const { data: checklistRows, error: checklistErr } = await supabase
    .from("action_checklist")
    .select("id")
    .eq("action_id", actionId);

  if (checklistErr) throw new Error(checklistErr.message);
  if ((checklistRows ?? []).length > 0) return;

  const baseRows = checklist.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    label,
  }));

  let insert = await supabase.from("action_checklist").insert(baseRows);
  if (!insert.error) return;
  if (insert.error.code !== "42703") throw new Error(insert.error.message);

  const itemTextRows = checklist.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    item_text: label,
  }));
  insert = await supabase.from("action_checklist").insert(itemTextRows);
  if (!insert.error) return;
  if (insert.error.code !== "42703") throw new Error(insert.error.message);

  const itemRows = checklist.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    item: label,
  }));
  const finalInsert = await supabase.from("action_checklist").insert(itemRows);
  if (finalInsert.error) throw new Error(finalInsert.error.message);
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    let { data, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests, channel, notes, total_amount, created_at")
      .order("check_in", { ascending: false });

    // Backward-compatible fallback when total_amount is not present in older schemas.
    if (error?.code === "42703" && error.message.includes("total_amount")) {
      const retry = await supabase
        .from("bookings")
        .select("id, check_in, check_out, guests, channel, notes, created_at")
        .order("check_in", { ascending: false });
      data = (retry.data ?? []).map((row) => ({ ...row, total_amount: null }));
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ bookings: data ?? [] }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
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
    if (error?.code === "42703" && error.message.includes("total_amount")) {
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

    await ensureActionWithChecklist(bookingId, check_out, "PULIZIA", CLEANING_CHECKLIST);
    await ensureActionWithChecklist(bookingId, check_out, "MANUTENZIONE", MAINTENANCE_CHECKLIST);

    return NextResponse.json({ booking_id: bookingId }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
