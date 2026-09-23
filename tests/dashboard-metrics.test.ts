import { describe, expect, it } from "vitest";
import { computeDashboardActionMetrics } from "../lib/dashboardMetrics";
import type { Action } from "../types/db";

function buildAction(overrides: Partial<Action>): Action {
  return {
    id: overrides.id ?? "a1",
    booking_id: null,
    action_date: overrides.action_date ?? "2026-09-22",
    action_type: overrides.action_type ?? "PULIZIA",
    status: overrides.status ?? "DA_FARE",
    details: null,
    amount: null,
    ...overrides,
  };
}

describe("computeDashboardActionMetrics", () => {
  it("conta le azioni di oggi indipendentemente dallo stato", () => {
    const actions = [
      buildAction({ id: "1", action_date: "2026-09-22", status: "DA_FARE" }),
      buildAction({ id: "2", action_date: "2026-09-22", status: "FATTO" }),
    ];
    const result = computeDashboardActionMetrics(actions, "2026-09-22");
    expect(result.todayActions).toHaveLength(2);
    expect(result.openToday).toBe(1);
  });

  it("mette in 'arretrate' solo le azioni DA_FARE con data precedente a oggi", () => {
    const actions = [
      buildAction({ id: "1", action_date: "2026-08-10", status: "DA_FARE" }),
      buildAction({ id: "2", action_date: "2026-09-14", status: "DA_FARE" }),
      buildAction({ id: "3", action_date: "2026-08-01", status: "FATTO" }),
      buildAction({ id: "4", action_date: "2026-09-22", status: "DA_FARE" }),
    ];
    const result = computeDashboardActionMetrics(actions, "2026-09-22");
    expect(result.overdueOpen.map((a) => a.id).sort()).toEqual(["1", "2"]);
  });

  it("non include mai la data di oggi tra le arretrate", () => {
    const actions = [buildAction({ id: "1", action_date: "2026-09-22", status: "DA_FARE" })];
    const result = computeDashboardActionMetrics(actions, "2026-09-22");
    expect(result.overdueOpen).toHaveLength(0);
  });
});
