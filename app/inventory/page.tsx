"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Package, ShoppingCart } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { getRefillState, isMonitoredRefillProduct, isStatusManagedRefillProduct, type StockStatus } from "@/lib/refill";
import { RowSkeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import * as XLSX from "xlsx";

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
  maxQty: number | null;
  consumptionPerCheckout: number | null;
  stockStatus: StockStatus | null;
};

type RestockDraft = {
  addQty: string;
  amount: string;
};

type CsvPreviewRow = {
  id: string;
  name: string;
  quantityNow: number;
  quantityNext: number;
  thresholdNow: number;
  thresholdNext: number;
  maxQtyNow: number | null;
  maxQtyNext: number | null;
  consumptionNow: number | null;
  consumptionNext: number | null;
};

type ProductApiRow = {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  quantity: number;
  threshold?: number;
  max_qty?: number | null;
  consumption_per_checkout?: number | null;
  stock_status?: StockStatus | null;
};

type ProductsResponse = {
  products?: ProductApiRow[];
};

const STATUS_OPTIONS: Array<{ value: StockStatus; label: string; tone: string }> = [
  { value: "PIENO", label: "Pieno", tone: "bg-emerald-100 text-emerald-700" },
  { value: "A_META", label: "A meta", tone: "bg-amber-100 text-amber-700" },
  { value: "TERMINATO", label: "Finito", tone: "bg-rose-100 text-rose-700" },
];

function toNum(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(",", ".");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headerLine = lines[0];
  const commaCount = headerLine.split(",").length;
  const semiCount = headerLine.split(";").length;
  const delimiter = semiCount > commaCount ? ";" : ",";
  const headers = parseCsvLine(headerLine, delimiter).map((h) => normalizeText(h));
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows };
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RestockDraft>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvColumns, setCsvColumns] = useState({ threshold: false, maxQty: false, consumption: false });
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<"consumabili" | "biancheria">("biancheria");
  const productsAbortRef = useRef<AbortController | null>(null);
  const productsRequestSeqRef = useRef(0);

  async function loadProducts(signal?: AbortSignal) {
    const seq = ++productsRequestSeqRef.current;
    setError("");
    setLoadingProducts(true);
    try {
      const result = await clientFetchJson<ProductsResponse>("/api/products", { signal });
      if (seq !== productsRequestSeqRef.current) return;
      if (!result.ok) {
        if (!result.aborted) setError(result.error ?? "Errore caricamento");
        return;
      }

      const rows: ProductRow[] = (result.data.products ?? []).map((p) => {
        const quantity = toNum(p.quantity, 0);
        const initialQuantityRaw = p.max_qty === null || p.max_qty === undefined ? quantity : toNum(p.max_qty, quantity);
        const initialQuantity = initialQuantityRaw > 0 ? initialQuantityRaw : quantity;
        const maxQty = p.max_qty === null || p.max_qty === undefined ? null : toNum(p.max_qty, quantity);
        const consumptionPerCheckout = p.consumption_per_checkout === null || p.consumption_per_checkout === undefined
          ? null
          : toNum(p.consumption_per_checkout, 0);

        return {
          id: String(p.id),
          name: String(p.name ?? "Prodotto"),
          category: p.category === null || p.category === undefined ? null : String(p.category),
          unit: p.unit === null || p.unit === undefined ? null : String(p.unit),
          quantity,
          threshold: toNum(p.threshold, 0),
          initialQuantity,
          maxQty,
          consumptionPerCheckout,
          stockStatus: p.stock_status === null || p.stock_status === undefined ? null : p.stock_status,
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
    } catch (e: unknown) {
      console.error("Failed to load products", e);
      setError("Errore caricamento");
    } finally {
      setLoadingProducts(false);
    }
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
    const result = await clientFetchJson<{ ok?: boolean; quantity?: number }>("/api/products/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        add_quantity: addQty,
        amount,
      }),
    });
    setLoading(false);
    if (!result.ok) {
      const msg = result.error ?? "Errore rifornimento";
      setError(msg);
      toast(msg, "error");
      return;
    }

    setSuccess("Rifornimento registrato con successo");
    toast("Rifornimento registrato con successo", "success");
    setDrafts((prev) => ({ ...prev, [id]: { addQty: "", amount: "" } }));
    await loadProducts();
  }

  async function updateProductStatus(id: string, stockStatus: StockStatus) {
    setSavingStatusId(id);
    setError("");
    setSuccess("");
    const result = await clientFetchJson<{ ok?: boolean }>("/api/products/stock-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ id, stock_status: stockStatus }] }),
    });
    setSavingStatusId("");
    if (!result.ok) {
      const msg = result.error ?? "Errore aggiornamento stato";
      setError(msg);
      toast(msg, "error");
      return;
    }

    setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, stockStatus } : product)));
    toast("Stato consumabile aggiornato", "success");
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

  const visibleStatusProducts = useMemo(() => {
    const monitored = products.filter((product) => isMonitoredRefillProduct(product));
    const statusManaged = monitored.filter((product) => isStatusManagedRefillProduct(product));
    const alerting = statusManaged.filter((product) => {
      const state = getRefillState(product);
      return state !== "OK";
    });
    return alerting.length > 0 ? alerting : statusManaged;
  }, [products]);

  const visibleQuantityProducts = useMemo(() => {
    const monitored = products.filter((product) => isMonitoredRefillProduct(product));
    const quantityManaged = monitored.filter((product) => !isStatusManagedRefillProduct(product));
    const alerting = quantityManaged.filter((product) => {
      const state = getRefillState(product);
      return state !== "OK";
    });
    return alerting.length > 0 ? alerting : quantityManaged;
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
              onClick={() => void updateProductStatus(product.id, option.value)}
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

  function buildTemplateCsv() {
    const headers = ["id", "prodotto", "qty", "threshold", "max_qty", "consumption_per_checkout"];
    const rows = products.map((p) => [
      p.id,
      `"${String(p.name).replace(/"/g, "\"\"")}"`,
      String(p.quantity),
      String(p.threshold),
      p.maxQty ?? "",
      p.consumptionPerCheckout ?? "",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  function downloadTemplate() {
    const csv = buildTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "magazzino_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateXlsx() {
    const headers = ["id", "prodotto", "qty", "threshold", "max_qty", "consumption_per_checkout"];
    const rows = products.map((p) => [
      p.id,
      p.name,
      p.quantity,
      p.threshold,
      p.maxQty ?? "",
      p.consumptionPerCheckout ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Magazzino");
    XLSX.writeFile(wb, "magazzino_template.xlsx");
  }

  function parseXlsxBuffer(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (raw.length === 0) return { headers: [], rows: [] };
    const headers = (raw[0] as unknown[]).map((h) => normalizeText(h));
    const rows = raw.slice(1).map((r) => (r as unknown[]).map((cell) => String(cell ?? "")));
    return { headers, rows };
  }

  function handleCsvFile(file: File) {
    setCsvFileName(file.name);
    setCsvErrors([]);
    setCsvPreview([]);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows } = isExcel
        ? parseXlsxBuffer(reader.result as ArrayBuffer)
        : parseCsv(String(reader.result ?? ""));
      const headerIndex = new Map(headers.map((h, idx) => [h, idx]));
      const alias = (keys: string[]) => keys.find((key) => headerIndex.has(key)) ?? null;

      const idKey = alias(["id", "sku", "codice"]);
      const nameKey = alias(["prodotto", "name", "nome", "articolo"]);
      const qtyKey = alias(["qty", "quantity", "quantita", "qta", "disponibile"]);
      const thresholdKey = alias(["threshold", "soglia"]);
      const maxQtyKey = alias(["max_qty", "massimo", "max"]);
      const consKey = alias(["consumption_per_checkout", "consumo_per_checkout", "cons_checkout"]);

      if (!qtyKey || (!idKey && !nameKey)) {
        setCsvErrors([
          "Colonne minime richieste: qty/disponibile e id oppure prodotto.",
        ]);
        return;
      }
      setCsvColumns({
        threshold: Boolean(thresholdKey),
        maxQty: Boolean(maxQtyKey),
        consumption: Boolean(consKey),
      });

      const byId = new Map(products.map((p) => [normalizeText(p.id), p]));
      const byName = new Map(products.map((p) => [normalizeText(p.name), p]));
      const nextErrors: string[] = [];
      const nextPreview: CsvPreviewRow[] = [];
      const seen = new Set<string>();

      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const rawId = idKey ? normalizeText(row[headerIndex.get(idKey) ?? -1]) : "";
        const rawName = nameKey ? normalizeText(row[headerIndex.get(nameKey) ?? -1]) : "";
        const product = rawId ? byId.get(rawId) : rawName ? byName.get(rawName) : undefined;

        if (!product) {
          nextErrors.push(`Riga ${rowNum}: prodotto non riconosciuto`);
          return;
        }
        if (seen.has(product.id)) {
          nextErrors.push(`Riga ${rowNum}: prodotto duplicato (${product.name})`);
          return;
        }

        const qtyVal = parseNumber(row[headerIndex.get(qtyKey) ?? -1]);
        if (qtyVal === null) {
          nextErrors.push(`Riga ${rowNum}: quantita non valida`);
          return;
        }

        const thresholdVal = thresholdKey ? parseNumber(row[headerIndex.get(thresholdKey) ?? -1]) : null;
        const maxQtyVal = maxQtyKey ? parseNumber(row[headerIndex.get(maxQtyKey) ?? -1]) : null;
        const consVal = consKey ? parseNumber(row[headerIndex.get(consKey) ?? -1]) : null;

        nextPreview.push({
          id: product.id,
          name: product.name,
          quantityNow: product.quantity,
          quantityNext: qtyVal,
          thresholdNow: product.threshold,
          thresholdNext: thresholdVal ?? product.threshold,
          maxQtyNow: product.maxQty,
          maxQtyNext: maxQtyVal ?? product.maxQty,
          consumptionNow: product.consumptionPerCheckout,
          consumptionNext: consVal ?? product.consumptionPerCheckout,
        });
        seen.add(product.id);
      });

      setCsvErrors(nextErrors);
      setCsvPreview(nextPreview);
    };
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  async function applyCsvImport() {
    if (csvPreview.length === 0) return;
    setCsvLoading(true);
    setError("");
    setSuccess("");
    const updates = csvPreview.map((row) => {
      const payload: Record<string, unknown> = {
        id: row.id,
        quantity: row.quantityNext,
      };
      if (csvColumns.threshold) payload.threshold = row.thresholdNext;
      if (csvColumns.maxQty) payload.max_qty = row.maxQtyNext;
      if (csvColumns.consumption) payload.consumption_per_checkout = row.consumptionNext ?? null;
      return payload;
    });

    const result = await clientFetchJson<{ ok?: boolean; updated?: number }>("/api/products/bulk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setCsvLoading(false);
    if (!result.ok) {
      const msg = result.error ?? "Errore import CSV";
      setError(msg);
      toast(msg, "error");
      return;
    }
    setSuccess("Import CSV completato");
    toast("Import CSV completato", "success");
    setCsvPreview([]);
    setCsvErrors([]);
    setCsvFileName("");
    await loadProducts();
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <Package className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Rifornimento</h1>
          <p className="mt-1 text-xs text-text-secondary">Consumabili a 3 stati, biancheria a quantità</p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <Card>
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setShowImport((v) => !v)}
        >
          <CardHeader
            title="Import CSV / Excel"
            subtitle={showImport ? "Aggiorna i valori del magazzino in blocco" : "Tap per espandere"}
          />
          <ChevronDown
            className={`mr-6 h-5 w-5 shrink-0 text-zinc-400 transition-transform ${showImport ? "rotate-180" : ""}`}
          />
        </button>

        {showImport && (
          <div className="space-y-4 px-6 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Scarica template CSV
              </button>
              <button
                type="button"
                onClick={downloadTemplateXlsx}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Scarica template Excel
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvFile(file);
                  }}
                />
                Carica CSV o Excel
              </label>
              {csvFileName && <span className="text-xs text-zinc-500">File: {csvFileName}</span>}
            </div>
            <p className="text-xs text-zinc-500">
              Carica un file CSV o Excel (.xlsx) per aggiornare i valori del magazzino in blocco.
            </p>

            {csvErrors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {csvErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">Anteprima aggiornamenti</p>
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>Prodotto</TableHeaderCell>
                        <TableHeaderCell>Qtà attuale</TableHeaderCell>
                        <TableHeaderCell>Qtà nuova</TableHeaderCell>
                        <TableHeaderCell>Soglia</TableHeaderCell>
                        <TableHeaderCell>Massimo</TableHeaderCell>
                        <TableHeaderCell>Consumo</TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {csvPreview.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-zinc-900">{row.name}</TableCell>
                          <TableCell>{row.quantityNow}</TableCell>
                          <TableCell className="text-zinc-900">{row.quantityNext}</TableCell>
                          <TableCell>{row.thresholdNext}</TableCell>
                          <TableCell>{row.maxQtyNext ?? "-"}</TableCell>
                          <TableCell>{row.consumptionNext ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void applyCsvImport()}
                    disabled={csvLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Applica import
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvPreview([]);
                      setCsvErrors([]);
                      setCsvFileName("");
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    Pulisci selezione
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {/* Tab bar */}
        <div className="grid grid-cols-2 gap-1 rounded-[13px] bg-[#f4ede6] p-1">
          <button
            className={`rounded-[10px] py-2 text-sm font-semibold transition-all ${
              activeTab === "biancheria"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setActiveTab("biancheria")}
          >
            Biancheria{" "}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === "biancheria" ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-500"}`}>
              {visibleQuantityProducts.length}
            </span>
          </button>
          <button
            className={`rounded-[10px] py-2 text-sm font-semibold transition-all ${
              activeTab === "consumabili"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setActiveTab("consumabili")}
          >
            Consumabili{" "}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === "consumabili" ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-500"}`}>
              {visibleStatusProducts.length}
            </span>
          </button>
        </div>

        {activeTab === "consumabili" && (
        <Card>
        <CardHeader title="Consumabili a Stati" subtitle={`${visibleStatusProducts.length} prodotti monitorati a 3 stati`} />

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
        ) : visibleStatusProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">OK</span>
            <p className="text-sm font-medium text-zinc-700">Nessun consumabile da monitorare</p>
            <p className="text-xs text-zinc-400">I consumabili usano PIENO, A_META e TERMINATO.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {visibleStatusProducts.map((product) => {
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
                      {stateBadge(state)}
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
                  {visibleStatusProducts.map((product) => {
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
                        <TableCell>{stateBadge(state)}</TableCell>
                        <TableCell>{statusSelector(product)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        </Card>
        )}

        {activeTab === "biancheria" && (
        <Card>
        <CardHeader title="Biancheria a Quantità" subtitle={`${visibleQuantityProducts.length} prodotti gestiti a pezzi/set`} />

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
        ) : visibleQuantityProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-medium text-zinc-700">Nessuna biancheria da monitorare</p>
            <p className="text-xs text-zinc-400">Set letto, asciugamani e tessili restano gestiti a quantita.</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {visibleQuantityProducts.map((product) => {
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
                <TableHeaderCell>Qtà iniziale</TableHeaderCell>
                <TableHeaderCell>Qtà attuale</TableHeaderCell>
                <TableHeaderCell>Soglia</TableHeaderCell>
                <TableHeaderCell>Stato</TableHeaderCell>
                <TableHeaderCell>Rifornisci</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visibleQuantityProducts.map((product) => {
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
        )}
      </div>
    </section>
  );
}
