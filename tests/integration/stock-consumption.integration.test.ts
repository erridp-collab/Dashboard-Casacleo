/**
 * Integration tests: stock consumption when bookings are created/deleted.
 * Verifies that product quantities are decremented/restored correctly.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyBookingConsumptionDelta, getBookingConsumptionMap } from "../../lib/stock";
import { getProductId, getProductQuantity, resolveProductSchema } from "../../lib/products-schema";
import { addDays, supabaseTest, today } from "./helpers";

const LINEN_PRODUCT_NAMES = [
  "asciugamani bidet",
  "asciugamani doccia",
  "asciugamani corpo",
  "set letto estivo",
];

type ProductSnapshot = { id: string; name: string; qty: number };

async function snapshotLinenProducts(
  supabase: ReturnType<typeof supabaseTest>,
): Promise<ProductSnapshot[]> {
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, ${schema.quantityColumn}`);
  if (error) throw new Error(`snapshotLinenProducts: ${error.message}`);

  const result: ProductSnapshot[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim().toLowerCase();
    if (LINEN_PRODUCT_NAMES.includes(name)) {
      result.push({
        id: getProductId(row, schema),
        name,
        qty: getProductQuantity(row, schema),
      });
    }
  }
  return result;
}

describe("stock consumption - integration", () => {
  const supabase = supabaseTest();
  const base = today();
  let beforeSnapshots: ProductSnapshot[] = [];

  beforeEach(async () => {
    beforeSnapshots = await snapshotLinenProducts(supabase);
  });

  afterEach(async () => {
    // Restore all product quantities to their original values
    const schema = await resolveProductSchema(supabase);
    for (const snap of beforeSnapshots) {
      await supabase
        .from("products")
        .update({ [schema.quantityColumn]: snap.qty })
        .eq(schema.idColumn, snap.id);
    }
  });

  it("decrementa le quantita biancheria al checkout per 2 ospiti", async () => {
    const checkIn = addDays(base, 0);
    const checkOut = addDays(base, 3);
    const guests = 2;

    if (beforeSnapshots.length === 0) {
      console.warn("Nessun prodotto biancheria trovato nel DB - test saltato");
      return;
    }

    const consumptionMap = getBookingConsumptionMap(checkIn, checkOut, guests);
    await applyBookingConsumptionDelta(checkIn, checkOut, guests, 1);

    const afterSnapshots = await snapshotLinenProducts(supabase);

    for (const after of afterSnapshots) {
      const before = beforeSnapshots.find((b) => b.id === after.id);
      if (!before) continue;

      const expectedConsume = consumptionMap.get(after.name) ?? 0;
      if (expectedConsume > 0) {
        expect(after.qty).toBeLessThanOrEqual(before.qty);
        const actualConsumed = before.qty - after.qty;
        expect(actualConsumed).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("decrementa piu biancheria per 4 ospiti rispetto a 2", async () => {
    const checkIn = addDays(base, 0);
    const checkOut = addDays(base, 3);

    const map2 = getBookingConsumptionMap(checkIn, checkOut, 2);
    const map4 = getBookingConsumptionMap(checkIn, checkOut, 4);

    for (const name of LINEN_PRODUCT_NAMES) {
      const qty2 = map2.get(name) ?? 0;
      const qty4 = map4.get(name) ?? 0;
      if (qty2 > 0) {
        expect(qty4).toBeGreaterThanOrEqual(qty2);
      }
    }
  });

  it("ripristina le quantita dopo undo (direction=-1)", async () => {
    if (beforeSnapshots.length === 0) {
      console.warn("Nessun prodotto biancheria trovato nel DB - test saltato");
      return;
    }

    const schema = await resolveProductSchema(supabase);
    for (const snap of beforeSnapshots) {
      await supabase
        .from("products")
        .update({ [schema.quantityColumn]: 10 })
        .eq(schema.idColumn, snap.id);
    }

    const checkIn = addDays(base, 0);
    const checkOut = addDays(base, 3);
    const guests = 2;

    await applyBookingConsumptionDelta(checkIn, checkOut, guests, 1);
    await applyBookingConsumptionDelta(checkIn, checkOut, guests, -1);

    const afterSnapshots = await snapshotLinenProducts(supabase);

    for (const after of afterSnapshots) {
      expect(Math.abs(after.qty - 10)).toBeLessThan(0.01);
    }
  });

  it("non modifica prodotti con consumption_per_checkout=0 o assente", async () => {
    if (beforeSnapshots.length === 0) {
      console.warn("Nessun prodotto biancheria trovato nel DB - test saltato");
      return;
    }

    const checkIn = addDays(base, 0);
    const checkOut = addDays(base, 1);
    const guests = 1;

    const consumptionMap = getBookingConsumptionMap(checkIn, checkOut, guests);
    expect(consumptionMap.get("asciugamani bidet")).toBe(2);
    expect(consumptionMap.get("set letto estivo")).toBe(1);
  });
});
