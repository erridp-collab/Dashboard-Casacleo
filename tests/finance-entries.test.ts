import { describe, expect, it } from "vitest";
import { expenseRestockDetail } from "@/lib/data/finance";
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

describe("expenseRestockDetail", () => {
  const expense = {
    origin: "automatica_da_rifornimento",
    source_action_id: "action-a",
    source_action: {
      id: "action-a",
      organization_id: "org-a",
      details: "Sapone: 2",
    },
  };

  it("returns details only for the authorized tenant and matching action", () => {
    expect(expenseRestockDetail(expense, "org-a")).toBe("Sapone: 2");
  });

  it("rejects a nested action belonging to another tenant", () => {
    expect(expenseRestockDetail(expense, "org-b")).toBeNull();
  });

  it("rejects a mismatched embedded action id", () => {
    expect(
      expenseRestockDetail(
        { ...expense, source_action: { ...expense.source_action, id: "action-b" } },
        "org-a",
      ),
    ).toBeNull();
  });

  it("does not expose action details on manual expenses", () => {
    expect(expenseRestockDetail({ ...expense, origin: "manuale" }, "org-a")).toBeNull();
  });
});
