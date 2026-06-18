// components/product-catalog-editor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { toast } from "@/components/toast";
import { LINEN_ROLES, LINEN_ROLE_VALUES, type LinenRole } from "@/lib/linen-roles";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  threshold: number;
  max_qty: number | null;
  linen_role: LinenRole | null;
  stock_status: string | null;
};

type ProductsResponse = {
  products?: Array<Record<string, unknown>>;
};

type ModalState =
  | { mode: "closed" }
  | { mode: "add-linen" }
  | { mode: "add-consumable" }
  | { mode: "edit-linen"; product: ProductRow }
  | { mode: "edit-consumable"; product: ProductRow }
  | { mode: "delete"; product: ProductRow };

function isLinenProduct(p: ProductRow): boolean {
  return p.linen_role !== null || (p.max_qty !== null && p.max_qty > 0 && p.stock_status === null);
}

function normalizeProduct(raw: Record<string, unknown>): ProductRow {
  const qty = Number(raw.quantity ?? 0);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Prodotto"),
    category: raw.category == null ? null : String(raw.category),
    unit: raw.unit == null ? null : String(raw.unit),
    quantity: Number.isFinite(qty) ? qty : 0,
    threshold: Number(raw.threshold ?? 0) || 0,
    max_qty: raw.max_qty == null ? null : Number(raw.max_qty),
    linen_role: (raw.linen_role != null && LINEN_ROLE_VALUES.has(String(raw.linen_role)))
      ? (raw.linen_role as LinenRole)
      : null,
    stock_status: raw.stock_status == null ? null : String(raw.stock_status),
  };
}

export function ProductCatalogEditor() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"biancheria" | "consumabili">("biancheria");
  const abortRef = useRef<AbortController | null>(null);

  async function loadProducts(signal?: AbortSignal) {
    setLoading(true);
    const result = await clientFetchJson<ProductsResponse>("/api/products", { signal });
    if (!result.ok) {
      if (!result.aborted) toast(result.error ?? "Errore caricamento prodotti", "error");
      setLoading(false);
      return;
    }
    const rows = (result.data.products ?? []).map((p) => normalizeProduct(p as Record<string, unknown>));
    setProducts(rows);
    setLoading(false);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void loadProducts(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const linenProducts = products.filter(isLinenProduct);
  const consumableProducts = products.filter((p) => !isLinenProduct(p));
  const assignedRoles = new Set(products.map((p) => p.linen_role).filter(Boolean));

  async function handleSaveLinenProduct(data: {
    id?: string;
    name: string;
    linen_role: LinenRole | null;
    quantity: number;
    unit: string;
    threshold: number;
  }) {
    setSaving(true);
    const result = data.id
      ? await clientFetchJson<{ ok: boolean }>(`/api/products/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            linen_role: data.linen_role,
            unit: data.unit,
            threshold: data.threshold,
          }),
        })
      : await clientFetchJson<{ product: unknown }>("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            linen_role: data.linen_role,
            quantity: data.quantity,
            unit: data.unit,
            threshold: data.threshold,
          }),
        });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore salvataggio", "error");
      return;
    }
    toast(data.id ? "Prodotto aggiornato" : "Prodotto aggiunto", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  async function handleSaveConsumable(data: {
    id?: string;
    name: string;
    category: string;
    unit: string;
  }) {
    setSaving(true);
    const result = data.id
      ? await clientFetchJson<{ ok: boolean }>(`/api/products/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name, category: data.category, unit: data.unit }),
        })
      : await clientFetchJson<{ product: unknown }>("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name, category: data.category, unit: data.unit }),
        });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore salvataggio", "error");
      return;
    }
    toast(data.id ? "Prodotto aggiornato" : "Prodotto aggiunto", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  async function handleDelete(product: ProductRow) {
    setSaving(true);
    const result = await clientFetchJson<{ ok: boolean }>(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Errore eliminazione", "error");
      return;
    }
    toast("Prodotto eliminato", "success");
    setModal({ mode: "closed" });
    void loadProducts();
  }

  return (
    <div className="space-y-4">
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
            {linenProducts.length}
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
            {consumableProducts.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(activeTab === "biancheria" ? linenProducts : consumableProducts).map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{product.name}</p>
                <p className="text-xs text-zinc-500">
                  {activeTab === "biancheria"
                    ? product.linen_role
                      ? LINEN_ROLES.find((r) => r.value === product.linen_role)?.label ?? product.linen_role
                      : "Nessun ruolo"
                    : `${product.category ?? "—"} · ${product.unit ?? "pz"}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setModal(
                      activeTab === "biancheria"
                        ? { mode: "edit-linen", product }
                        : { mode: "edit-consumable", product },
                    )
                  }
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                  aria-label="Modifica"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "delete", product })}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Elimina"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setModal(activeTab === "biancheria" ? { mode: "add-linen" } : { mode: "add-consumable" })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            {activeTab === "biancheria" ? "Aggiungi biancheria" : "Aggiungi consumabile"}
          </button>
        </div>
      )}

      {/* Modal overlay */}
      {modal.mode !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setModal({ mode: "closed" }); }}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.mode === "add-linen" && "Aggiungi biancheria"}
                {modal.mode === "add-consumable" && "Aggiungi consumabile"}
                {modal.mode === "edit-linen" && "Modifica biancheria"}
                {modal.mode === "edit-consumable" && "Modifica consumabile"}
                {modal.mode === "delete" && "Elimina prodotto"}
              </h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "closed" })}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(modal.mode === "add-linen" || modal.mode === "edit-linen") && (
              <LinenForm
                product={modal.mode === "edit-linen" ? modal.product : undefined}
                assignedRoles={assignedRoles}
                saving={saving}
                onSave={handleSaveLinenProduct}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}

            {(modal.mode === "add-consumable" || modal.mode === "edit-consumable") && (
              <ConsumableForm
                product={modal.mode === "edit-consumable" ? modal.product : undefined}
                saving={saving}
                onSave={handleSaveConsumable}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}

            {modal.mode === "delete" && (
              <DeleteConfirm
                product={modal.product}
                saving={saving}
                onConfirm={() => void handleDelete(modal.product)}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function LinenForm({
  product,
  assignedRoles,
  saving,
  onSave,
  onCancel,
}: {
  product?: ProductRow;
  assignedRoles: Set<string | null>;
  saving: boolean;
  onSave: (data: { id?: string; name: string; linen_role: LinenRole | null; quantity: number; unit: string; threshold: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [linenRole, setLinenRole] = useState<LinenRole | null>(product?.linen_role ?? null);
  const [quantity, setQuantity] = useState(String(product?.max_qty ?? product?.quantity ?? ""));
  const [unit, setUnit] = useState(product?.unit ?? "pz");
  const [threshold, setThreshold] = useState(String(product?.threshold ?? ""));

  const formulaLabel = linenRole
    ? LINEN_ROLES.find((r) => r.value === linenRole)?.formulaLabel
    : "Tracciato a quantità, nessun consumo automatico";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: product?.id,
      name: name.trim(),
      linen_role: linenRole,
      quantity: Math.max(0, Number(quantity) || 0),
      unit: unit.trim() || "pz",
      threshold: Math.max(0, Number(threshold) || 0),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Asciugamani Grandi"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Ruolo automazione</label>
        <select
          className="input-base w-full"
          value={linenRole ?? ""}
          onChange={(e) => setLinenRole((e.target.value as LinenRole) || null)}
        >
          <option value="">— nessun ruolo (solo tracciato) —</option>
          {LINEN_ROLES.map((role) => {
            const alreadyAssigned = assignedRoles.has(role.value) && product?.linen_role !== role.value;
            return (
              <option key={role.value} value={role.value} disabled={alreadyAssigned}>
                {role.label}{alreadyAssigned ? " (già assegnato)" : ""}
              </option>
            );
          })}
        </select>
        <p className="mt-1 text-xs text-blue-600">{formulaLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!product && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Qtà iniziale</label>
            <input
              className="input-base w-full"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Unità</label>
          <input
            className="input-base w-full"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pz"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Soglia minima</label>
          <input
            className="input-base w-full"
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </form>
  );
}

function ConsumableForm({
  product,
  saving,
  onSave,
  onCancel,
}: {
  product?: ProductRow;
  saving: boolean;
  onSave: (data: { id?: string; name: string; category: string; unit: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "pz");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: product?.id, name: name.trim(), category: category.trim() || "Generale", unit: unit.trim() || "pz" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Detersivo Pavimenti"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Categoria</label>
        <input
          className="input-base w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Es. Pulizia, Cucina, Bagno..."
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">Unità di misura</label>
        <input
          className="input-base w-full"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Es. pz, ml, gr, rotoli..."
        />
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Tracciato a 3 stati: Pieno / A metà / Finito
      </p>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  product,
  saving,
  onConfirm,
  onCancel,
}: {
  product: ProductRow;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-700">
        Vuoi eliminare <span className="font-semibold">{product.name}</span>?
      </p>
      {product.linen_role && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ Questo prodotto ha un ruolo biancheria ({LINEN_ROLES.find((r) => r.value === product.linen_role)?.label}). Eliminandolo l&apos;automazione non consumerà più questo tipo di biancheria nelle prenotazioni future.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Eliminazione..." : "Elimina"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Annulla
        </button>
      </div>
    </div>
  );
}
