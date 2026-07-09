import dynamic from "next/dynamic";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { requireOrganizationState } from "@/lib/organizationContext";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";

const ProductCatalogEditor = dynamic(() => import("@/components/product-catalog-editor").then((mod) => mod.ProductCatalogEditor), {
  loading: () => <div className="rounded-2xl border border-dashed border-border-default bg-white/55 px-4 py-6 text-sm text-text-secondary">Caricamento catalogo prodotti...</div>,
});

export default async function SettingsPage() {
  const { organization } = await requireOrganizationState();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Impostazioni"
        subtitle="Dati della tua attività, catalogo prodotti e sezioni avanzate."
        icon={<Settings2 className="h-5 w-5 text-sidebar-bg" />}
        eyebrow="Configurazione"
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-border-subtle bg-white/60 px-4 py-4">
            <p className="label-base">Base</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">Dati attività</p>
            <p className="mt-1 text-sm text-text-secondary">Nome, valuta, fuso orario e referente operativo.</p>
          </div>
          <div className="rounded-[22px] border border-border-subtle bg-white/60 px-4 py-4">
            <p className="label-base">Automazioni</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">Catalogo prodotti</p>
            <p className="mt-1 text-sm text-text-secondary">Ruoli di biancheria e consumabili che alimentano i rifornimenti automatici.</p>
          </div>
          <div className="rounded-[22px] border border-border-subtle bg-white/60 px-4 py-4">
            <p className="label-base">Supporto</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">Sezioni avanzate</p>
            <p className="mt-1 text-sm text-text-secondary">Strumenti secondari accessibili senza appesantire la navigazione.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Attività"
          subtitle={`Dati base dell'organizzazione attiva: ${organization.name}`}
        />
        <WorkspaceSettingsForm organization={organization} mode="settings" />
      </Card>

      <Card>
        <CardHeader
          title="Prodotti & Biancheria"
          subtitle="Qui definisci il catalogo che alimenta consumi e rifornimenti automatici."
        />
        <div className="px-6 pb-6">
          <ProductCatalogEditor />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sezioni avanzate" subtitle="Strumenti che usi meno spesso, tenuti fuori dal menu principale per non appesantirlo" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/warehouse" className="surface-link">
            Magazzino completo
          </Link>
          <Link href="/onboarding" className="surface-link">
            Rivedi onboarding
          </Link>
        </div>
      </Card>
    </section>
  );
}
