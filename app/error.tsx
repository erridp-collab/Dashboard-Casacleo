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
      <Card className="w-full max-w-md p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
          <AlertCircle className="h-6 w-6 text-rose-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-zinc-900">Qualcosa è andato storto!</h2>
        <p className="mb-6 text-sm text-zinc-600">
          Si è verificato un errore inaspettato durante il caricamento della pagina.
        </p>
        <button
          onClick={() => reset()}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Riprova
        </button>
      </Card>
    </div>
  );
}
