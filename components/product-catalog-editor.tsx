// components/product-catalog-editor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { toast } from "@/components/toast";
import { useModalA11y } from "@/lib/useModalA11y";
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
  const closeModal = () => setModal({ mode: "closed" });
  const modalPanelRef = useModalA11y(modal.mode !== "closed", closeModal);

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
    const timeoutId = window.setTimeout(() => {
      void loadProducts(ctrl.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, []);

  // Lo scroll del body durante il modal e' gia' gestito da useModalA11y
  // (modalPanelRef sopra), insieme a focus trap/Escape/focus di ritorno.

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
            max_qty: data.quantity,
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
    if (data.id) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.id
            ? { ...p, name: data.name, linen_role: data.linen_role, unit: data.unit, threshold: data.threshold, max_qty: data.quantity }
            : p,
        ),
      );
    } else {
      void loadProducts();
    }
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
    if (data.id) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.id ? { ...p, name: data.name, category: data.category, unit: data.unit } : p,
        ),
      );
    } else {
      void loadProducts();
    }
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
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        <button
          type="button"
          className={`rounded-lg py-2 text-sm font-semibold transition-colors duration-150 ${
            activeTab === "biancheria"
              ? "bg-surface-raised text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("biancheria")}
        >
          Biancheria{" "}
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === "biancheria" ? "bg-brand-primary/10 text-brand-primary" : "bg-surface-raised text-text-secondary"
            }`}
          >
            {linenProducts.length}
          </span>
        </button>
        <button
          type="button"
          className={`rounded-lg py-2 text-sm font-semibold transition-colors duration-150 ${
            activeTab === "consumabili"
              ? "bg-surface-raised text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("consumabili")}
        >
          Consumabili{" "}
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === "consumabili" ? "bg-brand-primary/10 text-brand-primary" : "bg-surface-raised text-text-secondary"
            }`}
          >
            {consumableProducts.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="divide-y divide-border-strong/10 rounded-xl border border-border-strong/12">
            {(activeTab === "biancheria" ? linenProducts : consumableProducts).map((product) => {
              const roleLabel =
                activeTab === "biancheria" && product.linen_role
                  ? LINEN_ROLES.find((r) => r.value === product.linen_role)?.label ?? product.linen_role
                  : null;
              const roleMatchesName = roleLabel != null && roleLabel.trim().toLowerCase() === product.name.trim().toLowerCase();
              const secondaryText =
                activeTab === "biancheria"
                  ? roleLabel == null
                    ? "Nessun ruolo"
                    : roleMatchesName
                      ? null
                      : roleLabel
                  : `${product.category ?? "—"} · ${product.unit ?? "pz"}`;

              return (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{product.name}</p>
                    {secondaryText ? <p className="text-xs text-text-secondary">{secondaryText}</p> : null}
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
                      className="rounded-lg p-2 text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary"
                      aria-label="Modifica"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ mode: "delete", product })}
                      className="rounded-lg p-2 text-text-secondary transition-colors duration-150 hover:bg-semantic-error/10 hover:text-semantic-error"
                      aria-label="Elimina"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setModal(activeTab === "biancheria" ? { mode: "add-linen" } : { mode: "add-consumable" })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong/25 py-3 text-sm font-medium text-text-secondary transition-colors duration-150 hover:border-border-strong/40 hover:bg-surface-muted"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {activeTab === "biancheria" ? "Aggiungi biancheria" : "Aggiungi consumabile"}
          </button>
        </div>
      )}

      {/* Modal overlay — portaled to <body> so it always covers the real
          viewport, regardless of ancestors (e.g. Card's backdrop-blur,
          which otherwise turns "fixed" into a containing-block-relative
          position and clips/mispositions the modal). Closing happens only
          via the explicit X/Annulla buttons: a tap-to-close backdrop
          handler was tried before but on touch devices the delayed
          synthetic click that follows touchend can land on the backdrop
          that just appeared under the finger, closing the modal instantly. */}
      {modal.mode !== "closed" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
          <div
            ref={modalPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.mode === "add-linen"
                ? "Aggiungi biancheria"
                : modal.mode === "add-consumable"
                  ? "Aggiungi consumabile"
                  : modal.mode === "edit-linen"
                    ? "Modifica biancheria"
                    : modal.mode === "edit-consumable"
                      ? "Modifica consumabile"
                      : "Elimina prodotto"
            }
            tabIndex={-1}
            className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface-raised p-6 shadow-[0_20px_50px_rgba(74,14,36,0.22)] outline-none sm:rounded-2xl"
            style={{ maxHeight: "90dvh", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            {/* Drag handle — visible only on mobile bottom sheet */}
            <div className="mb-4 flex justify-center sm:hidden">
              <div className="h-1 w-10 rounded-full bg-border-strong/30" />
            </div>

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-text-primary">
                {modal.mode === "add-linen" && "Aggiungi biancheria"}
                {modal.mode === "add-consumable" && "Aggiungi consumabile"}
                {modal.mode === "edit-linen" && "Modifica biancheria"}
                {modal.mode === "edit-consumable" && "Modifica consumabile"}
                {modal.mode === "delete" && "Elimina prodotto"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Chiudi"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>

            {(modal.mode === "add-linen" || modal.mode === "edit-linen") && (
              <LinenForm
                product={modal.mode === "edit-linen" ? modal.product : undefined}
                assignedRoles={assignedRoles}
                saving={saving}
                onSave={handleSaveLinenProduct}
                onCancel={closeModal}
              />
            )}

            {(modal.mode === "add-consumable" || modal.mode === "edit-consumable") && (
              <ConsumableForm
                product={modal.mode === "edit-consumable" ? modal.product : undefined}
                saving={saving}
                onSave={handleSaveConsumable}
                onCancel={closeModal}
              />
            )}

            {modal.mode === "delete" && (
              <DeleteConfirm
                product={modal.product}
                saving={saving}
                onConfirm={() => void handleDelete(modal.product)}
                onCancel={closeModal}
              />
            )}
          </div>
        </div>,
        document.body,
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
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Asciugamani Grandi"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Collegato a</label>
        <select
          className="input-base w-full"
          value={linenRole ?? ""}
          onChange={(e) => setLinenRole((e.target.value as LinenRole) || null)}
        >
          <option value="">— nessun collegamento (solo tracciato) —</option>
          {LINEN_ROLES.map((role) => {
            const alreadyAssigned = assignedRoles.has(role.value) && product?.linen_role !== role.value;
            return (
              <option key={role.value} value={role.value} disabled={alreadyAssigned}>
                {role.label}{alreadyAssigned ? " (già assegnato)" : ""}
              </option>
            );
          })}
        </select>
        <p className="mt-1 text-xs text-semantic-info">{formulaLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            {product ? "Qtà totale" : "Qtà iniziale"}
          </label>
          <input
            className="input-base w-full"
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Unità</label>
          <input
            className="input-base w-full"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pz"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Soglia minima</label>
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
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
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
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome prodotto</label>
        <input
          className="input-base w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Detersivo Pavimenti"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Categoria</label>
        <input
          className="input-base w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Es. Pulizia, Cucina, Bagno..."
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Unità di misura</label>
        <input
          className="input-base w-full"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Es. pz, ml, gr, rotoli..."
        />
      </div>
      <p className="rounded-xl border border-semantic-info/20 bg-semantic-info/10 px-3 py-2 text-xs text-semantic-info">
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
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
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
      <p className="text-sm text-text-secondary">
        Vuoi eliminare <span className="font-semibold text-text-primary">{product.name}</span>? L&apos;operazione non è reversibile.
      </p>
      {product.linen_role && (
        <p className="rounded-xl border border-semantic-warning/30 bg-semantic-warning/10 px-3 py-2 text-xs text-text-primary">
          Questo prodotto è collegato al rifornimento automatico di {LINEN_ROLES.find((r) => r.value === product.linen_role)?.label}.
          Eliminandolo, questo tipo di biancheria non verrà più scalato automaticamente dalle prenotazioni future.
        </p>
      )}
      <div className="flex gap-3">
        <button type="button" disabled={saving} onClick={onConfirm} className="btn-danger flex-1">
          {saving ? "Eliminazione..." : "Elimina"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Annulla
        </button>
      </div>
    </div>
  );
}
