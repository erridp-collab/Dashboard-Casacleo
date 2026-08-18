"use client";

import type { Dispatch, SetStateAction } from "react";
import { ShoppingCart } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { RowSkeleton } from "@/components/skeleton";
import { RefillStateBadge } from "@/components/refill-state-badge";
import { getRefillState, type RefillState } from "@/lib/refill";
import type { ProductRow, RestockDraft } from "@/lib/inventory-types";

function StockBar({ quantity, initialQuantity, state }: { quantity: number; initialQuantity: number; state: RefillState }) {
  const pct = initialQuantity > 0 ? Math.min(100, Math.max(0, (quantity / initialQuantity) * 100)) : 0;
  const color =
    state === "DA_RIFORNIRE" ? "bg-semantic-error" : state === "IN_ESAURIMENTO" ? "bg-semantic-warning" : "bg-semantic-success";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Props = {
  open: boolean;
  products: ProductRow[];
  loadingProducts: boolean;
  drafts: Record<string, RestockDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, RestockDraft>>>;
  restockPending: boolean;
  onRestock: (id: string) => Promise<void>;
  onClose: () => void;
};

export function RefillLinenModal({
  open,
  products,
  loadingProducts,
  drafts,
  setDrafts,
  restockPending,
  onRestock,
  onClose,
}: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="Biancheria a Quantità" widthClassName="sm:max-w-[560px]">
      <p className="mb-4 text-xs text-text-secondary">{products.length} prodotti gestiti a pezzi/set</p>

      {loadingProducts ? (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Prodotto</TableHeaderCell>
              <TableHeaderCell>Qtà</TableHeaderCell>
              <TableHeaderCell>Stato</TableHeaderCell>
              <TableHeaderCell>Rifornisci</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <RowSkeleton key={i} cols={4} />
            ))}
          </TableBody>
        </Table>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Nessuna biancheria da monitorare</p>
          <p className="text-xs text-text-secondary">Set letto, asciugamani e tessili restano gestiti a quantità.</p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Prodotto</TableHeaderCell>
              <TableHeaderCell>Qtà</TableHeaderCell>
              <TableHeaderCell>Stato</TableHeaderCell>
              <TableHeaderCell>Rifornisci</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {products.map((product) => {
              const state = getRefillState(product);
              const margin = Number((product.initialQuantity * 0.2).toFixed(2));
              const draft = drafts[product.id] ?? { addQty: "", amount: "" };

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <p className="text-xs text-text-secondary">{product.category ?? "-"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-text-primary">
                      {product.quantity} / {product.initialQuantity} {product.unit ?? ""}
                    </p>
                    <p className="text-xs text-text-secondary">Soglia {product.threshold} (margine {margin})</p>
                    <StockBar quantity={product.quantity} initialQuantity={product.initialQuantity} state={state} />
                  </TableCell>
                  <TableCell>
                    <RefillStateBadge state={state} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="input-base h-9 w-16 text-xs"
                        type="number"
                        placeholder="+qta"
                        value={draft.addQty}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, addQty: e.target.value } }))}
                      />
                      <input
                        className="input-base h-9 w-20 text-xs"
                        type="number"
                        placeholder="EUR"
                        value={draft.amount}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, amount: e.target.value } }))}
                      />
                      <button
                        type="button"
                        className="btn-primary btn-sm inline-flex items-center gap-1"
                        onClick={() => void onRestock(product.id)}
                        disabled={restockPending}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                        Registra
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Drawer>
  );
}
