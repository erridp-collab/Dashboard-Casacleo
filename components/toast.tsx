"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;
type Listener = (toasts: ToastItem[]) => void;
let listeners: Listener[] = [];
let toasts: ToastItem[] = [];

function emit(newToasts: ToastItem[]) {
  toasts = newToasts;
  listeners.forEach((l) => l(toasts));
}

export function toast(message: string, type: ToastType = "success") {
  const id = ++toastId;
  emit([...toasts, { id, message, type }]);
  setTimeout(() => {
    emit(toasts.filter((t) => t.id !== id));
  }, 3500);
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setItems([...t]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 md:bottom-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium transition-all ${
            item.type === "success"
              ? "border-semantic-success/25 bg-surface-raised text-text-primary"
              : "border-semantic-error/25 bg-surface-raised text-text-primary"
          }`}
        >
          {item.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-semantic-success" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-semantic-error" aria-hidden="true" />
          )}
          <span>{item.message}</span>
          <button
            type="button"
            aria-label="Chiudi notifica"
            className="ml-1 rounded-lg p-1 opacity-60 transition-opacity duration-150 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={() => emit(toasts.filter((t) => t.id !== item.id))}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
