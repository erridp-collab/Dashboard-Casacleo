"use client";

import { useActionState } from "react";
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
  "Europe/Rome",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/London",
];

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP"];

export function WorkspaceSettingsForm({ organization, mode }: WorkspaceSettingsFormProps) {
  const action = mode === "onboarding" ? completeOnboardingAction : updateWorkspaceSettingsAction;
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(action, null);
  const submitLabel = mode === "onboarding" ? "Completa onboarding" : "Salva impostazioni";

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-800">
            Nome workspace
          </label>
          <input
            id="name"
            name="name"
            defaultValue={organization.name}
            required
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            placeholder="Es. Alva Milano"
          />
        </div>

        <div>
          <label htmlFor="currency_code" className="mb-2 block text-sm font-medium text-zinc-800">
            Valuta
          </label>
          <select
            id="currency_code"
            name="currency_code"
            defaultValue={organization.currency_code}
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="timezone" className="mb-2 block text-sm font-medium text-zinc-800">
            Fuso orario
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={organization.timezone}
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          >
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="contact_name" className="mb-2 block text-sm font-medium text-zinc-800">
            Nome referente
          </label>
          <input
            id="contact_name"
            name="contact_name"
            defaultValue={typeof organization.settings.contact_name === "string" ? organization.settings.contact_name : ""}
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            placeholder="Facoltativo"
          />
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {mode === "onboarding"
            ? "Puoi modificare questi dati anche dopo, da Impostazioni."
            : "Le modifiche si applicano subito al workspace attivo."}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending ? "Salvataggio..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
