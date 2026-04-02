import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
        <MapPinOff className="h-10 w-10 text-zinc-400" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-zinc-900">Pagina non trovata</h2>
      <p className="mb-8 max-w-sm text-zinc-500">
        Il percorso che stai cercando non esiste o è stato spostato.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
