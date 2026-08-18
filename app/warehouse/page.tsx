"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { InlineAlert } from "@/components/inline-alert";
import { PageHeader } from "@/components/page-header";

type StockStatus = "PIENO" | "A_META" | "TERMINATO";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock_status: StockStatus | null;
};

type ProductsResponse = {
  products?: Array<Record<string, unknown>>;
};

const STATUS_CYCLE: StockStatus[] = ["PIENO", "A_META", "TERMINATO"];
const STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; text: string; dot: string }> = {
  PIENO: {
    label: "Pieno",
    bg: "bg-semantic-success/10",
    text: "text-semantic-success",
    dot: "bg-semantic-success",
  },
  A_META: {
    label: "A metà",
    bg: "bg-semantic-warning/10",
    text: "text-text-primary",
    dot: "bg-semantic-warning",
  },
  TERMINATO: {
    label: "Finito",
    bg: "bg-semantic-error/10",
    text: "text-text-primary",
    dot: "bg-semantic-error",
  },
};

function isCleaningProduct(category: string | null): boolean {
  return Boolean(category && category.toLowerCase().includes("pulizia"));
}

export default function WarehousePage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const productsAbortRef = useRef<AbortController | null>(null);

  async function loadProducts(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    const result = await clientFetchJson<ProductsResponse>("/api/products", { signal });
    setLoading(false);
    if (!result.ok) {
      if (!result.aborted) setError(result.error ?? "Errore caricamento prodotti");
      return;
    }

    const normalized: ProductRow[] = (result.data.products ?? []).map((p) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? "Prodotto"),
      category: p.category == null ? null : String(p.category),
      unit: p.unit == null ? null : String(p.unit),
      stock_status: (["PIENO", "A_META", "TERMINATO"].includes(String(p.stock_status ?? ""))
        ? (p.stock_status as StockStatus)
        : null),
    }));

    setRows(normalized);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      productsAbortRef.current?.abort();
      const ctrl = new AbortController();
      productsAbortRef.current = ctrl;
      void loadProducts(ctrl.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      productsAbortRef.current?.abort();
    };
  }, []);

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
      <PageHeader title="Magazzino" subtitle="Stato scorte prodotti consumabili" />

      <Card>
        <CardHeader title="Prodotti" subtitle="Clicca sul badge per aggiornare lo stato" />

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-text-secondary">Caricamento...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">Nessun prodotto disponibile.</p>
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
                      <TableCell className="font-medium text-text-primary">{row.name}</TableCell>
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
                          <span className="text-text-muted">-</span>
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
                <article key={row.id} className="flex items-center justify-between rounded-xl border border-border-strong/12 bg-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{row.name}</p>
                    <p className="text-xs text-text-secondary">{row.category ?? "Senza categoria"} · {row.unit ?? "-"}</p>
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
