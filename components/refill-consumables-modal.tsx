"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { RowSkeleton } from "@/components/skeleton";
import { RefillStateBadge } from "@/components/refill-state-badge";
import { getRefillState, type StockStatus } from "@/lib/refill";
import type { ProductRow } from "@/lib/inventory-types";

const STATUS_OPTIONS: Array<{ value: StockStatus; label: string; tone: string }> = [
  { value: "PIENO", label: "Pieno", tone: "bg-emerald-100 text-emerald-700" },
  { value: "A_META", label: "A metà", tone: "bg-amber-100 text-amber-700" },
  { value: "TERMINATO", label: "Finito", tone: "bg-rose-100 text-rose-700" },
];

type Props = {
  products: ProductRow[];
  loadingProducts: boolean;
  savingStatusId: string;
  onUpdateStatus: (id: string, stockStatus: StockStatus) => Promise<void>;
  onClose: () => void;
};

export function RefillConsumablesModal({ products, loadingProducts, savingStatusId, onUpdateStatus, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? option.tone
                  : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
              } disabled:opacity-50`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
      <div
        className="w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        style={{ maxHeight: "90dvh", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex justify-center sm:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Consumabili a Stati</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{products.length} prodotti monitorati a 3 stati</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingProducts ? (
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Prodotto</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Stato</TableHeaderCell>
                  <TableHeaderCell>Aggiorna</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>{[1, 2, 3].map((i) => <RowSkeleton key={i} cols={4} />)}</TableBody>
            </Table>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">OK</span>
            <p className="text-sm font-medium text-zinc-700">Nessun consumabile da monitorare</p>
            <p className="text-xs text-zinc-400">Gli stati possibili sono Pieno, A metà e Finito.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {products.map((product) => {
                const state = getRefillState(product);
                return (
                  <article
                    key={product.id}
                    className={`rounded-xl border p-3 ${
                      state === "DA_RIFORNIRE"
                        ? "border-rose-200 bg-rose-50/60"
                        : state === "IN_ESAURIMENTO"
                          ? "border-amber-200 bg-amber-50/50"
                          : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">{product.name}</h3>
                        <p className="text-xs text-zinc-500">{product.category ?? "-"}</p>
                      </div>
                      <RefillStateBadge state={state} />
                    </div>
                    <div className="mt-3">{statusSelector(product)}</div>
                  </article>
                );
              })}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Prodotto</TableHeaderCell>
                    <TableHeaderCell>Categoria</TableHeaderCell>
                    <TableHeaderCell>Stato</TableHeaderCell>
                    <TableHeaderCell>Aggiorna</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {products.map((product) => {
                    const state = getRefillState(product);
                    return (
                      <TableRow
                        key={product.id}
                        className={
                          state === "DA_RIFORNIRE"
                            ? "bg-rose-50/50"
                            : state === "IN_ESAURIMENTO"
                              ? "bg-amber-50/40"
                              : ""
                        }
                      >
                        <TableCell className="font-medium text-zinc-900">{product.name}</TableCell>
                        <TableCell>{product.category ?? "-"}</TableCell>
                        <TableCell><RefillStateBadge state={state} /></TableCell>
                        <TableCell>{statusSelector(product)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
