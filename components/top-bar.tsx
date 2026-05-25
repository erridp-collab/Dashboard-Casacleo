"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { BookOpen, ClipboardList, Euro, Home, Plus, Settings, Warehouse, LogOut } from "lucide-react";
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
    <header className="border-b border-white/10 bg-sidebar-bg shadow-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1 text-white hover:bg-white/10">
          <BookOpen className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold">Alva Host Manager</span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer on mobile so CTA stays on the right */}
        <div className="flex-1 md:hidden" />

        <Link
          href="/bookings"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-sidebar-bg shadow-sm transition hover:opacity-90 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova prenotazione</span>
        </Link>
        <form action={logoutFormAction} className="flex items-center gap-2">
          {logoutState?.error ? (
            <span className="hidden text-xs text-rose-300 md:inline">{logoutState.error}</span>
          ) : null}
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/20 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Esci</span>
          </button>
        </form>
      </div>
    </header>
  );
}
