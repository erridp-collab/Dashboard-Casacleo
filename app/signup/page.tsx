"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PublicFormProtectionFields } from "@/components/public-form-protection-fields";
import { Building2, Send } from "lucide-react";
import { requestAccessAction } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(requestAccessAction, null);
  const [renderedAt] = useState(() => String(Date.now()));

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Building2 className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Richiedi accesso
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Invia la richiesta per il tuo workspace. L&apos;attivazione viene approvata manualmente dalla piattaforma.
          </p>
        </div>

        {state?.success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <p className="font-semibold text-emerald-900">Richiesta inviata</p>
            <p className="mt-2">
              Se i dati sono validi, la richiesta verra presa in carico dall&apos;amministrazione della piattaforma.
            </p>
            <p className="mt-2">
              Quando l&apos;account verra approvato, riceverai le istruzioni per attivare l&apos;accesso.
            </p>
          </div>
        ) : (
          <form className="relative mt-8 space-y-4" action={formAction}>
            <PublicFormProtectionFields renderedAt={renderedAt} />
            <div className="space-y-1">
              <label htmlFor="organization_name" className="block text-sm font-medium text-zinc-700">
                Nome organizzazione
              </label>
              <input
                id="organization_name"
                name="organization_name"
                type="text"
                required
                minLength={3}
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="es. Casa al mare"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700">
                Nome completo <span className="text-zinc-400">(opzionale)</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="Mario Rossi"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="tu@esempio.com"
              />
            </div>

            {state?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="group relative flex w-full justify-center rounded-xl border border-transparent bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Invio..." : "Invia richiesta"}
            </button>

            <p className="text-center text-sm text-zinc-600">
              Hai gia un account?{" "}
              <Link href="/login" className="font-medium text-primary hover:opacity-80">
                Accedi
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
