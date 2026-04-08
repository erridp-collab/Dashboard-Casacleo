import { NextResponse } from "next/server";
import { monthKey, toNumber } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type FinanceEntry = {
  id: string;
  date: string;
  type: "ENTRATA" | "USCITA";
  category: string;
  description: string;
  amount: number;
  origin: string;
};

function getMonthWindow(months: number, endingMonthDate = new Date()) {
  const endAnchor = new Date(endingMonthDate.getFullYear(), endingMonthDate.getMonth(), 1);
  const start = new Date(endAnchor.getFullYear(), endAnchor.getMonth() - (months - 1), 1);
  const end = new Date(endAnchor.getFullYear(), endAnchor.getMonth() + 1, 0);
  return { start, end };
}

function overlapDays(checkIn: Date, checkOut: Date, monthStart: Date, monthEnd: Date): number {
  const start = new Date(Math.max(checkIn.getTime(), monthStart.getTime()));
  const end = new Date(Math.min(checkOut.getTime(), monthEnd.getTime() + 24 * 60 * 60 * 1000));
  if (end <= start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function getBookingAmount(row: Record<string, unknown>): number {
  return (
    toNumber(row.total_amount, NaN) ||
    toNumber(row.amount, NaN) ||
    toNumber(row.price_total, NaN) ||
    toNumber(row.revenue, 0)
  );
}

function parseMonthInput(monthInput: string | null): Date {
  const fallback = new Date();
  if (!monthInput || !/^\d{4}-\d{2}$/.test(monthInput)) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  const [year, month] = monthInput.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }
  return new Date(year, month - 1, 1);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const months = Math.max(1, Math.min(24, Number(searchParams.get("months") ?? 6)));
    const selectedMonthDate = parseMonthInput(searchParams.get("month"));
    const selectedMonth = monthKey(selectedMonthDate);

    const { start, end } = getMonthWindow(months, selectedMonthDate);
    const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
    const monthEnd = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);

    const supabase = supabaseAdmin();
    const [{ data: bookings, error: bookingsErr }, expensesRes] =
      await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .gte("check_out", start.toISOString().slice(0, 10))
          .lte("check_in", end.toISOString().slice(0, 10)),
        supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", start.toISOString().slice(0, 10))
          .lte("expense_date", end.toISOString().slice(0, 10)),
      ]);

    let expenses = expensesRes.data;
    let expensesErr = expensesRes.error;

    if (expensesErr && String(expensesErr.code) === "42703" && String(expensesErr.message).includes("expense_date")) {
      const retry = await supabase
        .from("expenses")
        .select("*")
        .gte("date", start.toISOString().slice(0, 10))
        .lte("date", end.toISOString().slice(0, 10));
      expenses = retry.data;
      expensesErr = retry.error;
    }

    if (bookingsErr) return NextResponse.json({ error: bookingsErr.message }, { status: 400 });
    if (expensesErr) return NextResponse.json({ error: expensesErr.message }, { status: 400 });

    const monthPoints: Record<string, { revenue: number; expenses: number; occupiedDays: number; daysInMonth: number }> = {};

    for (let i = 0; i < months; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = monthKey(d);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      monthPoints[key] = { revenue: 0, expenses: 0, occupiedDays: 0, daysInMonth };
    }

    const entries: FinanceEntry[] = [];

    for (const raw of bookings ?? []) {
      const row = raw as Record<string, unknown>;
      const checkInStr = String(row.check_in ?? "");
      const checkOutStr = String(row.check_out ?? "");
      const checkIn = new Date(checkInStr);
      const checkOut = new Date(checkOutStr);
      if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime())) continue;

      const amount = getBookingAmount(row);
      const key = monthKey(checkIn);
      if (monthPoints[key]) monthPoints[key].revenue += amount;

      for (const month of Object.keys(monthPoints)) {
        const [year, m] = month.split("-").map(Number);
        const bucketStart = new Date(year, (m ?? 1) - 1, 1);
        const bucketEnd = new Date(year, (m ?? 1), 0);
        monthPoints[month].occupiedDays += overlapDays(checkIn, checkOut, bucketStart, bucketEnd);
      }

      const overlapsSelected = checkOut > monthStart && checkIn <= monthEnd;
      if (overlapsSelected && amount > 0) {
        entries.push({
          id: String(row.id ?? `booking-${checkInStr}-${checkOutStr}`),
          date: checkInStr,
          type: "ENTRATA",
          category: "Prenotazione",
          description: `Booking ${checkInStr} -> ${checkOutStr}${row.channel ? ` (${String(row.channel)})` : ""}`,
          amount: Number(amount.toFixed(2)),
          origin: "manuale",
        });
      }
    }

    for (const raw of expenses ?? []) {
      const row = raw as Record<string, unknown>;
      const date = String(row.expense_date ?? row.date ?? "");
      const key = date.slice(0, 7);
      if (!monthPoints[key]) continue;
      const amount = toNumber(row.amount, 0);
      monthPoints[key].expenses += amount;

      if (key === selectedMonth && amount > 0) {
        entries.push({
          id: String(row.id ?? `expense-${date}-${amount}`),
          date,
          type: "USCITA",
          category: String(row.category ?? "Spesa"),
          description: String(row.description ?? row.category ?? "Spesa"),
          amount: Number(amount.toFixed(2)),
          origin: String(row.origin ?? "manuale"),
        });
      }
    }

    const monthly = Object.entries(monthPoints).map(([month, values]) => {
      const occupancyRate = values.daysInMonth
        ? Math.min(100, Number(((values.occupiedDays / values.daysInMonth) * 100).toFixed(2)))
        : 0;

      return {
        month,
        revenue: Number(values.revenue.toFixed(2)),
        expenses: Number(values.expenses.toFixed(2)),
        netProfit: Number((values.revenue - values.expenses).toFixed(2)),
        occupancyRate,
      };
    });

    const totals = monthly.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        expenses: acc.expenses + row.expenses,
        netProfit: acc.netProfit + row.netProfit,
      }),
      { revenue: 0, expenses: 0, netProfit: 0 },
    );

    entries.sort((a, b) => {
      if (a.date === b.date) return a.type === "USCITA" ? -1 : 1;
      return a.date > b.date ? -1 : 1;
    });

    return NextResponse.json(
      {
        selectedMonth,
        monthly,
        entries,
        totals: {
          revenue: Number(totals.revenue.toFixed(2)),
          expenses: Number(totals.expenses.toFixed(2)),
          netProfit: Number(totals.netProfit.toFixed(2)),
        },
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const expense_date = String(body.expense_date ?? "");
    const amount = Number(body.amount);
    const category = String(body.category ?? "Spesa");
    const description = String(body.description ?? category);

    if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      return NextResponse.json({ error: "Data non valida (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Importo non valido" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const payload = { expense_date, amount, category, description, origin: "manuale" };
    let { error } = await supabase.from("expenses").insert(payload);

    // Fallback: table may use "date" column instead of "expense_date".
    if (error && String(error.code) === "42703" && String(error.message).includes("expense_date")) {
      const fallback = await supabase.from("expenses").insert({ date: expense_date, amount, category, description });
      error = fallback.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = supabaseAdmin();
    let { error } = await supabase.from("expenses").delete().eq("id", id).eq("origin", "manuale");
    if (error && String(error.code) === "42703" && String(error.message).includes("origin")) {
      const fallback = await supabase.from("expenses").delete().eq("id", id);
      error = fallback.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
