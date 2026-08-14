"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ClipboardList, Euro, Home, LogOut, Plus, Settings, User, Warehouse } from "lucide-react";
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
    <header className="sticky top-0 z-40 bg-brand-dark">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-white transition-colors duration-150 hover:bg-white/10"
        >
          <Image src="/alva-logo.png" alt="" width={30} height={30} className="h-7 w-7 shrink-0 rounded-lg" priority />
          <div className="hidden leading-none sm:block">
            <div className="text-[13px] font-semibold tracking-[0.08em] text-white/92">ALVA HOST</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/80">Gestione operativa</div>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2.5 text-sm transition-colors duration-150 ${
                  active ? "bg-white/12 text-white" : "text-white/68 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        <Link
          href="/bookings?new=1"
          className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-lg bg-brand-primary px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">Nuova prenotazione</span>
        </Link>

        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [logoutState, logoutFormAction] = useActionState(logoutAction, null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profilo"
        className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-white/15 text-white transition-colors duration-150 hover:bg-white/10"
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profilo"
          className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-xl border border-border-strong/12 bg-surface-raised p-1.5 shadow-[0_12px_28px_rgba(74,14,36,0.18)]"
        >
          {logoutState?.error ? <p className="px-3 py-1.5 text-xs text-semantic-error">{logoutState.error}</p> : null}
          <form action={logoutFormAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-muted"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Esci
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
