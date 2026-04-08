"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/bookings", label: "Bookings", icon: "🏠" },
  { href: "/actions", label: "Actions", icon: "✅" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/finance", label: "Finance", icon: "💶" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-slate-200 bg-white px-3 py-2 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
      <div className="mb-4 hidden text-sm font-semibold uppercase tracking-wider text-slate-500 lg:block">
        Airbnb Manager
      </div>
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-sky-100 text-sky-900"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
