import dynamic from "next/dynamic";
import { Card, CardHeader } from "@/components/card";
import { isOnboardingComplete, requireOrganizationState } from "@/lib/organizationContext";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";

const ProductCatalogEditor = dynamic(() => import("@/components/product-catalog-editor").then((mod) => mod.ProductCatalogEditor), {
  loading: () => (
    <div className="rounded-xl border border-dashed border-border-strong/25 bg-surface-muted px-4 py-6 text-sm text-text-secondary">
      Caricamento catalogo prodotti...
    </div>
  ),
});

export default async function OnboardingPage() {
  const { organization } = await requireOrganizationState();
  const completed = isOnboardingComplete(organization.settings);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title={completed ? "Setup iniziale workspace" : "Configura il tuo workspace"}
        subtitle={
          completed
            ? "Puoi riaprire questa schermata quando vuoi per rivedere i dati iniziali del workspace."
            : "Facciamo un setup minimo per partire con i primi clienti tester. Completa questi dati una sola volta e poi entri direttamente nella dashboard."
        }
      />

      <Card className="p-6">
        <CardHeader
          title="Dati base organizzazione"
          subtitle={completed ? "Aggiorna i dati iniziali del workspace" : "Nome workspace, valuta e fuso orario operativo"}
        />
        <WorkspaceSettingsForm
          mode="onboarding"
          organization={organization}
        />
      </Card>

      <Card>
        <CardHeader
          title="Prodotti & Biancheria"
          subtitle="Configura il catalogo iniziale del tuo B&B. Potrai rifinirlo in qualsiasi momento da Impostazioni."
        />
        <ProductCatalogEditor />
      </Card>
    </section>
  );
}
