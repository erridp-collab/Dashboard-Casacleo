import { describe, expect, it } from "vitest";
import { shoppingDetails } from "@/lib/stock";
import type { StockProduct } from "@/lib/stock";

function product(overrides: Partial<StockProduct>): StockProduct {
  return {
    id: "1",
    name: "Sapone piatti",
    category: null,
    quantity: 3,
    threshold: 0,
    unit: "pz",
    stock_status: null,
    ...overrides,
  } as StockProduct;
}

describe("shoppingDetails", () => {
  it("traduce TERMINATO in italiano leggibile", () => {
    const result = shoppingDetails([product({ stock_status: "TERMINATO" })]);
    expect(result).toContain("finito");
    expect(result).not.toContain("TERMINATO");
  });

  it("traduce A_META in italiano leggibile", () => {
    const result = shoppingDetails([product({ stock_status: "A_META" })]);
    expect(result).toContain("a metà");
    expect(result).not.toContain("A_META");
  });

  it("mostra quantità e unità per i prodotti senza stato", () => {
    const result = shoppingDetails([product({ stock_status: null, quantity: 3, unit: "pz" })]);
    expect(result).toContain("Sapone piatti: 3 pz");
  });
});
