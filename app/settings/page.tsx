import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { requireOrganizationState } from "@/lib/organizationContext";
import { ProductCatalogEditor } from "@/components/product-catalog-editor";

export default async function SettingsPage() {
  const { organization } = await requireOrganizationState();

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <Settings2 className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Impostazioni</h1>
          <p className="mt-1 text-xs text-text-secondary">Configurazioni operative del workspace</p>
        </div>
      </header>

      <Card className="p-6">
        <CardHeader
          title="Workspace"
          subtitle="Dati base dell'organizzazione attiva"
        />
        <WorkspaceSettingsForm organization={organization} mode="settings" />
      </Card>

      <Card>
        <CardHeader
          title="Prodotti & Biancheria"
          subtitle="Gestisci il catalogo prodotti: biancheria con ruoli automazione e consumabili"
        />
        <div className="px-6 pb-6">
          <ProductCatalogEditor />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sezioni avanzate" subtitle="Manteniamo disponibili i moduli tecnici senza appesantire la navigazione principale" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/warehouse" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Magazzino completo (Warehouse)
          </Link>
          <Link href="/onboarding" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Rivedi onboarding
          </Link>
        </div>
      </Card>
    </section>
  );
}
