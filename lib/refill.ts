import { LINEN_ROLE_VALUES } from "@/lib/linen-roles";

export type RefillState = "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE";
export type StockStatus = "PIENO" | "A_META" | "TERMINATO";

export type RefillProduct = {
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
  stockStatus?: StockStatus | null;
  linen_role?: string | null;
};

const EXCLUDED_OPERATIONAL_PRODUCTS = new Set(["LENZUOLO SOTTO EXTRA"]);
const QUANTITY_MANAGED_CATEGORIES = new Set(["ASCIUGAMANI E BAGNO", "LENZUOLA E COPERTE", "TESSILI E BIANCHERIA"]);

function normalizeName(name: string | null | undefined): string {
  return String(name ?? "").toUpperCase().trim();
}

function normalizeCategory(category: string | null | undefined): string {
  return String(category ?? "").toUpperCase().trim();
}

export function isQuantityManagedRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  if (product.linen_role && LINEN_ROLE_VALUES.has(product.linen_role)) return true;

  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;

  const categoryKey = normalizeCategory(product.category);
  if (QUANTITY_MANAGED_CATEGORIES.has(categoryKey)) return true;

  return (
    nameKey.includes("ASCIUGAMANI") ||
    nameKey.includes("LENZUO") ||
    nameKey.includes("FEDER") ||
    nameKey.includes("COPRIPIUM") ||
    nameKey.includes("TAPPETINI") ||
    nameKey.includes("MAPPIN") ||
    nameKey.includes("SET LETTO") ||
    nameKey.includes("PIUMINO")
  );
}

export function isStatusManagedRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;
  return !isQuantityManagedRefillProduct(product);
}

export function getRefillState(product: RefillProduct): RefillState {
  if (isStatusManagedRefillProduct(product)) {
    if (product.stockStatus === "TERMINATO") return "DA_RIFORNIRE";
    if (product.stockStatus === "A_META") return "IN_ESAURIMENTO";
    return "OK";
  }

  const margin = product.initialQuantity * 0.2;
  if (product.quantity <= product.threshold) return "DA_RIFORNIRE";
  if (product.quantity <= product.threshold + margin) return "IN_ESAURIMENTO";
  return "OK";
}

export function isMonitoredRefillProduct(product: Pick<RefillProduct, "name" | "category" | "linen_role">): boolean {
  const nameKey = normalizeName(product.name);
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;
  return isQuantityManagedRefillProduct(product) || isStatusManagedRefillProduct(product);
}
