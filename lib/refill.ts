export type RefillState = "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE";

export type RefillProduct = {
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
};

const MONITORED_CATEGORIES = new Set(["CAFFE", "ASCIUGAMANI E BAGNO", "LENZUOLA E COPERTE", "TESSILI E BIANCHERIA"]);
const EXCLUDED_OPERATIONAL_PRODUCTS = new Set(["LENZUOLO SOTTO EXTRA"]);

export function getRefillState(product: RefillProduct): RefillState {
  const margin = product.initialQuantity * 0.2;
  if (product.quantity <= product.threshold) return "DA_RIFORNIRE";
  if (product.quantity <= product.threshold + margin) return "IN_ESAURIMENTO";
  return "OK";
}

export function isMonitoredRefillProduct(product: Pick<RefillProduct, "name" | "category">): boolean {
  const nameKey = String(product.name ?? "").toUpperCase().trim();
  if (EXCLUDED_OPERATIONAL_PRODUCTS.has(nameKey)) return false;

  const categoryKey = String(product.category ?? "").toUpperCase();
  if (MONITORED_CATEGORIES.has(categoryKey)) return true;
  return (
    nameKey.includes("CAFFE") ||
    nameKey.includes("SPUGNETT") ||
    nameKey.includes("ASCIUGAMANI") ||
    nameKey.includes("LENZUO") ||
    nameKey.includes("COPRIPIUMINI") ||
    nameKey.includes("TAPPETINI")
  );
}
