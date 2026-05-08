"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { supabaseBrowserClient } from "@/lib/supabaseBrowser";

type PageStatus = "checking" | "ready" | "invalid" | "pending" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token") ?? "";
    const refreshToken = params.get("refresh_token") ?? "";
    const type = params.get("type") ?? "";

    if (type === "recovery" && accessToken && refreshToken) {
      startTransition(() => {
        setTokens({ accessToken, refreshToken });
        setStatus("ready");
      });
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      startTransition(() => setStatus("invalid"));
    }
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const id = window.setTimeout(() => router.replace("/"), 1200);
    return () => window.clearTimeout(id);
  }, [router, status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tokens) return;

    const form = new FormData(e.currentTarget);
    const password = form.get("password")?.toString() ?? "";
    const confirmPassword = form.get("confirm_password")?.toString() ?? "";

    if (password.length < 8) {
      setErrorMessage("La password deve avere almeno 8 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Le password non coincidono");
      return;
    }

    setStatus("pending");
    setErrorMessage(null);

    try {
      const supabase = supabaseBrowserClient();

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (sessionError) {
        setStatus("error");
        setErrorMessage("Link di reset non valido o scaduto");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setStatus("error");
        setErrorMessage("Impossibile aggiornare la password. Riprova.");
        return;
      }

      await supabase.auth.signOut();
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Errore imprevisto. Riprova.");
    }
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Verifica del link in corso...</p>
      </div>
    );
  }

  if (status === "invalid" || !tokens) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <KeyRound className="h-6 w-6 text-zinc-900" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Link non valido</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Il link di reset è mancante, scaduto oppure non è più utilizzabile.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800"
          >
            Richiedi un nuovo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <KeyRound className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Nuova password
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Scegli una password sicura per il tuo account.
          </p>
        </div>

        {status === "success" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-700">
            <p className="font-medium">Password aggiornata</p>
            <p className="mt-1">Accesso in corso...</p>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Nuova password
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
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm_password" className="block text-sm font-medium text-zinc-700">
                Conferma password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="Ripeti la password"
              />
            </div>

            {(status === "error" || errorMessage) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "pending"}
              className="flex w-full justify-center rounded-xl border border-transparent bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
            >
              {status === "pending" ? "Aggiornamento..." : "Imposta nuova password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
