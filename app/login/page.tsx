"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PublicFormProtectionFields } from "@/components/public-form-protection-fields";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [renderedAt] = useState(() => String(Date.now()));

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <LockKeyhole className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Accedi
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Usa email e password del tuo workspace.
          </p>
        </div>
        
        <form className="relative mt-8 space-y-4" action={formAction}>
          <PublicFormProtectionFields renderedAt={renderedAt} />
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-primary hover:opacity-80">
                Password dimenticata?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 pr-11 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="La tua password"
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
            {isPending ? "Accesso..." : "Accedi"}
          </button>

          <p className="text-center text-sm text-zinc-600">
            Primo accesso?{" "}
            <Link href="/signup" className="font-medium text-primary hover:opacity-80">
              Richiedi accesso
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
