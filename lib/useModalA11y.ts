"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento di accessibilita' condiviso per dialog/drawer/sheet
 * (IMPLEMENTATION_PLAN_UI_UX.md, sezioni 8/10/11): focus spostato al
 * pannello all'apertura, focus trap, Escape chiude, focus restituito al
 * trigger alla chiusura. Ritorna il ref da passare al pannello insieme a
 * role="dialog" aria-modal="true" tabIndex={-1}.
 */
export function useModalA11y(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Apertura/chiusura: cattura il trigger, blocca lo scroll del body, sposta
  // il focus sul pannello e lo restituisce al trigger alla chiusura. Dipende
  // SOLO da `open`: se dipendesse anche da `onClose` (di norma una arrow
  // inline, quindi un riferimento nuovo ad ogni render del chiamante),
  // qualunque digitazione in un campo del modal ri-renderizzerebbe il
  // chiamante, rieseguirebbe questo effect e il suo cleanup
  // (`triggerRef.current.focus()`) più il `panelRef.focus()` differito
  // strapperebbero il focus dall'input dopo ogni tasto — su mobile questo
  // chiude la tastiera. Stesso fix già applicato a components/drawer.tsx.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = "";
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open]);

  // Handler Escape/Tab: qui `onClose` deve restare fresco, quindi l'effect
  // dipende anche da `onClose`. Ri-registra solo un listener su `document`,
  // senza toccare il focus, quindi la digitazione non viene disturbata.
  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  return panelRef;
}
