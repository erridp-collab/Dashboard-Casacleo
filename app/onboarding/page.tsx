import { Card, CardHeader } from "@/components/card";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { isOnboardingComplete, requireOrganizationState } from "@/lib/organizationContext";

export default async function OnboardingPage() {
  const { organization } = await requireOrganizationState();
  const completed = isOnboardingComplete(organization.settings);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Onboarding</p>
        <h1 className="text-3xl font-semibold text-zinc-900">
          {completed ? "Setup iniziale workspace" : "Configura il tuo workspace"}
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          {completed
            ? "Puoi riaprire questa schermata quando vuoi per rivedere i dati iniziali del workspace."
            : "Facciamo un setup minimo per partire con i primi clienti tester. Completa questi dati una sola volta e poi entri direttamente nella dashboard."}
        </p>
      </header>

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
    </section>
  );
}
