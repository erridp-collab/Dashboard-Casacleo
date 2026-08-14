"use client";

import { useActionState } from "react";
import { InlineAlert } from "@/components/inline-alert";
import type { OrganizationRecord } from "@/lib/organizationContext";
import {
  completeOnboardingAction,
  updateWorkspaceSettingsAction,
  type OnboardingState,
} from "@/app/onboarding/actions";

type WorkspaceSettingsFormProps = {
  organization: OrganizationRecord;
  mode: "onboarding" | "settings";
};

const TIMEZONE_OPTIONS = [
  { value: "Europe/Rome", label: "Roma" },
  { value: "Europe/Paris", label: "Parigi" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/London", label: "Londra" },
];

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP"];

export function WorkspaceSettingsForm({ organization, mode }: WorkspaceSettingsFormProps) {
  const action = mode === "onboarding" ? completeOnboardingAction : updateWorkspaceSettingsAction;
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(action, null);
  const submitLabel = mode === "onboarding" ? "Completa onboarding" : "Salva impostazioni";
  const helperText =
    mode === "onboarding"
      ? "Partiamo dai dati minimi della tua attività: potrai completarli più avanti senza bloccare l'operatività."
      : "Questi dati definiscono il comportamento base della tua attività e si applicano subito.";

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-xl border border-border-strong/12 bg-surface-muted px-4 py-3 text-sm text-text-secondary">
        {helperText}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-2 block label-base">
            Nome attività
          </label>
          <input
            id="name"
            name="name"
            defaultValue={organization.name}
            required
            className="input-base"
            placeholder="Es. Alva Milano"
          />
          <p className="mt-2 text-xs text-text-tertiary">Nome visibile nelle schermate operative e nei riferimenti interni.</p>
        </div>

        <div>
          <label htmlFor="currency_code" className="mb-2 block label-base">
            Valuta
          </label>
          <select
            id="currency_code"
            name="currency_code"
            defaultValue={organization.currency_code}
            className="input-base"
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-2 block label-base">
            Fuso orario
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={organization.timezone}
            className="input-base"
          >
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone.value} value={timezone.value}>
                {timezone.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="contact_name" className="mb-2 block label-base">
            Nome referente
          </label>
          <input
            id="contact_name"
            name="contact_name"
            defaultValue={typeof organization.settings.contact_name === "string" ? organization.settings.contact_name : ""}
            className="input-base"
            placeholder="Facoltativo"
          />
          <p className="mt-2 text-xs text-text-tertiary">Utile per avere un riferimento operativo chiaro in onboarding e supporto.</p>
        </div>
      </div>

      {state?.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          {mode === "onboarding"
            ? "Puoi modificare questi dati anche dopo, da Impostazioni."
            : "Le modifiche si applicano subito alla tua attività."}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? "Salvataggio..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
