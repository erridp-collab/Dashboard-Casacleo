import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-muted">
        <MapPinOff className="h-10 w-10 text-text-muted" aria-hidden="true" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-text-primary">Pagina non trovata</h2>
      <p className="mb-8 max-w-sm text-text-secondary">
        Il percorso che stai cercando non esiste o è stato spostato.
      </p>
      <Link
        href="/"
        className="btn-primary"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
