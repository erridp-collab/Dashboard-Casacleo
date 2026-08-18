"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Già installata come standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) return;

    // Desktop Chrome/Edge also fire beforeinstallprompt for installable PWAs,
    // but this banner is meant for phones only — skip it outside Android/iOS.
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (!isAndroid && !isIos) return;

    let iosHintFrame = 0;
    if (isIos) {
      iosHintFrame = window.requestAnimationFrame(() => setShowIosHint(true));
    }

    if (!isAndroid) return;

    // Android/Chrome: cattura l'evento prima che sparisca
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      if (iosHintFrame) window.cancelAnimationFrame(iosHintFrame);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setDeferredPrompt(null);
    setShowIosHint(false);
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setDeferredPrompt(null);
  };

  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-border-strong/15 bg-surface-raised p-4 shadow-[0_12px_28px_rgba(74,14,36,0.18)]">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📲</span>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-text-primary">Installa l&apos;app</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-text-secondary">
              Aggiungi Alva Host alla schermata Home per un accesso rapido.
            </p>
          ) : (
            <p className="mt-0.5 text-text-secondary">
              Tocca <strong>condividi</strong>{" "}
              <ShareIcon />{" "}
              poi <strong>«Aggiungi alla schermata Home»</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Chiudi suggerimento installazione"
          className="shrink-0 rounded-lg p-1 text-text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      {deferredPrompt && (
        <button
          type="button"
          className="btn-primary mt-3 w-full"
          onClick={installAndroid}
        >
          Installa
        </button>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l-3 3h2v8h2V5h2l-3-3zm-7 9v8h14v-8h-2v6H7v-6H5z" />
    </svg>
  );
}
