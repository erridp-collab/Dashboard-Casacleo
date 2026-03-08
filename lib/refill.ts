export type RefillState = "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE";

export type RefillProduct = {
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
};

const MONITORED_CATEGORIES = new Set(["CAFFE", "ASCIUGAMANI E BAGNO", "LENZUOLA E COPERTE", "TESSILI E BIANCHERIA"]);

export function getRefillState(product: RefillProduct): RefillState {
  const margin = product.initialQuantity * 0.2;
  if (product.quantity <= product.threshold) return "DA_RIFORNIRE";
  if (product.quantity <= product.threshold + margin) return "IN_ESAURIMENTO";
  return "OK";
}

export function isMonitoredRefillProduct(product: Pick<RefillProduct, "name" | "category">): boolean {
  const categoryKey = String(product.category ?? "").toUpperCase();
  if (MONITORED_CATEGORIES.has(categoryKey)) return true;

  const nameKey = String(product.name ?? "").toUpperCase();
  return (
    nameKey.includes("CAFFE") ||
    nameKey.includes("SPUGNETT") ||
    nameKey.includes("ASCIUGAMANI") ||
    nameKey.includes("LENZUO") ||
    nameKey.includes("COPRIPIUMINI") ||
    nameKey.includes("TAPPETINI")
  );
}
