import { describe, expect, it } from "vitest";
import { formatCurrencyIT } from "@/lib/format";

describe("formatCurrencyIT", () => {
  it("formatta un intero con due decimali e simbolo dopo il numero", () => {
    expect(formatCurrencyIT(25)).toBe("25,00 €");
  });

  it("usa la virgola come separatore decimale", () => {
    expect(formatCurrencyIT(275.74)).toBe("275,74 €");
  });

  it("usa il punto come separatore delle migliaia", () => {
    expect(formatCurrencyIT(12345.6)).toBe("12.345,60 €");
  });

  it("formatta i negativi con il segno meno prima del numero", () => {
    expect(formatCurrencyIT(-25.5)).toBe("-25,50 €");
  });

  it("formatta lo zero", () => {
    expect(formatCurrencyIT(0)).toBe("0,00 €");
  });
});
