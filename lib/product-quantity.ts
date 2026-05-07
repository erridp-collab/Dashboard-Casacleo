import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductSchema } from "@/lib/products-schema";

export type ProductQuantityDeltaInput = {
  id: string;
  currentQty: number;
  delta: number;
  maxQty?: number | null;
};

export type ProductQuantityDeltaResult = {
  id: string;
  previousQty: number;
  nextQty: number;
  appliedDelta: number;
};

type ApplyDeltaOptions = {
  capToMaxQty?: boolean;
  floorAtZero?: boolean;
};

type RpcRow = {
  product_id: string;
  previous_qty: number | string | null;
  next_qty: number | string | null;
  applied_delta: number | string | null;
};

function roundQty(value: number): number {
  return Number(value.toFixed(2));
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingAtomicRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  return code === "PGRST202" || message.includes("apply_product_quantity_deltas_atomic");
}

function computeNextQty(
  item: ProductQuantityDeltaInput,
  options?: ApplyDeltaOptions,
): ProductQuantityDeltaResult {
  const previousQty = roundQty(item.currentQty);
  let nextQty = roundQty(previousQty + item.delta);

  if (options?.floorAtZero !== false && nextQty < 0) {
    nextQty = 0;
  }

  const maxQty = Number(item.maxQty);
  if (options?.capToMaxQty && Number.isFinite(maxQty) && maxQty > 0) {
    nextQty = Math.min(nextQty, roundQty(maxQty));
  }

  return {
    id: item.id,
    previousQty,
    nextQty: roundQty(nextQty),
    appliedDelta: roundQty(nextQty - previousQty),
  };
}

async function applyWithFallback(
  supabase: SupabaseClient,
  schema: ProductSchema,
  deltas: ProductQuantityDeltaInput[],
  options?: ApplyDeltaOptions,
): Promise<ProductQuantityDeltaResult[]> {
  const results = deltas.map((item) => computeNextQty(item, options));

  await Promise.all(
    results.map((result) =>
      supabase
        .from("products")
        .update({ [schema.quantityColumn]: result.nextQty })
        .eq(schema.idColumn, result.id)
        .then(({ error }) => {
          if (error) throw new Error(error.message);
        }),
    ),
  );

  return results;
}

export async function applyProductQuantityDeltas(
  supabase: SupabaseClient,
  schema: ProductSchema,
  deltas: ProductQuantityDeltaInput[],
  options?: ApplyDeltaOptions,
): Promise<ProductQuantityDeltaResult[]> {
  const normalized = deltas
    .map((item) => ({
      ...item,
      currentQty: roundQty(item.currentQty),
      delta: roundQty(item.delta),
      maxQty: item.maxQty ?? null,
    }))
    .filter((item) => item.id && item.delta !== 0);

  if (normalized.length === 0) return [];

  const rpc = await supabase.rpc("apply_product_quantity_deltas_atomic", {
    p_deltas: normalized.map((item) => ({
      product_id: item.id,
      delta: item.delta,
    })),
    p_cap_to_max_qty: options?.capToMaxQty ?? false,
    p_floor_at_zero: options?.floorAtZero ?? true,
  });

  if (rpc.error) {
    if (!isMissingAtomicRpc(rpc.error)) {
      throw new Error(rpc.error.message);
    }
    return applyWithFallback(supabase, schema, normalized, options);
  }

  const rows = (rpc.data ?? []) as RpcRow[];
  return rows.map((row) => ({
    id: String(row.product_id ?? ""),
    previousQty: roundQty(toNumber(row.previous_qty)),
    nextQty: roundQty(toNumber(row.next_qty)),
    appliedDelta: roundQty(toNumber(row.applied_delta)),
  }));
}
