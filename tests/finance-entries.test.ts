import { describe, expect, it } from "vitest";
import { isBookingRevenueInSelectedMonth } from "@/lib/finance-entries";

describe("isBookingRevenueInSelectedMonth", () => {
  it("counts a booking that starts and ends within the same month", () => {
    const checkIn = new Date(2026, 7, 10); // 10 agosto 2026
    const selectedMonth = new Date(2026, 7, 1); // agosto 2026
    expect(isBookingRevenueInSelectedMonth(checkIn, selectedMonth)).toBe(true);
  });

  it("attributes a cross-month booking's revenue only to the check-in month", () => {
    // Prenotazione 29 agosto -> 4 settembre 2026: l'incasso appartiene solo ad agosto.
    const checkIn = new Date(2026, 7, 29); // 29 agosto 2026

    const august = new Date(2026, 7, 1);
    const september = new Date(2026, 8, 1);

    expect(isBookingRevenueInSelectedMonth(checkIn, august)).toBe(true);
    expect(isBookingRevenueInSelectedMonth(checkIn, september)).toBe(false);
  });

  it("excludes a booking whose check-in falls in a different month entirely", () => {
    const checkIn = new Date(2026, 6, 15); // 15 luglio 2026
    const selectedMonth = new Date(2026, 7, 1); // agosto 2026
    expect(isBookingRevenueInSelectedMonth(checkIn, selectedMonth)).toBe(false);
  });
});
