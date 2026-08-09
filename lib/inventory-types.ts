import type { StockStatus } from "@/lib/refill";

export type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
  maxQty: number | null;
  consumptionPerCheckout: number | null;
  stockStatus: StockStatus | null;
};

export type RestockDraft = {
  addQty: string;
  amount: string;
};
