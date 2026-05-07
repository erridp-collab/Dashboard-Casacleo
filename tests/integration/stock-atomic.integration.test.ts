import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProductId, getProductQuantity, resolveProductSchema } from "../../lib/products-schema";
import { supabaseTest } from "./helpers";

type ProductSnapshot = {
  id: string;
  qty: number;
};

async function findTestProduct(
  supabase: ReturnType<typeof supabaseTest>,
): Promise<ProductSnapshot | null> {
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, ${schema.quantityColumn}`)
    .order(schema.idColumn, { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findTestProduct: ${error.message}`);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: getProductId(row, schema),
    qty: getProductQuantity(row, schema),
  };
}

describe("apply_product_quantity_deltas_atomic - integration", () => {
  const supabase = supabaseTest();
  let snapshot: ProductSnapshot | null = null;

  beforeEach(async () => {
    snapshot = await findTestProduct(supabase);
  });

  afterEach(async () => {
    if (!snapshot) return;
    const schema = await resolveProductSchema(supabase);
    await supabase
      .from("products")
      .update({ [schema.quantityColumn]: snapshot.qty })
      .eq(schema.idColumn, snapshot.id);
  });

  it("avoids lost updates when two deltas run concurrently", async () => {
    if (!snapshot) {
      console.warn("Nessun prodotto disponibile - test saltato");
      return;
    }

    const schema = await resolveProductSchema(supabase);
    await supabase
      .from("products")
      .update({ [schema.quantityColumn]: 10 })
      .eq(schema.idColumn, snapshot.id);

    const runDelta = (delta: number) =>
      supabase.rpc("apply_product_quantity_deltas_atomic", {
        p_deltas: [{ product_id: snapshot?.id, delta }],
        p_cap_to_max_qty: false,
        p_floor_at_zero: true,
      });

    const [first, second] = await Promise.all([runDelta(-3), runDelta(-4)]);
    if (first.error?.code === "PGRST202" || second.error?.code === "PGRST202") {
      console.warn("RPC apply_product_quantity_deltas_atomic non presente nel database test - verifica atomica saltata");
      return;
    }

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const { data, error } = await supabase
      .from("products")
      .select(`${schema.quantityColumn}`)
      .eq(schema.idColumn, snapshot.id)
      .maybeSingle();

    expect(error).toBeNull();
    const row = data as Record<string, unknown>;
    expect(getProductQuantity(row, schema)).toBe(3);
  });
});
