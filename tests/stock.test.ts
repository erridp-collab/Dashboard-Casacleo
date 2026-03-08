import { describe, expect, it } from "vitest";
import { getBookingConsumptionMap, shouldIncludeInShoppingList } from "../lib/stock";

describe("stock business rules", () => {
  it("computes booking consumptions for coffee/toilet paper/sponges and linen sets", () => {
    const map = getBookingConsumptionMap("2026-03-01", "2026-03-04", 3);
    expect(map.get("caffe cialde")).toBe(9);
    expect(map.get("carta igienica")).toBe(6);
    expect(map.get("spugnette morbide")).toBe(1);
    expect(map.get("spugnette lavapiatti")).toBe(1);
    expect(map.get("asciugamani bidet")).toBe(4);
    expect(map.get("asciugamani doccia")).toBe(4);
    expect(map.get("asciugamani corpo")).toBe(4);
    expect(map.get("completi letto completi")).toBe(2);
  });

  it("excludes linen-like products from SPESA shopping list", () => {
    expect(
      shouldIncludeInShoppingList({
        name: "Asciugamani doccia",
        category: "Asciugamani e bagno",
        unit: "pezzi",
      }),
    ).toBe(false);

    expect(
      shouldIncludeInShoppingList({
        name: "Completi letto completi",
        category: "Lenzuola e coperte",
        unit: "set",
      }),
    ).toBe(false);
  });

  it("keeps consumables in SPESA shopping list", () => {
    expect(
      shouldIncludeInShoppingList({
        name: "Caffe cialde",
        category: "Caffe",
        unit: "cialde",
      }),
    ).toBe(true);

    expect(
      shouldIncludeInShoppingList({
        name: "Carta igienica",
        category: "Prodotti per pulizia",
        unit: "rotoli",
      }),
    ).toBe(true);
  });
});
