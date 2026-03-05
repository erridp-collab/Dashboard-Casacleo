"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import type { Product } from "@/types/db";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    const res = await fetch("/api/products");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore caricamento");
    const normalized = (data.products ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: String(p.name ?? "Prodotto"),
      quantity: Number(p.quantity ?? 0),
      threshold: Number(p.threshold ?? 0),
      unit: p.unit ? String(p.unit) : null,
      updated_at: p.updated_at ? String(p.updated_at) : undefined,
    }));
    setProducts(normalized);
  }

  async function saveAll() {
    setSaving(true);
    const updates = products.map((p) => ({ id: p.id, quantity: p.quantity, threshold: p.threshold }));
    const res = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Errore salvataggio");
    await loadProducts();
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const lowStock = useMemo(() => products.filter((p) => p.quantity < p.threshold).length, [products]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Inventory</h1>
        <p className="text-sm text-zinc-500">{lowStock} prodotti sotto soglia</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card>
        <CardHeader
          title="Stock prodotti"
          subtitle="Aggiorna quantità e soglia"
          action={
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => void saveAll()}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvataggio..." : "Salva aggiornamenti"}
            </button>
          }
        />

        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nessun prodotto presente.</p>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Prodotto</TableHeaderCell>
                <TableHeaderCell>Unita</TableHeaderCell>
                <TableHeaderCell>Quantita</TableHeaderCell>
                <TableHeaderCell>Soglia</TableHeaderCell>
                <TableHeaderCell>Stato</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {products.map((p) => {
                const below = p.quantity < p.threshold;
                return (
                  <TableRow key={p.id} className={below ? "bg-amber-50/50" : ""}>
                    <TableCell className="font-medium text-zinc-900">{p.name}</TableCell>
                    <TableCell>{p.unit ?? "-"}</TableCell>
                    <TableCell>
                      <input
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                        type="number"
                        value={p.quantity}
                        onChange={(e) =>
                          setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, quantity: Number(e.target.value) } : x)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                        type="number"
                        value={p.threshold}
                        onChange={(e) =>
                          setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, threshold: Number(e.target.value) } : x)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {below ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Sotto soglia
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          OK
                        </span>
                      )}
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

