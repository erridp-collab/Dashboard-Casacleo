import Link from "next/link";
import { Card, CardHeader } from "@/components/card";

export default function SettingsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Impostazioni</h1>
        <p className="text-sm text-zinc-500">Configurazioni operative e sezioni avanzate</p>
      </header>

      <Card>
        <CardHeader title="Sezioni avanzate" subtitle="Manteniamo disponibili i moduli tecnici senza appesantire la navigazione principale" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/warehouse" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Magazzino completo (Warehouse)
          </Link>
          <Link href="/calendar" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Calendario
          </Link>
        </div>
      </Card>
    </section>
  );
}
