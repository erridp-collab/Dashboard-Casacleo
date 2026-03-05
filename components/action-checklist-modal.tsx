"use client";

import { useEffect, useState } from "react";
import type { ActionChecklistItem } from "@/types/db";
import { X } from "lucide-react";

type Props = {
  actionId: string | null;
  title: string;
  onClose: () => void;
};

export function ActionChecklistModal({ actionId, title, onClose }: Props) {
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
  }

  useEffect(() => {
    if (!actionId) return;
    const t = setTimeout(() => {
      void loadChecklist(actionId);
    }, 0);
    return () => clearTimeout(t);
  }, [actionId]);

  if (!actionId) return null;

  return (
    <div className="fixed inset-0 z-40 bg-zinc-900/30 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">Caricamento...</p>}
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-zinc-500">Nessuna checklist per questa azione.</p>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2">
              <input type="checkbox" checked={item.done} onChange={() => void toggleItem(item)} />
              <span className={item.done ? "text-zinc-500 line-through" : "text-zinc-800"}>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
