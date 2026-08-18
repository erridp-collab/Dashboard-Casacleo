"use client";

import { useEffect, useState } from "react";
import type { ActionChecklistItem } from "@/types/db";
import { Drawer } from "@/components/drawer";

type Props = {
  actionId: string | null;
  title: string;
  onClose: () => void;
  onActionStatusChange?: (actionId: string, nextStatus: "DA_FARE" | "FATTO") => void;
};

export function ActionChecklistModal({ actionId, title, onClose, onActionStatusChange }: Props) {
  const [items, setItems] = useState<ActionChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadChecklist(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/actions/${id}/checklist`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Errore caricamento checklist");
        return;
      }
      setItems(data.checklist ?? []);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(item: ActionChecklistItem) {
    const nextDone = !item.done;
    const res = await fetch("/api/actions/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, done: nextDone }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Errore update checklist");
      return;
    }

    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: nextDone } : x)));
    if (data?.action_id && (data?.next_status === "DA_FARE" || data?.next_status === "FATTO")) {
      onActionStatusChange?.(String(data.action_id), data.next_status);
    }
  }

  useEffect(() => {
    if (!actionId) return;
    const t = setTimeout(() => {
      void loadChecklist(actionId);
    }, 0);
    return () => clearTimeout(t);
  }, [actionId]);

  return (
    <Drawer open={Boolean(actionId)} onClose={onClose} title={title} widthClassName="sm:max-w-[480px]">
      {loading && <p className="text-sm text-text-secondary">Caricamento...</p>}
      {error && <p className="mb-3 text-sm text-semantic-error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-text-secondary">Nessuna checklist per questa azione.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-xl border border-border-strong/12 px-3 py-2">
            <input
              id={`checklist_item_${item.id}`}
              name={`checklist_item_${item.id}`}
              type="checkbox"
              checked={item.done}
              onChange={() => void toggleItem(item)}
              className="h-4 w-4 accent-brand-primary"
            />
            <span className={item.done ? "text-text-secondary line-through" : "text-text-primary"}>{item.label}</span>
          </label>
        ))}
      </div>
    </Drawer>
  );
}
