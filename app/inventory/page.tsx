"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";

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

const MONITORED_CATEGORIES = new Set([
  "PRODOTTI PER PULIZIA",
  "CAFFE",
  "ASCIUGAMANI E BAGNO",
  "LENZUOLA E COPERTE",
  "TESSILI E BIANCHERIA",
  "CUCINA",
]);

function toNum(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stateForProduct(product: ProductRow): "OK" | "IN_ESAURIMENTO" | "DA_RIFORNIRE" {
  const margin = product.initialQuantity * 0.2;
  if (product.quantity <= product.threshold) return "DA_RIFORNIRE";
  if (product.quantity <= product.threshold + margin) return "IN_ESAURIMENTO";
  return "OK";
}

function isMonitoredProduct(product: ProductRow): boolean {
  const categoryKey = String(product.category ?? "").toUpperCase();
  if (MONITORED_CATEGORIES.has(categoryKey)) return true;

  const nameKey = product.name.toUpperCase();
  return (
    nameKey.includes("CAFFE") ||
    nameKey.includes("CARTA IGIENICA") ||
    nameKey.includes("SPUGNETT") ||
    nameKey.includes("ASCIUGAMANI") ||
    nameKey.includes("LENZUO") ||
    nameKey.includes("COPRIPIUMINI") ||
    nameKey.includes("TAPPETINI")
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RestockDraft>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    setError("");
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
      setError(data.error ?? "Errore rifornimento");
      return;
    }

    setSuccess("Rifornimento registrato con successo");
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
    const monitored = products.filter((product) => isMonitoredProduct(product));
    const alerting = monitored.filter((product) => {
      const state = stateForProduct(product);
      return state !== "OK";
    });
    // Default view: alerting first, fallback to monitored defaults.
    return alerting.length > 0 ? alerting : monitored;
  }, [products]);

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

        {visibleProducts.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nessun prodotto in esaurimento.</p>
        ) : (
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
                const state = stateForProduct(product);
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
                    <TableCell className="font-medium text-zinc-900">{product.name}</TableCell>
                    <TableCell>{product.category ?? "-"}</TableCell>
                    <TableCell>{product.initialQuantity} {product.unit ?? ""}</TableCell>
                    <TableCell>{product.quantity} {product.unit ?? ""}</TableCell>
                    <TableCell>{product.threshold} (margine {margin})</TableCell>
                    <TableCell>
                      {state === "DA_RIFORNIRE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          DA RIFORNIRE
                        </span>
                      ) : state === "IN_ESAURIMENTO" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          IN ESAURIMENTO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          OK
                        </span>
                      )}
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
        )}
      </Card>
    </section>
  );
}
