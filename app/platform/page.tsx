import Link from "next/link";
import { Card, CardHeader } from "@/components/card";

export default function PlatformPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-6">
        <CardHeader
          title="Stato console"
          subtitle="Base amministrativa pronta per gestire approvazione accessi e supporto account."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">Platform admin</p>
            <p className="mt-1 text-sm text-zinc-600">
              Guard dedicato separato dal contesto tenant e bypass onboarding su `/platform`.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">UI coerente</p>
            <p className="mt-1 text-sm text-zinc-600">
              Area interna pulita e leggibile, pronta per richieste accesso e gestione account.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Moduli attivi"
          subtitle="La console gestisce gia richieste accesso e supporto account."
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/platform/requests"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Apri richieste accesso
          </Link>
          <Link
            href="/platform/accounts"
            className="inline-flex rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Apri supporto account
          </Link>
        </div>
      </Card>
    </div>
  );
}
