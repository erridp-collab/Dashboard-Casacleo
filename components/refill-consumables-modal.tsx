"use client";

import { Drawer } from "@/components/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { RowSkeleton } from "@/components/skeleton";
import { RefillStateBadge } from "@/components/refill-state-badge";
import { getRefillState, type StockStatus } from "@/lib/refill";
import type { ProductRow } from "@/lib/inventory-types";

const STATUS_OPTIONS: Array<{ value: StockStatus; label: string; activeClass: string }> = [
  { value: "PIENO", label: "Pieno", activeClass: "bg-semantic-success/15 text-semantic-success" },
  { value: "A_META", label: "A metà", activeClass: "bg-semantic-warning/15 text-semantic-warning" },
  { value: "TERMINATO", label: "Finito", activeClass: "bg-semantic-error/15 text-semantic-error" },
];

type Props = {
  open: boolean;
  products: ProductRow[];
  loadingProducts: boolean;
  savingStatusId: string;
  onUpdateStatus: (id: string, stockStatus: StockStatus) => Promise<void>;
  onClose: () => void;
};

export function RefillConsumablesModal({ open, products, loadingProducts, savingStatusId, onUpdateStatus, onClose }: Props) {
  function statusSelector(product: ProductRow) {
    return (
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => {
          const active = product.stockStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={savingStatusId === product.id}
              onClick={() => void onUpdateStatus(product.id, option.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
                active
                  ? option.activeClass
                  : "border border-border-strong/20 bg-surface text-text-secondary hover:bg-surface-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Consumabili a Stati" widthClassName="sm:max-w-[560px]">
      <p className="mb-4 text-xs text-text-secondary">{products.length} prodotti monitorati a 3 stati</p>

      {loadingProducts ? (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Prodotto</TableHeaderCell>
              <TableHeaderCell>Stato</TableHeaderCell>
              <TableHeaderCell>Aggiorna</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <RowSkeleton key={i} cols={3} />
            ))}
          </TableBody>
        </Table>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Nessun consumabile da monitorare</p>
          <p className="text-xs text-text-secondary">Gli stati possibili sono Pieno, A metà e Finito.</p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Prodotto</TableHeaderCell>
              <TableHeaderCell>Stato</TableHeaderCell>
              <TableHeaderCell>Aggiorna</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {products.map((product) => {
              const state = getRefillState(product);
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <p className="text-xs text-text-secondary">{product.category ?? "-"}</p>
                  </TableCell>
                  <TableCell>
                    <RefillStateBadge state={state} />
                  </TableCell>
                  <TableCell>{statusSelector(product)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Drawer>
  );
}
