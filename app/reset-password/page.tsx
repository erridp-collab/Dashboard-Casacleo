"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { InlineAlert } from "@/components/inline-alert";
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
    const id = window.setTimeout(() => router.replace("/login"), 1200);
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
      <AuthShell
        icon={<KeyRound className="h-5 w-5" />}
        title="Verifica del link"
        subtitle="Stiamo controllando il token di recupero prima di mostrarti il form."
      >
        <InlineAlert tone="info">Verifica del link in corso...</InlineAlert>
      </AuthShell>
    );
  }

  if (status === "invalid" || !tokens) {
    return (
      <AuthShell
        icon={<KeyRound className="h-5 w-5" />}
        title="Link non valido"
        subtitle="Il link di reset è mancante, scaduto oppure non è più utilizzabile."
        footer={
          <Link href="/forgot-password" className="font-semibold text-brand-primary transition-colors duration-150 hover:text-brand-hover">
            Richiedi un nuovo link
          </Link>
        }
      >
        <InlineAlert tone="warning" title="Serve un nuovo reset">
          Richiedi un nuovo link per continuare in sicurezza.
        </InlineAlert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={<KeyRound className="h-5 w-5" />}
      title="Nuova password"
      subtitle="Scegli una password sicura per il tuo account e confermala qui sotto."
      footer={
        <Link href="/login" className="font-semibold text-brand-primary transition-colors duration-150 hover:text-brand-hover">
          Torna al login
        </Link>
      }
    >
      {status === "success" ? (
        <InlineAlert tone="success" title="Password aggiornata">
          <p>Accesso in corso...</p>
        </InlineAlert>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="password" className="label-base">
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
                className="input-base pr-11"
                placeholder="Almeno 8 caratteri"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-text-primary"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm_password" className="label-base">
              Conferma password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              className="input-base"
              placeholder="Ripeti la password"
            />
          </div>

          {status === "error" || errorMessage ? <InlineAlert tone="error">{errorMessage}</InlineAlert> : null}

          <button type="submit" disabled={status === "pending"} className="btn-primary w-full">
            {status === "pending" ? "Aggiornamento..." : "Imposta nuova password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
