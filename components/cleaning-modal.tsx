"use client";

import { useEffect, useState } from "react";
import { X, Wrench } from "lucide-react";

type StockStatus = "PIENO" | "A_META" | "TERMINATO";
type CleaningMode = null | "SELF" | "EXTERNAL";

type ProductCheck = {
  id: string;
  name: string;
  status: StockStatus;
};

type Props = {
  actionId: string | null;
  actionDate: string;
  onClose: () => void;
  onSaved: () => void;
};

const STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; text: string; dot: string }> = {
  PIENO:    { label: "Pieno",   bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  A_META:   { label: "A metà",  bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400"   },
  TERMINATO:{ label: "Finito",  bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"    },
};
const STATUS_CYCLE: StockStatus[] = ["PIENO", "A_META", "TERMINATO"];

export function CleaningModal({ actionId, actionDate, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<CleaningMode>(null);
  const [externalHours, setExternalHours] = useState("");
  const [products, setProducts] = useState<ProductCheck[]>([]);
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!actionId) return;
    setLoadingProducts(true);
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        const cleaning = (data.products ?? []).filter(
          (p: Record<string, unknown>) =>
            String(p.category ?? "").toLowerCase().includes("pulizia"),
        );
        setProducts(
          cleaning.map((p: Record<string, unknown>) => ({
            id: String(p.id ?? ""),
            name: String(p.name ?? ""),
            status: (p.stock_status as StockStatus) ?? "PIENO",
          })),
        );
      })
      .catch(() => setError("Errore caricamento prodotti"))
      .finally(() => setLoadingProducts(false));
  }, [actionId]);

  function cycleStatus(id: string) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const idx = STATUS_CYCLE.indexOf(p.status);
        return { ...p, status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
      }),
    );
  }

  async function handleSave() {
    if (!actionId) return;
    if (!mode) { setError("Seleziona il tipo di pulizia"); return; }

    if (mode === "EXTERNAL") {
      const hours = Number(externalHours.replace(",", ".").trim());
      if (!Number.isFinite(hours) || hours <= 0) {
        setError("Inserisci le ore di pulizia esterna");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      // 0. Segna l'azione come FATTO con il modo corretto
      const hours = mode === "EXTERNAL" ? Number(externalHours.replace(",", ".").trim()) : null;
      await fetch("/api/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: actionId,
          status: "FATTO",
          completion: mode === "EXTERNAL"
            ? { mode: "EXTERNAL", external_amount: hours }
            : { mode: "SELF" },
        }),
      });

      // 1. Salva stock_status prodotti
      const statusRes = await fetch("/api/products/stock-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: products.map((p) => ({ id: p.id, stock_status: p.status })),
        }),
      });
      if (!statusRes.ok) {
        const d = await statusRes.json();
        throw new Error(d.error ?? "Errore salvataggio scorte");
      }

      // 2. Se ci sono prodotti A METÀ o TERMINATI → crea azione SPESA nella settimana
      const needShopping = products.filter((p) => p.status === "A_META" || p.status === "TERMINATO");
      if (needShopping.length > 0) {
        const shoppingDate = nextShoppingDate(actionDate);
        const details = needShopping
          .map((p) => `${p.name} (${p.status === "TERMINATO" ? "FINITO" : "quasi finito"})`)
          .join(", ");
        await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: "SPESA",
            action_date: shoppingDate,
            details: `Da comprare: ${details}`,
            status: "DA_FARE",
          }),
        }).catch(() => null); // non bloccante
      }

      // 3. Se c'è nota manutenzione → crea azione MANUTENZIONE
      const note = maintenanceNote.trim();
      if (note) {
        await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: "MANUTENZIONE",
            action_date: actionDate,
            details: note,
            status: "DA_FARE",
          }),
        }).catch(() => null); // non bloccante
      }

      onSaved();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (!actionId) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-900/30 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-900">Check pulizie</h3>
          <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Step 1 — tipo pulizia */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Chi ha fatto le pulizie?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("SELF")}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition ${
                  mode === "SELF"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="text-2xl">🙋</span>
                Fatta da me
              </button>
              <button
                onClick={() => setMode("EXTERNAL")}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition ${
                  mode === "EXTERNAL"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="text-2xl">🧹</span>
                Esterna
              </button>
            </div>
            {mode === "EXTERNAL" && (
              <div className="mt-3">
                <label className="text-sm text-zinc-600">
                  Ore di pulizia esterna
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    placeholder="es. 2.5"
                    value={externalHours}
                    onChange={(e) => setExternalHours(e.target.value)}
                    className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  />
                </label>
                <p className="mt-1 text-xs text-zinc-400">Le ore verranno registrate come spesa</p>
              </div>
            )}
          </div>

          {/* Prodotti */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Scorte prodotti — tocca per cambiare stato
            </p>

            {loadingProducts ? (
              <div className="grid grid-cols-3 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {products.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  return (
                    <button
                      key={p.id}
                      onClick={() => cycleStatus(p.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition active:scale-95 ${cfg.bg} border-transparent`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                      <span className="text-[11px] font-medium leading-tight text-zinc-800">
                        {p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}
                      </span>
                      <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manutenzione straordinaria */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Wrench className="h-3.5 w-3.5" />
              Segnalazione manutenzione (opzionale)
            </label>
            <textarea
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 resize-none"
              rows={3}
              placeholder="Es: perdita sotto il lavandino, maniglia rotta, lampadina fulminata…"
              value={maintenanceNote}
              onChange={(e) => setMaintenanceNote(e.target.value)}
            />
            {maintenanceNote.trim() && (
              <p className="mt-1 text-xs text-amber-600">
                Verrà creata un'azione MANUTENZIONE con questa nota
              </p>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-5 py-4 flex flex-col gap-2">
          <button
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={saving || loadingProducts}
          >
            {saving ? "Salvataggio…" : "Salva check pulizie"}
          </button>
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50"
            onClick={() => { setMode(null); setExternalHours(""); setError(""); onClose(); }}
          >
            Chiudi senza salvare
          </button>
        </div>
      </div>
    </div>
  );
}

/** Restituisce il primo venerdì (o giovedì) della settimana corrente, mai prima di oggi */
function nextShoppingDate(fromDate: string): string {
  const base = new Date(fromDate);
  // Cerca il prossimo venerdì (5) o giovedì (4) nella stessa settimana
  for (let i = 0; i <= 6; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() === 5 || d.getDay() === 4) {
      return d.toISOString().slice(0, 10);
    }
  }
  // fallback: 3 giorni dopo
  const fallback = new Date(base);
  fallback.setDate(base.getDate() + 3);
  return fallback.toISOString().slice(0, 10);
}
