"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Larghezza del pannello da desktop (sm+). Default in linea con il piano UI/UX (480-560px). */
  widthClassName?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Pannello laterale su desktop, sheet quasi full-screen su mobile.
 * IMPLEMENTATION_PLAN_UI_UX.md, sezioni 6/8/11: role="dialog", aria-modal,
 * focus spostato al pannello, focus trap, Escape chiude, focus restituito
 * al trigger alla chiusura.
 */
export function Drawer({ open, onClose, title, children, widthClassName = "sm:max-w-[480px]" }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    // Deferred: mounting and flipping to "visible" must happen after the
    // initial (off-screen) paint for the CSS transition to play.
    const t = setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (open) return;
    document.body.style.overflow = "";
    if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    const hideTimer = setTimeout(() => setVisible(false), 0);
    const unmountTimer = setTimeout(() => setMounted(false), 200);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-y-auto rounded-t-2xl border-t border-border-strong/12 bg-surface-raised p-5 shadow-[0_-16px_40px_rgba(74,14,36,0.18)] outline-none transition-transform duration-200 sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-0 sm:max-h-none sm:w-full sm:rounded-t-none sm:rounded-l-2xl sm:border-l sm:border-t-0 sm:shadow-[-16px_0_40px_rgba(74,14,36,0.18)] ${widthClassName} ${
          visible ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
