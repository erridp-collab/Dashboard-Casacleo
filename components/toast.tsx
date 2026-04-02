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
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {item.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
          )}
          <span>{item.message}</span>
          <button
            className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100"
            onClick={() => emit(toasts.filter((t) => t.id !== item.id))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
