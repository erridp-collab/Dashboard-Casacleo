import { NextResponse } from "next/server";
import { monthKey, toNumber } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getMonthWindow(months: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const months = Math.max(1, Math.min(24, Number(searchParams.get("months") ?? 6)));
    const { start, end } = getMonthWindow(months);

    const supabase = supabaseAdmin();
    const [{ data: bookings, error: bookingsErr }, { data: expenses, error: expensesErr }] =
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

    if (bookingsErr) return NextResponse.json({ error: bookingsErr.message }, { status: 400 });
    if (expensesErr) return NextResponse.json({ error: expensesErr.message }, { status: 400 });

    const monthPoints: Record<string, { revenue: number; expenses: number; occupiedDays: number; daysInMonth: number }> = {};

    for (let i = 0; i < months; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = monthKey(d);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      monthPoints[key] = { revenue: 0, expenses: 0, occupiedDays: 0, daysInMonth };
    }

    for (const raw of bookings ?? []) {
      const row = raw as Record<string, unknown>;
      const checkIn = new Date(String(row.check_in ?? ""));
      const checkOut = new Date(String(row.check_out ?? ""));
      if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime())) continue;

      const key = monthKey(checkIn);
      if (monthPoints[key]) monthPoints[key].revenue += getBookingAmount(row);

      for (const month of Object.keys(monthPoints)) {
        const [year, m] = month.split("-").map(Number);
        const monthStart = new Date(year, (m ?? 1) - 1, 1);
        const monthEnd = new Date(year, (m ?? 1), 0);
        monthPoints[month].occupiedDays += overlapDays(checkIn, checkOut, monthStart, monthEnd);
      }
    }

    for (const raw of expenses ?? []) {
      const row = raw as Record<string, unknown>;
      const date = String(row.expense_date ?? row.date ?? "");
      const key = date.slice(0, 7);
      if (!monthPoints[key]) continue;
      monthPoints[key].expenses += toNumber(row.amount, 0);
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

    return NextResponse.json(
      {
        monthly,
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

