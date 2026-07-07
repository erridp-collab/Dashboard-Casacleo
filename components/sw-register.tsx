"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });

    // Browsers only re-check sw.js for changes once every ~24h by default.
    // Force a check whenever the app regains focus so a new deploy is
    // picked up (and activated via skipWaiting/clients.claim) much sooner.
    function checkForUpdate() {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);

    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
