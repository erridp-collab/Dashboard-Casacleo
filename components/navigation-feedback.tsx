"use client";

import { useEffect, useState } from "react";
import { NAVIGATION_END_EVENT, NAVIGATION_START_EVENT } from "@/lib/perf/navMarks";

const SAFETY_TIMEOUT_MS = 15_000;

export function NavigationFeedback() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined;

    function stop() {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      safetyTimeout = undefined;
      setPending(false);
    }

    function start() {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      setPending(true);
      safetyTimeout = setTimeout(stop, SAFETY_TIMEOUT_MS);
    }

    window.addEventListener(NAVIGATION_START_EVENT, start);
    window.addEventListener(NAVIGATION_END_EVENT, stop);
    return () => {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      window.removeEventListener(NAVIGATION_END_EVENT, stop);
    };
  }, []);

  if (!pending) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-white/15"
        role="progressbar"
        aria-label="Caricamento pagina"
      >
        <div className="navigation-progress h-full bg-brand-secondary" />
      </div>
      <span className="sr-only" aria-live="polite">
        Caricamento in corso
      </span>
    </>
  );
}
