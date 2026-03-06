"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  qty: string;
  threshold: string;
  max_qty: string;
  consumption_per_checkout: string;
};

type ProductSnapshot = {
  qty: number;
  threshold: number;
  max_qty: number | null;
  consumption_per_checkout: number | null;
};

type BulkUpdateItem = {
  id: string;
  quantity: number;
  threshold: number;
  max_qty: number | null;
  consumption_per_checkout: number | null;
};

function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return fallback;
}

function toNumberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getInputClassName(hasError: boolean, isWarning: boolean): string {
  if (hasError) {
    return "w-full rounded-lg border border-rose-400 bg-rose-50 px-2 py-2 text-sm focus:border-rose-500 focus:outline-none";
  }
  if (isWarning) {
    return "w-full rounded-lg border border-amber-400 bg-amber-50 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none";
  }
  return "w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-blue-600 focus:outline-none";
}

export default function WarehousePage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [originalById, setOriginalById] = useState<Record<string, ProductSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/products");
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Errore caricamento prodotti");
      return;
    }

    const normalizedRows: ProductRow[] = (data.products ?? []).map((p: Record<string, unknown>) => {
      const qty = toNumberOr(p.quantity ?? p.qty, 0);
      const threshold = toNumberOr(p.threshold, 0);
      const maxQty = toOptionalNumber(p.max_qty);
      const consumption = toOptionalNumber(p.consumption_per_checkout);

      return {
        id: String(p.id),
        name: String(p.name ?? "Prodotto"),
        category: p.category === null || p.category === undefined ? null : String(p.category),
        unit: p.unit === null || p.unit === undefined ? null : String(p.unit),
        qty: toStringValue(qty, "0"),
        threshold: toStringValue(threshold, "0"),
        max_qty: toStringValue(maxQty, ""),
        consumption_per_checkout: toStringValue(consumption, ""),
      };
    });

    const snapshots = Object.fromEntries(
      normalizedRows.map((row) => [
        row.id,
        {
          qty: parseRequiredNumber(row.qty) ?? 0,
          threshold: parseRequiredNumber(row.threshold) ?? 0,
          max_qty: parseOptionalNumber(row.max_qty),
          consumption_per_checkout: parseOptionalNumber(row.consumption_per_checkout),
        },
      ]),
    );

    setRows(normalizedRows);
    setOriginalById(snapshots);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const rowState = useMemo(() => {
    return Object.fromEntries(
      rows.map((row) => {
        const qty = parseRequiredNumber(row.qty);
        const threshold = parseRequiredNumber(row.threshold);
        const maxQty = parseOptionalNumber(row.max_qty);
        const consumption = parseOptionalNumber(row.consumption_per_checkout);

        const qtyInvalid = qty === null;
        const thresholdInvalid = threshold === null || threshold < 0;
        const maxQtyInvalid = row.max_qty.trim() !== "" && (maxQty === null || maxQty < 0);
        const consumptionInvalid =
          row.consumption_per_checkout.trim() !== "" &&
          (consumption === null || consumption < 0);

        const qtyNegative = qty !== null && qty < 0;
        const hasInvalid = qtyInvalid || thresholdInvalid || maxQtyInvalid || consumptionInvalid;

        const original = originalById[row.id];
        const changed =
          !!original &&
          !hasInvalid &&
          (original.qty !== qty ||
            original.threshold !== threshold ||
            original.max_qty !== maxQty ||
            original.consumption_per_checkout !== consumption);

        return [
          row.id,
          {
            qty,
            threshold,
            maxQty,
            consumption,
            qtyInvalid,
            thresholdInvalid,
            maxQtyInvalid,
            consumptionInvalid,
            qtyNegative,
            hasInvalid,
            changed,
          },
        ];
      }),
    ) as Record<
      string,
      {
        qty: number | null;
        threshold: number | null;
        maxQty: number | null;
        consumption: number | null;
        qtyInvalid: boolean;
        thresholdInvalid: boolean;
        maxQtyInvalid: boolean;
        consumptionInvalid: boolean;
        qtyNegative: boolean;
        hasInvalid: boolean;
        changed: boolean;
      }
    >;
  }, [rows, originalById]);

  const changedCount = useMemo(
    () => rows.filter((row) => rowState[row.id]?.changed).length,
    [rows, rowState],
  );
  const invalidCount = useMemo(
    () => rows.filter((row) => rowState[row.id]?.hasInvalid).length,
    [rows, rowState],
  );
  const negativeQtyCount = useMemo(
    () => rows.filter((row) => rowState[row.id]?.qtyNegative).length,
    [rows, rowState],
  );

  async function saveBulk() {
    setError("");
    setSuccess("");

    if (invalidCount > 0) {
      setError("Correggi i valori evidenziati prima di salvare.");
      return;
    }

    const updates: BulkUpdateItem[] = rows
      .filter((row) => rowState[row.id]?.changed)
      .map((row) => ({
        id: row.id,
        quantity: rowState[row.id].qty as number,
        threshold: rowState[row.id].threshold as number,
        max_qty: rowState[row.id].maxQty,
        consumption_per_checkout: rowState[row.id].consumption,
      }));

    if (updates.length === 0) {
      setSuccess("Nessuna modifica da salvare.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/products/bulk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Errore salvataggio massivo");
      return;
    }

    setSuccess(`Salvate ${updates.length} righe prodotto.`);
    await loadProducts();
  }

  function setField(id: string, field: keyof Omit<ProductRow, "id" | "name" | "category" | "unit">, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Warehouse</h1>
        <p className="text-sm text-zinc-500">Gestione magazzino prodotti e parametri di consumo</p>
      </header>

      <Card>
        <CardHeader
          title="Magazzino prodotti"
          subtitle="Modifica qty, threshold, max_qty e consumption_per_checkout"
          action={
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              onClick={() => void saveBulk()}
              disabled={saving || loading}
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">{rows.length} prodotti</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{changedCount} modifiche</span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">{invalidCount} invalidi</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{negativeQtyCount} qty negative</span>
        </div>

        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {success && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Caricamento prodotti...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nessun prodotto disponibile.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Nome</TableHeaderCell>
                    <TableHeaderCell>Categoria</TableHeaderCell>
                    <TableHeaderCell>Unità</TableHeaderCell>
                    <TableHeaderCell>Qty</TableHeaderCell>
                    <TableHeaderCell>Threshold</TableHeaderCell>
                    <TableHeaderCell>Max qty</TableHeaderCell>
                    <TableHeaderCell>Consumption / checkout</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const state = rowState[row.id];
                    return (
                      <TableRow key={row.id} className={state?.qtyNegative ? "bg-amber-50/40" : ""}>
                        <TableCell className="font-medium text-zinc-900">{row.name}</TableCell>
                        <TableCell>{row.category ?? "-"}</TableCell>
                        <TableCell>{row.unit ?? "-"}</TableCell>
                        <TableCell>
                          <input
                            className={getInputClassName(Boolean(state?.qtyInvalid), Boolean(state?.qtyNegative))}
                            type="text"
                            inputMode="decimal"
                            value={row.qty}
                            onChange={(e) => setField(row.id, "qty", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={getInputClassName(Boolean(state?.thresholdInvalid), false)}
                            type="text"
                            inputMode="decimal"
                            value={row.threshold}
                            onChange={(e) => setField(row.id, "threshold", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={getInputClassName(Boolean(state?.maxQtyInvalid), false)}
                            type="text"
                            inputMode="decimal"
                            value={row.max_qty}
                            onChange={(e) => setField(row.id, "max_qty", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={getInputClassName(Boolean(state?.consumptionInvalid), false)}
                            type="text"
                            inputMode="decimal"
                            value={row.consumption_per_checkout}
                            onChange={(e) => setField(row.id, "consumption_per_checkout", e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((row) => {
                const state = rowState[row.id];
                return (
                  <article
                    key={row.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      state?.qtyNegative ? "border-amber-300" : "border-zinc-200"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{row.name}</p>
                        <p className="text-xs text-zinc-500">
                          {row.category ?? "Senza categoria"} · {row.unit ?? "-"}
                        </p>
                      </div>
                      {state?.qtyNegative ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Qty negativa
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3">
                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-zinc-600">Qty</span>
                        <input
                          className={getInputClassName(Boolean(state?.qtyInvalid), Boolean(state?.qtyNegative))}
                          type="text"
                          inputMode="decimal"
                          value={row.qty}
                          onChange={(e) => setField(row.id, "qty", e.target.value)}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-zinc-600">Threshold</span>
                        <input
                          className={getInputClassName(Boolean(state?.thresholdInvalid), false)}
                          type="text"
                          inputMode="decimal"
                          value={row.threshold}
                          onChange={(e) => setField(row.id, "threshold", e.target.value)}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-zinc-600">Max qty</span>
                        <input
                          className={getInputClassName(Boolean(state?.maxQtyInvalid), false)}
                          type="text"
                          inputMode="decimal"
                          value={row.max_qty}
                          onChange={(e) => setField(row.id, "max_qty", e.target.value)}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-zinc-600">Consumption per checkout</span>
                        <input
                          className={getInputClassName(Boolean(state?.consumptionInvalid), false)}
                          type="text"
                          inputMode="decimal"
                          value={row.consumption_per_checkout}
                          onChange={(e) => setField(row.id, "consumption_per_checkout", e.target.value)}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
