import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { requireOrganizationState } from "@/lib/organizationContext";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";

const ProductCatalogEditor = dynamic(() => import("@/components/product-catalog-editor").then((mod) => mod.ProductCatalogEditor), {
  loading: () => (
    <div className="rounded-xl border border-dashed border-border-strong/25 bg-surface-muted px-4 py-6 text-sm text-text-secondary">
      Caricamento catalogo prodotti...
    </div>
  ),
});

export default async function SettingsPage() {
  const { organization } = await requireOrganizationState();

  return (
    <section className="space-y-6">
      <PageHeader title="Impostazioni" subtitle={organization.name} />

      <Card className="p-6">
        <CardHeader title="Attività" subtitle="Nome, valuta, fuso orario e referente operativo" />
        <WorkspaceSettingsForm organization={organization} mode="settings" />
      </Card>

      <Card>
        <CardHeader
          title="Prodotti & Biancheria"
          subtitle="Catalogo che alimenta consumi e rifornimenti automatici"
        />
        <ProductCatalogEditor />
      </Card>

      <Card>
        <CardHeader title="Sezioni avanzate" subtitle="Strumenti usati meno spesso, fuori dal menu principale" />
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
