"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/card";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log dell'errore (può essere inviato a un servizio ext come Sentry)
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-semantic-error/10">
          <AlertCircle className="h-6 w-6 text-semantic-error" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-text-primary">Qualcosa è andato storto!</h2>
        <p className="mb-6 text-sm text-text-secondary">
          Si è verificato un errore inaspettato durante il caricamento della pagina.
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary w-full"
        >
          Riprova
        </button>
      </Card>
    </div>
  );
}
