"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MoreHorizontal, Package, ShoppingCart } from "lucide-react";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { Drawer } from "@/components/drawer";
import { InlineAlert } from "@/components/inline-alert";
import { getRefillState, isMonitoredRefillProduct, isStatusManagedRefillProduct, type StockStatus } from "@/lib/refill";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/components/toast";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import type { ProductRow, RestockDraft } from "@/lib/inventory-types";
import { RefillConsumablesModal } from "@/components/refill-consumables-modal";
import { RefillLinenModal } from "@/components/refill-linen-modal";

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
  const restockInFlightRef = useRef<Set<string>>(new Set());
  const [savingStatusId, setSavingStatusId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvColumns, setCsvColumns] = useState({ threshold: false, maxQty: false, consumption: false });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [openModal, setOpenModal] = useState<"consumabili" | "biancheria" | null>(null);
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
        if (!result.aborted) setError(result.error ?? "Non è stato possibile caricare i prodotti");
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
      setError("Non è stato possibile caricare i prodotti");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function restockProduct(id: string) {
    // Synchronous guard against double-click/double-submit: React state
    // updates (setLoading) are async, so relying on `loading` alone still
    // lets a second click through before the re-render disables the button.
    if (restockInFlightRef.current.has(id)) return;

    const draft = drafts[id] ?? { addQty: "", amount: "" };
    const addQty = toNum(draft.addQty.replace(",", "."), NaN);
    const amount = draft.amount.trim() === "" ? null : toNum(draft.amount.replace(",", "."), NaN);

    if (!Number.isFinite(addQty) || addQty <= 0) {
      setError("Quantità rifornimento non valida");
      return;
    }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      setError("Importo rifornimento non valido");
      return;
    }

    restockInFlightRef.current.add(id);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await clientFetchJson<{ ok?: boolean; quantity?: number }>("/api/products/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          add_quantity: addQty,
          amount,
        }),
      });
      if (!result.ok) {
        const msg = result.error ?? "Non è stato possibile registrare il rifornimento";
        setError(msg);
        toast(msg, "error");
        return;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, quantity: result.data.quantity ?? p.quantity + addQty } : p,
        ),
      );
      setSuccess("Rifornimento registrato con successo");
      toast("Rifornimento registrato con successo", "success");
      setDrafts((prev) => ({ ...prev, [id]: { addQty: "", amount: "" } }));
    } finally {
      restockInFlightRef.current.delete(id);
      setLoading(false);
    }
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

  const statusManagedProducts = useMemo(() => {
    const monitored = products.filter((product) => isMonitoredRefillProduct(product));
    return monitored.filter((product) => isStatusManagedRefillProduct(product));
  }, [products]);

  const visibleStatusProducts = useMemo(() => {
    const alerting = statusManagedProducts.filter((product) => {
      const state = getRefillState(product);
      return state !== "OK";
    });
    return alerting.length > 0 ? alerting : statusManagedProducts;
  }, [statusManagedProducts]);

  const visibleQuantityProducts = useMemo(() => {
    const monitored = products.filter((product) => isMonitoredRefillProduct(product));
    const quantityManaged = monitored.filter((product) => !isStatusManagedRefillProduct(product));
    const alerting = quantityManaged.filter((product) => {
      const state = getRefillState(product);
      return state !== "OK";
    });
    return alerting.length > 0 ? alerting : quantityManaged;
  }, [products]);

  const monitoredProducts = useMemo(
    () => products.filter((product) => isMonitoredRefillProduct(product)),
    [products],
  );

  const consumableAttentionCount = useMemo(
    () => monitoredProducts.filter((product) => isStatusManagedRefillProduct(product) && getRefillState(product) !== "OK").length,
    [monitoredProducts],
  );

  const linenAttentionCount = useMemo(
    () => monitoredProducts.filter((product) => !isStatusManagedRefillProduct(product) && getRefillState(product) !== "OK").length,
    [monitoredProducts],
  );

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

  async function downloadTemplateXlsx() {
    const XLSX = await import("xlsx");
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

  async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: string[][] }> {
    const XLSX = await import("xlsx");
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
    reader.onload = async () => {
      const { headers, rows } = isExcel
        ? await parseXlsxBuffer(reader.result as ArrayBuffer)
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
          nextErrors.push(`Riga ${rowNum}: quantità non valida`);
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
      <PageHeader
        title="Rifornimento"
        subtitle={`${monitoredProducts.length} prodotti monitorati`}
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <KpiCard
          title="Prodotti Monitorati"
          value={String(monitoredProducts.length)}
          subtitle="Elementi attivi nel pannello scorte"
          status={monitoredProducts.length > 0 ? "ok" : "neutral"}
          icon={Package}
        />
        <KpiCard
          title="Consumabili In Evidenza"
          value={String(visibleStatusProducts.length)}
          subtitle={consumableAttentionCount > 0 ? `${consumableAttentionCount} richiedono attenzione` : "Nessuna criticità aperta"}
          status={consumableAttentionCount > 0 ? "warn" : "ok"}
          icon={AlertTriangle}
          onClick={() => setOpenModal("consumabili")}
        />
        <KpiCard
          title="Biancheria In Evidenza"
          value={String(visibleQuantityProducts.length)}
          subtitle={linenAttentionCount > 0 ? `${linenAttentionCount} da rivedere` : "Scorte a posto"}
          status={linenAttentionCount > 0 ? "warn" : "ok"}
          icon={ShoppingCart}
          onClick={() => setOpenModal("biancheria")}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-ghost btn-sm inline-flex items-center gap-1.5"
          onClick={() => setToolsOpen(true)}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          Strumenti
        </button>
      </div>

      <RefillConsumablesModal
        open={openModal === "consumabili"}
        products={statusManagedProducts}
        loadingProducts={loadingProducts}
        savingStatusId={savingStatusId}
        onUpdateStatus={updateProductStatus}
        onClose={() => setOpenModal(null)}
      />

      <RefillLinenModal
        open={openModal === "biancheria"}
        products={visibleQuantityProducts}
        loadingProducts={loadingProducts}
        drafts={drafts}
        setDrafts={setDrafts}
        restockPending={loading}
        onRestock={restockProduct}
        onClose={() => setOpenModal(null)}
      />

      <Drawer open={toolsOpen} onClose={() => setToolsOpen(false)} title="Strumenti" widthClassName="sm:max-w-[560px]">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Import CSV / Excel</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Aggiorna i valori del magazzino in blocco solo quando hai molte modifiche da applicare insieme.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm">
              Scarica template CSV
            </button>
            <button type="button" onClick={downloadTemplateXlsx} className="btn-secondary btn-sm">
              Scarica template Excel
            </button>
          </div>

          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-strong/30 bg-surface-muted px-4 py-3 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-raised">
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
          {csvFileName && <p className="text-xs text-text-secondary">File: {csvFileName}</p>}

          {csvErrors.length > 0 && (
            <div className="rounded-xl border border-semantic-warning/30 bg-semantic-warning/10 p-3 text-xs text-text-primary">
              {csvErrors.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          )}

          {csvPreview.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-primary">Anteprima aggiornamenti</p>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Prodotto</TableHeaderCell>
                    <TableHeaderCell>Attuale</TableHeaderCell>
                    <TableHeaderCell>Nuova</TableHeaderCell>
                    <TableHeaderCell>Soglia</TableHeaderCell>
                    <TableHeaderCell>Massimo</TableHeaderCell>
                    <TableHeaderCell>Consumo</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {csvPreview.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-text-primary">{row.name}</TableCell>
                      <TableCell>{row.quantityNow}</TableCell>
                      <TableCell className="text-text-primary">{row.quantityNext}</TableCell>
                      <TableCell>{row.thresholdNext}</TableCell>
                      <TableCell>{row.maxQtyNext ?? "-"}</TableCell>
                      <TableCell>{row.consumptionNext ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => void applyCsvImport()} disabled={csvLoading} className="btn-primary btn-sm">
                  Applica import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvPreview([]);
                    setCsvErrors([]);
                    setCsvFileName("");
                  }}
                  className="btn-ghost btn-sm"
                >
                  Pulisci selezione
                </button>
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </section>
  );
}

