import dynamic from "next/dynamic";
import { Card, CardHeader } from "@/components/card";
import { isOnboardingComplete, requireOrganizationState } from "@/lib/organizationContext";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";

const ProductCatalogEditor = dynamic(() => import("@/components/product-catalog-editor").then((mod) => mod.ProductCatalogEditor), {
  loading: () => <div className="rounded-2xl border border-dashed border-border-default bg-white/55 px-4 py-6 text-sm text-text-secondary">Caricamento catalogo prodotti...</div>,
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

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-border-subtle bg-white/60 px-4 py-4">
            <p className="label-base">Step 1</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">Configura il workspace</p>
            <p className="mt-1 text-sm text-text-secondary">Impostiamo i dati minimi che rendono coerenti date, valuta e riferimenti.</p>
          </div>
          <div className="rounded-[22px] border border-border-subtle bg-white/60 px-4 py-4">
            <p className="label-base">Step 2</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">Prepara il catalogo</p>
            <p className="mt-1 text-sm text-text-secondary">Aggiungi biancheria e consumabili essenziali per partire senza frizioni.</p>
          </div>
        </div>
      </Card>

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
        <div className="px-6 pb-6">
          <ProductCatalogEditor />
        </div>
      </Card>
    </section>
  );
}
