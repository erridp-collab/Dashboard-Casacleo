"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { getRefillState, isMonitoredRefillProduct } from "@/lib/refill";
import { RowSkeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";

function StockBar({ quantity, initialQuantity, state }: { quantity: number; initialQuantity: number; state: "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE" }) {
  const pct = initialQuantity > 0 ? Math.min(100, Math.max(0, (quantity / initialQuantity) * 100)) : 0;
  const color = state === "DA_RIFORNIRE" ? "bg-rose-500" : state === "IN_ESAURIMENTO" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  threshold: number;
  initialQuantity: number;
};

type RestockDraft = {
  addQty: string;
  amount: string;
};

function toNum(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RestockDraft>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  async function loadProducts() {
    setError("");
    setLoadingProducts(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore caricamento");

    const rows: ProductRow[] = (data.products ?? []).map((p: Record<string, unknown>) => {
      const quantity = toNum(p.quantity ?? p.qty, 0);
      const initialQuantityRaw = p.max_qty === null || p.max_qty === undefined ? quantity : toNum(p.max_qty, quantity);
      const initialQuantity = initialQuantityRaw > 0 ? initialQuantityRaw : quantity;

      return {
        id: String(p.id ?? p.sku ?? ""),
        name: String(p.name ?? "Prodotto"),
        category: p.category === null || p.category === undefined ? null : String(p.category),
        unit: p.unit === null || p.unit === undefined ? null : String(p.unit),
        quantity,
        threshold: toNum(p.threshold, 0),
        initialQuantity,
      };
    });

    setProducts(rows);
    setLoadingProducts(false);
    setDrafts((prev) => {
      const next: Record<string, RestockDraft> = {};
      for (const row of rows) {
        next[row.id] = prev[row.id] ?? { addQty: "", amount: "" };
      }
      return next;
    });
  }

  async function restockProduct(id: string) {
    const draft = drafts[id] ?? { addQty: "", amount: "" };
    const addQty = toNum(draft.addQty.replace(",", "."), NaN);
    const amount = draft.amount.trim() === "" ? null : toNum(draft.amount.replace(",", "."), NaN);

    if (!Number.isFinite(addQty) || addQty <= 0) {
      setError("Quantita rifornimento non valida");
      return;
    }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      setError("Importo rifornimento non valido");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/products/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        add_quantity: addQty,
        amount,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const msg = data.error ?? "Errore rifornimento";
      setError(msg);
      toast(msg, "error");
      return;
    }

    setSuccess("Rifornimento registrato con successo");
    toast("Rifornimento registrato con successo", "success");
    setDrafts((prev) => ({ ...prev, [id]: { addQty: "", amount: "" } }));
    await loadProducts();
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const visibleProducts = useMemo(() => {
    const monitored = products.filter((product) => isMonitoredRefillProduct(product));
    const alerting = monitored.filter((product) => {
      const state = getRefillState(product);
      return state !== "OK";
    });
    // Default view: alerting first, fallback to monitored defaults.
    return alerting.length > 0 ? alerting : monitored;
  }, [products]);

  function stateBadge(state: "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE") {
    if (state === "DA_RIFORNIRE") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          DA RIFORNIRE
        </span>
      );
    }
    if (state === "IN_ESAURIMENTO") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          IN ESAURIMENTO
        </span>
      );
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">OK</span>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Rifornimento</h1>
        <p className="text-sm text-zinc-500">
          Prodotti monitorati vicini alla soglia o da rifornire
        </p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <Card>
        <CardHeader title="Rifornimenti operativi" subtitle={`${visibleProducts.length} prodotti da monitorare`} />

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
                <TableHead><tr><TableHeaderCell>Prodotto</TableHeaderCell><TableHeaderCell>Stato</TableHeaderCell><TableHeaderCell>Rifornisci</TableHeaderCell></tr></TableHead>
                <TableBody>{[1, 2, 3].map((i) => <RowSkeleton key={i} cols={7} />)}</TableBody>
              </Table>
            </div>
          </>
        ) : visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-medium text-zinc-700">Scorte a posto</p>
            <p className="text-xs text-zinc-400">Nessun prodotto in esaurimento o da rifornire</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {visibleProducts.map((product) => {
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
                    {stateBadge(state)}
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
                      className="h-10 rounded-lg border border-zinc-300 px-2 text-sm focus:border-blue-600 focus:outline-none"
                      type="number"
                      placeholder="+qta"
                      value={draft.addQty}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, addQty: e.target.value } }))
                      }
                    />
                    <input
                      className="h-10 rounded-lg border border-zinc-300 px-2 text-sm focus:border-blue-600 focus:outline-none"
                      type="number"
                      placeholder="EUR"
                      value={draft.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, amount: e.target.value } }))
                      }
                    />
                  </div>
                  <button
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => void restockProduct(product.id)}
                    disabled={loading}
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
                <TableHeaderCell>Q.ta iniziale</TableHeaderCell>
                <TableHeaderCell>Q.ta attuale</TableHeaderCell>
                <TableHeaderCell>Soglia</TableHeaderCell>
                <TableHeaderCell>Stato</TableHeaderCell>
                <TableHeaderCell>Rifornisci</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visibleProducts.map((product) => {
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
                      {stateBadge(state)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                          type="number"
                          placeholder="+qta"
                          value={draft.addQty}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, addQty: e.target.value } }))
                          }
                        />
                        <input
                          className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                          type="number"
                          placeholder="EUR"
                          value={draft.amount}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, amount: e.target.value } }))
                          }
                        />
                        <button
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => void restockProduct(product.id)}
                          disabled={loading}
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
      </Card>
    </section>
  );
}
