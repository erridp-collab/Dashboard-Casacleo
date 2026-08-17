"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Euro, Home, LayoutDashboard, Warehouse } from "lucide-react";
import { markNavClick } from "@/lib/perf/navMarks";

const NAV_ITEMS = [
  { href: "/", label: "Riepilogo", icon: LayoutDashboard, key: "dashboard" },
  { href: "/actions", label: "Azioni", icon: ClipboardList, key: "actions" },
  { href: "/bookings", label: "Prenotazioni", icon: Home, key: "bookings" },
  { href: "/inventory", label: "Rifornimento", icon: Warehouse, key: "inventory" },
  { href: "/finance", label: "Spese", icon: Euro, key: "finance" },
];

export function BottomNav() {
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
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-brand-dark md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        willChange: "transform",
        transform: "translateZ(0)",
      }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => markNavClick(item.key)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors duration-150 ${
                active ? "text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-brand-secondary" aria-hidden="true" />}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={active ? 2.5 : 1.75} />
              <span
                className={`w-full truncate text-center text-[11px] leading-tight ${active ? "font-bold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
