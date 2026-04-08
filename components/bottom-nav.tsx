"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Euro, Home, Settings, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { href: "/actions", label: "Azioni", icon: ClipboardList },
  { href: "/bookings", label: "Booking", icon: Home },
  { href: "/inventory", label: "Scorte", icon: Warehouse },
  { href: "/finance", label: "Spese", icon: Euro },
  { href: "/settings", label: "Config", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-zinc-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
              <span className={`text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
