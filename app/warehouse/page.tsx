"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";

type StockStatus = "PIENO" | "A_META" | "TERMINATO";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock_status: StockStatus | null;
};

const STATUS_CYCLE: StockStatus[] = ["PIENO", "A_META", "TERMINATO"];
const STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; text: string; dot: string }> = {
  PIENO:     { label: "Pieno",  bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  A_META:    { label: "A metà", bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400"   },
  TERMINATO: { label: "Finito", bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"    },
};

function isCleaningProduct(category: string | null): boolean {
  return Boolean(category && category.toLowerCase().includes("pulizia"));
}

export default function WarehousePage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/products");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Errore caricamento prodotti"); return; }

    const normalized: ProductRow[] = (data.products ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? p.sku ?? ""),
      name: String(p.name ?? "Prodotto"),
      category: p.category == null ? null : String(p.category),
      unit: p.unit == null ? null : String(p.unit),
      stock_status: (["PIENO", "A_META", "TERMINATO"].includes(String(p.stock_status ?? ""))
        ? (p.stock_status as StockStatus)
        : null),
    }));

    setRows(normalized);
  }

  useEffect(() => { void loadProducts(); }, []);

  async function cycleStockStatus(id: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const current = row.stock_status ?? "PIENO";
        const idx = STATUS_CYCLE.indexOf(current);
        return { ...row, stock_status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
      }),
    );

    const row = rows.find((r) => r.id === id);
    const current = row?.stock_status ?? "PIENO";
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    await fetch("/api/products/stock-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ id, stock_status: next }] }),
    }).catch(console.error);
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Magazzino</h1>
        <p className="text-sm text-zinc-500">Stato scorte prodotti consumabili</p>
      </header>

      <Card>
        <CardHeader title="Prodotti" subtitle="Clicca sul badge per aggiornare lo stato" />

        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Caricamento...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nessun prodotto disponibile.</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Nome</TableHeaderCell>
                    <TableHeaderCell>Categoria</TableHeaderCell>
                    <TableHeaderCell>Unità</TableHeaderCell>
                    <TableHeaderCell>Stato</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-zinc-900">{row.name}</TableCell>
                      <TableCell>{row.category ?? "-"}</TableCell>
                      <TableCell>{row.unit ?? "-"}</TableCell>
                      <TableCell>
                        {isCleaningProduct(row.category) && row.stock_status ? (
                          <button
                            onClick={() => void cycleStockStatus(row.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${STATUS_CONFIG[row.stock_status].bg} ${STATUS_CONFIG[row.stock_status].text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[row.stock_status].dot}`} />
                            {STATUS_CONFIG[row.stock_status].label}
                          </button>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="space-y-2 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{row.name}</p>
                    <p className="text-xs text-zinc-500">{row.category ?? "Senza categoria"} · {row.unit ?? "-"}</p>
                  </div>
                  {isCleaningProduct(row.category) && row.stock_status ? (
                    <button
                      onClick={() => void cycleStockStatus(row.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${STATUS_CONFIG[row.stock_status].bg} ${STATUS_CONFIG[row.stock_status].text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[row.stock_status].dot}`} />
                      {STATUS_CONFIG[row.stock_status].label}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
