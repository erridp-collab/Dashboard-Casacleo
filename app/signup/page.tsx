"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Building2, Eye, EyeOff, UserPlus } from "lucide-react";
import { signupAction } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Building2 className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Crea il tuo workspace
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Registrati come owner e inizializza la tua organizzazione.
          </p>
        </div>

        <form className="mt-8 space-y-4" action={formAction}>
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

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 pr-11 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="Almeno 8 caratteri"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
            <UserPlus className="mr-2 h-4 w-4" />
            {isPending ? "Creazione..." : "Crea account"}
          </button>

          <p className="text-center text-sm text-zinc-600">
            Hai gia un account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
