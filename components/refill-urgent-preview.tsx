"use client";

import { CheckCircle2 } from "lucide-react";
import { getRefillState, isStatusManagedRefillProduct, type RefillState } from "@/lib/refill";
import { RefillStateBadge } from "@/components/refill-state-badge";
import type { ProductRow } from "@/lib/inventory-types";

type UrgentItem = {
  product: ProductRow;
  state: RefillState;
  isConsumable: boolean;
};

const SEVERITY_RANK: Record<RefillState, number> = {
  DA_RIFORNIRE: 0,
  IN_ESAURIMENTO: 1,
  OK: 2,
};

const SHOW_ALL_LIMIT = 5;
const TRUNCATED_LIMIT = 3;

type Props = {
  products: ProductRow[];
  onOpenConsumables: () => void;
  onOpenLinen: () => void;
};

export function RefillUrgentPreview({ products, onOpenConsumables, onOpenLinen }: Props) {
  const urgent: UrgentItem[] = products
    .map((product) => ({
      product,
      state: getRefillState(product),
      isConsumable: isStatusManagedRefillProduct(product),
    }))
    .filter((item) => item.state !== "OK")
    .sort((a, b) => SEVERITY_RANK[a.state] - SEVERITY_RANK[b.state]);

  if (urgent.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-border-strong/12 bg-surface-raised p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-semantic-success" aria-hidden="true" />
        <p className="text-sm text-text-secondary">Tutto a posto, nessun rifornimento necessario.</p>
      </div>
    );
  }

  const visible = urgent.length <= SHOW_ALL_LIMIT ? urgent : urgent.slice(0, TRUNCATED_LIMIT);
  const hiddenCount = urgent.length - visible.length;
  const consumableCount = urgent.filter((item) => item.isConsumable).length;
  const linenCount = urgent.length - consumableCount;
  const seeAllTarget = linenCount > consumableCount ? onOpenLinen : onOpenConsumables;

  return (
    <div className="rounded-2xl border border-border-strong/12 bg-surface-raised p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-text-secondary">Da rivedere ora</p>
      <div className="divide-y divide-border-strong/10">
        {visible.map((item) => (
          <button
            key={item.product.id}
            type="button"
            onClick={item.isConsumable ? onOpenConsumables : onOpenLinen}
            className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors duration-150 hover:bg-surface-muted"
          >
            <span className="truncate text-sm text-text-primary">{item.product.name}</span>
            <RefillStateBadge state={item.state} />
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={seeAllTarget}
          className="mt-2 text-xs font-semibold text-brand-primary transition-colors duration-150 hover:text-brand-hover"
        >
          Vedi tutti gli {urgent.length} →
        </button>
      )}
    </div>
  );
}
