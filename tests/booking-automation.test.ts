import { describe, expect, it } from "vitest";
import { computeDesiredActions } from "../lib/booking-automation";

describe("computeDesiredActions", () => {
  it("always creates PULIZIA on each check_out", () => {
    const actions = computeDesiredActions([
      { id: "b1", check_in: "2026-03-01", check_out: "2026-03-03" },
      { id: "b2", check_in: "2026-03-03", check_out: "2026-03-05" },
    ]);

    const pulizie = actions.filter((a) => a.action_type === "PULIZIA");
    expect(pulizie).toHaveLength(2);
    expect(pulizie.map((a) => a.action_date)).toEqual(["2026-03-03", "2026-03-05"]);
  });

  it("creates PREPARA_LETTO when gap between previous check_out and next check_in is > 3 days", () => {
    const actions = computeDesiredActions([
      { id: "b1", check_in: "2026-03-01", check_out: "2026-03-03" },
      { id: "b2", check_in: "2026-03-08", check_out: "2026-03-10" },
    ]);

    const prepara = actions.find((a) => a.action_type === "PREPARA_LETTO");
    expect(prepara).toBeDefined();
    expect(prepara?.action_date).toBe("2026-03-08");
  });

  it("creates LAVATRICI and MANUT_3 each 3 stays, and MANUT_4 each 4 stays", () => {
    const actions = computeDesiredActions([
      { id: "b1", check_in: "2026-03-01", check_out: "2026-03-02" },
      { id: "b2", check_in: "2026-03-02", check_out: "2026-03-03" },
      { id: "b3", check_in: "2026-03-03", check_out: "2026-03-04" },
      { id: "b4", check_in: "2026-03-04", check_out: "2026-03-05" },
      { id: "b5", check_in: "2026-03-05", check_out: "2026-03-06" },
      { id: "b6", check_in: "2026-03-06", check_out: "2026-03-07" },
    ]);

    const lavatrici = actions.filter((a) => a.action_type === "LAVATRICI");
    const manut3 = actions.filter((a) => a.action_type === "MANUT_3");
    const manut4 = actions.filter((a) => a.action_type === "MANUT_4");

    expect(lavatrici.map((a) => a.booking_id)).toEqual(["b3", "b6"]);
    expect(manut3.map((a) => a.booking_id)).toEqual(["b3", "b6"]);
    expect(manut4.map((a) => a.booking_id)).toEqual(["b4"]);
  });
});
