import { describe, expect, it } from "vitest";
import { formatDateIT, formatDateLongIT, formatDateRangeIT, formatMonthLongIT } from "@/lib/format";

describe("formatDateIT", () => {
  it("formatta una stringa yyyy-MM-dd in gg/mm/aaaa", () => {
    expect(formatDateIT("2026-08-14")).toBe("14/08/2026");
  });

  it("non slitta di giorno indipendentemente dal fuso orario locale", () => {
    // 01 e 31 del mese sono i casi limite piu sensibili a shift UTC/locale.
    expect(formatDateIT("2026-01-01")).toBe("01/01/2026");
    expect(formatDateIT("2026-12-31")).toBe("31/12/2026");
  });

  it("accetta anche un oggetto Date", () => {
    expect(formatDateIT(new Date(2026, 7, 14))).toBe("14/08/2026");
  });

  it("ritorna stringa vuota per input non valido", () => {
    expect(formatDateIT("not-a-date")).toBe("");
  });
});

describe("formatDateRangeIT", () => {
  it("formatta un intervallo gg/mm/aaaa – gg/mm/aaaa", () => {
    expect(formatDateRangeIT("2026-08-14", "2026-08-18")).toBe("14/08/2026 – 18/08/2026");
  });
});

describe("formatDateLongIT", () => {
  it("formatta il titolo esteso con iniziale maiuscola", () => {
    // 2026-08-14 e' un venerdi.
    expect(formatDateLongIT("2026-08-14")).toBe("Venerdì 14 agosto 2026");
  });
});

describe("formatMonthLongIT", () => {
  it("formatta il mese esteso con iniziale maiuscola", () => {
    expect(formatMonthLongIT("2026-08-01")).toBe("Agosto 2026");
  });
});
