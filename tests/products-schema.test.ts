import { describe, expect, it } from "vitest";
import { getProductId, type ProductSchema } from "../lib/products-schema";

describe("products schema helpers", () => {
  const schema: ProductSchema = { idColumn: "id", quantityColumn: "quantity" };

  it("returns the resolved product id when present", () => {
    expect(getProductId({ id: "p1", name: "Carta" }, schema)).toBe("p1");
  });

  it("throws when neither id nor sku can be resolved", () => {
    expect(() => getProductId({ name: "Carta" }, schema)).toThrow(/Unable to resolve product id/);
  });
});
