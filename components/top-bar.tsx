"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { ClipboardList, Euro, Home, LogOut, Plus, Settings, Warehouse } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/actions", label: "Azioni", icon: ClipboardList },
  { href: "/bookings", label: "Prenotazioni", icon: Home },
  { href: "/inventory", label: "Rifornimento", icon: Warehouse },
  { href: "/finance", label: "Spese", icon: Euro },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  const [logoutState, logoutFormAction] = useActionState(logoutAction, null);
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/platform")
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-[rgba(84,21,34,0.9)] backdrop-blur-xl shadow-[0_10px_30px_rgba(48,18,26,0.2)]">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-2xl border border-white/10 px-2.5 py-1.5 text-white transition hover:bg-white/10">
          <Image src="/alva-logo.png" alt="" width={30} height={30} className="h-7 w-7 shrink-0 rounded-lg" priority />
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-[0.08em] text-white/92">ALVA HOST</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand/80">Operations Suite</div>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-sm transition ${
                  active
                    ? "border border-brand/35 bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/68 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-brand" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        <Link
          href="/bookings"
          className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/10 bg-brand px-3.5 py-2 text-sm font-semibold text-sidebar-bg shadow-[0_10px_24px_rgba(245,200,66,0.18)] transition hover:-translate-y-px hover:opacity-95 active:translate-y-0 active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova prenotazione</span>
        </Link>
        <form action={logoutFormAction} className="flex items-center gap-2">
          {logoutState?.error ? (
            <span className="hidden text-xs text-rose-200 md:inline">{logoutState.error}</span>
          ) : null}
          <button
            type="submit"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/16 active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Esci</span>
          </button>
        </form>
      </div>
    </header>
  );
}
