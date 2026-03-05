import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateBookingPayload = {
  check_in: string;
  check_out: string;
  guests: number;
  channel?: string | null;
  notes?: string | null;
  total_amount?: number | null;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests, channel, notes, total_amount, created_at")
      .order("check_in", { ascending: false });

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

    if (!check_in || !check_out || !guests) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payload = {
      check_in,
      check_out,
      guests,
      channel: channel ?? null,
      notes: notes ?? null,
      total_amount: total_amount ?? null,
    };

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("create_booking", { payload });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const maybeObject = Array.isArray(data) ? data[0] : data;
    const bookingId = maybeObject?.booking_id ?? maybeObject?.id ?? null;
    return NextResponse.json({ booking_id: bookingId, raw: data }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

