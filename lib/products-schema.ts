import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductSchema = {
  idColumn: "id" | "sku";
  quantityColumn: "quantity" | "qty";
};

export async function resolveProductSchema(supabase: SupabaseClient): Promise<ProductSchema> {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "products");

  if (error) {
    return { idColumn: "id", quantityColumn: "quantity" };
  }

  const columnNames = new Set((data ?? []).map((row) => String(row.column_name)));

  const idColumn: "id" | "sku" = columnNames.has("id") ? "id" : "sku";
  const quantityColumn: "quantity" | "qty" = columnNames.has("quantity") ? "quantity" : "qty";

  return { idColumn, quantityColumn };
}

export function getProductId(row: Record<string, unknown>, schema: ProductSchema): string {
  const direct = row[schema.idColumn];
  if (direct !== null && direct !== undefined && String(direct).trim() !== "") return String(direct);
  if (row.id !== null && row.id !== undefined && String(row.id).trim() !== "") return String(row.id);
  if (row.sku !== null && row.sku !== undefined && String(row.sku).trim() !== "") return String(row.sku);
  return "";
}

export function getProductQuantity(row: Record<string, unknown>, schema: ProductSchema): number {
  const value = row[schema.quantityColumn] ?? row.quantity ?? row.qty ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
