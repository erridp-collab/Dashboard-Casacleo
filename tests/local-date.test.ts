import { describe, expect, it } from "vitest";
import { addDaysLocalIT, formatLocalDateIT, parseLocalDateIT, todayLocalIT } from "../lib/localDate";

describe("localDate helpers", () => {
  it("formats YYYY-MM-DD using Europe/Rome around UTC midnight", () => {
    expect(formatLocalDateIT(new Date("2026-01-15T23:30:00.000Z"))).toBe("2026-01-16");
    expect(formatLocalDateIT(new Date("2026-01-15T00:30:00.000Z"))).toBe("2026-01-15");
  });

  it("remains stable across DST transitions", () => {
    expect(formatLocalDateIT(new Date("2026-03-28T23:30:00.000Z"))).toBe("2026-03-29");
    expect(formatLocalDateIT(new Date("2026-10-25T00:30:00.000Z"))).toBe("2026-10-25");
  });

  it("adds calendar days without timezone drift", () => {
    expect(addDaysLocalIT("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDaysLocalIT("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("parses valid YYYY-MM-DD and rejects invalid dates", () => {
    expect(parseLocalDateIT("2026-02-28")).not.toBeNull();
    expect(parseLocalDateIT("2026-02-30")).toBeNull();
  });

  it("returns today in canonical YYYY-MM-DD format", () => {
    expect(todayLocalIT()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
