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
          <div className="rounded-xl border border-border-strong/12 bg-surface-muted p-4">
            <p className="text-sm font-medium text-text-primary">Platform admin</p>
            <p className="mt-1 text-sm text-text-secondary">
              Guard dedicato separato dal contesto tenant e bypass onboarding su `/platform`.
            </p>
          </div>
          <div className="rounded-xl border border-border-strong/12 bg-surface-muted p-4">
            <p className="text-sm font-medium text-text-primary">UI coerente</p>
            <p className="mt-1 text-sm text-text-secondary">
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
            className="btn-primary"
          >
            Apri richieste accesso
          </Link>
          <Link
            href="/platform/accounts"
            className="btn-secondary"
          >
            Apri supporto account
          </Link>
        </div>
      </Card>
    </div>
  );
}
