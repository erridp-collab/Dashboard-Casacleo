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

    // Android/Chrome: cattura l'evento prima che sparisca
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (isIos) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📲</span>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-foreground">Installa l&apos;app</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-muted-foreground">
              Aggiungi Alva Host alla schermata Home per un accesso rapido.
            </p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">
              Tocca <strong>condividi</strong>{" "}
              <ShareIcon />{" "}
              poi <strong>«Aggiungi alla schermata Home»</strong>
            </p>
          )}
        </div>
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      {deferredPrompt && (
        <button
          className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground"
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
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l-3 3h2v8h2V5h2l-3-3zm-7 9v8h14v-8h-2v6H7v-6H5z" />
    </svg>
  );
}
