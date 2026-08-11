"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { RowSkeleton } from "@/components/skeleton";
import { RefillStateBadge } from "@/components/refill-state-badge";
import { getRefillState, type RefillState } from "@/lib/refill";
import type { ProductRow, RestockDraft } from "@/lib/inventory-types";

function StockBar({ quantity, initialQuantity, state }: { quantity: number; initialQuantity: number; state: RefillState }) {
  const pct = initialQuantity > 0 ? Math.min(100, Math.max(0, (quantity / initialQuantity) * 100)) : 0;
  const color = state === "DA_RIFORNIRE" ? "bg-rose-500" : state === "IN_ESAURIMENTO" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Props = {
  products: ProductRow[];
  loadingProducts: boolean;
  drafts: Record<string, RestockDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, RestockDraft>>>;
  restockPending: boolean;
  onRestock: (id: string) => Promise<void>;
  onClose: () => void;
};

export function RefillLinenModal({
  products,
  loadingProducts,
  drafts,
  setDrafts,
  restockPending,
  onRestock,
  onClose,
}: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
      <div
        className="w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        style={{ maxHeight: "90dvh", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex justify-center sm:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Biancheria a Quantità</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{products.length} prodotti gestiti a pezzi/set</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingProducts ? (
          <>
            <div className="space-y-3 md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-zinc-100 p-4">
                  <div className="h-4 w-32 rounded bg-zinc-200" />
                  <div className="mt-2 h-3 w-20 rounded bg-zinc-200" />
                  <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-200" />
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Prodotto</TableHeaderCell>
                    <TableHeaderCell>Categoria</TableHeaderCell>
                    <TableHeaderCell>Qtà iniziale</TableHeaderCell>
                    <TableHeaderCell>Qtà attuale</TableHeaderCell>
                    <TableHeaderCell>Soglia</TableHeaderCell>
                    <TableHeaderCell>Stato</TableHeaderCell>
                    <TableHeaderCell>Rifornisci</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>{[1, 2, 3].map((i) => <RowSkeleton key={i} cols={7} />)}</TableBody>
              </Table>
            </div>
          </>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-medium text-zinc-700">Nessuna biancheria da monitorare</p>
            <p className="text-xs text-zinc-400">Set letto, asciugamani e tessili restano gestiti a quantità.</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {products.map((product) => {
              const state = getRefillState(product);
              const margin = Number((product.initialQuantity * 0.2).toFixed(2));
              const draft = drafts[product.id] ?? { addQty: "", amount: "" };

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
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                    <p>Iniziale: <span className="font-medium text-zinc-800">{product.initialQuantity} {product.unit ?? ""}</span></p>
                    <p>Attuale: <span className="font-medium text-zinc-800">{product.quantity} {product.unit ?? ""}</span></p>
                    <p>Soglia: <span className="font-medium text-zinc-800">{product.threshold}</span></p>
                    <p>Margine: <span className="font-medium text-zinc-800">{margin}</span></p>
                  </div>
                  <StockBar quantity={product.quantity} initialQuantity={product.initialQuantity} state={state} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input
                      className="input-base"
                      type="number"
                      placeholder="+qta"
                      value={draft.addQty}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, addQty: e.target.value } }))
                      }
                    />
                    <input
                      className="input-base"
                      type="number"
                      placeholder="EUR"
                      value={draft.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, amount: e.target.value } }))
                      }
                    />
                  </div>
                  <button
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    onClick={() => void onRestock(product.id)}
                    disabled={restockPending}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Registra rifornimento
                  </button>
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
                <TableHeaderCell>Qtà iniziale</TableHeaderCell>
                <TableHeaderCell>Qtà attuale</TableHeaderCell>
                <TableHeaderCell>Soglia</TableHeaderCell>
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
                    <TableCell className="font-medium text-zinc-900">
                      {product.name}
                      <StockBar quantity={product.quantity} initialQuantity={product.initialQuantity} state={state} />
                    </TableCell>
                    <TableCell>{product.category ?? "-"}</TableCell>
                    <TableCell>{product.initialQuantity} {product.unit ?? ""}</TableCell>
                    <TableCell>{product.quantity} {product.unit ?? ""}</TableCell>
                    <TableCell>{product.threshold} (margine {margin})</TableCell>
                    <TableCell>
                      <RefillStateBadge state={state} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="input-base w-20"
                          type="number"
                          placeholder="+qta"
                          value={draft.addQty}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, addQty: e.target.value } }))
                          }
                        />
                        <input
                          className="input-base w-24"
                          type="number"
                          placeholder="EUR"
                          value={draft.amount}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, amount: e.target.value } }))
                          }
                        />
                        <button
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          onClick={() => void onRestock(product.id)}
                          disabled={restockPending}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Registra
                        </button>
                      </div>
                    </TableCell>
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
