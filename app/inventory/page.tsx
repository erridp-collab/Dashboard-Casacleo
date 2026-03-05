"use client";

import { useEffect, useMemo, useState } from "react";
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
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">{lowStock} prodotti sotto soglia</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex justify-end">
          <button
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            onClick={() => void saveAll()}
            disabled={saving}
          >
            {saving ? "Salvataggio..." : "Salva aggiornamenti"}
          </button>
        </div>

        <div className="space-y-2">
          {products.map((p) => {
            const below = p.quantity < p.threshold;
            return (
              <div key={p.id} className={`grid gap-3 rounded-xl border p-3 md:grid-cols-5 ${below ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.unit ?? "-"}</p>
                </div>
                <label className="text-xs text-slate-600">
                  Quantita
                  <input
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    type="number"
                    value={p.quantity}
                    onChange={(e) =>
                      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, quantity: Number(e.target.value) } : x)))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Soglia
                  <input
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    type="number"
                    value={p.threshold}
                    onChange={(e) =>
                      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, threshold: Number(e.target.value) } : x)))
                    }
                  />
                </label>
                <div className="flex items-center">
                  {below ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Sotto soglia</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">OK</span>
                  )}
                </div>
              </div>
            );
          })}
          {products.length === 0 && <p className="text-sm text-slate-500">Nessun prodotto.</p>}
        </div>
      </div>
    </section>
  );
}

