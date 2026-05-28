# Frontend Audit — Premium UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare Alva Host Manager da tool operativo personale a prodotto premium distribuibile a terzi, ottimizzando estetica, coerenza visiva e leggibilità senza toccare logica o API.

**Architecture:** Layer-by-layer polish — foundations (CSS tokens + utilities) → components (Card, KpiCard) → navigation (TopBar, BottomNav, ActionBadges) → pages (header pattern, btn-*/input-base adoption, Recharts colors, dashboard order). Ogni task produce solo cambi di presentazione, zero logica o API.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (`@theme inline`), Lucide React, Recharts, TypeScript

---

### Task 1: Layer 1 — CSS foundations (globals.css)

**Files:**
- Modify: `app/globals.css`

Aggiunge 7 nuovi token semantici in `:root` e `@theme inline`, aggiorna `--background` per più contrasto carta/sfondo, aggiunge classi utility bottoni e form in `@layer components`.

- [ ] **Step 1: Aggiorna `:root` e `@theme inline`**

Sostituisci il blocco `:root { ... }` (righe 3-12) con:

```css
:root {
  --background: 38 35% 90%;
  --foreground: 35 53% 7%;
  --sidebar-bg: 338 68% 17%;
  --brand: 47 86% 69%;
  --brand-light: 47 86% 69%;
  --canvas: 338 68% 17%;
  --surface: 338 56% 27%;
  --primary: 339 55% 46%;
  --surface-1: 40 60% 99%;
  --surface-2: 38 35% 93%;
  --border-subtle: 32 30% 85%;
  --border-default: 32 25% 80%;
  --text-primary: 30 60% 8%;
  --text-secondary: 28 25% 45%;
  --text-tertiary: 28 20% 55%;
}
```

Sostituisci il blocco `@theme inline { ... }` (righe 25-35) con:

```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-sidebar-bg: hsl(var(--sidebar-bg));
  --color-brand: hsl(var(--brand));
  --color-canvas: hsl(var(--canvas));
  --color-surface: hsl(var(--surface));
  --color-primary: hsl(var(--primary));
  --color-surface-1: hsl(var(--surface-1));
  --color-surface-2: hsl(var(--surface-2));
  --color-border-subtle: hsl(var(--border-subtle));
  --color-border-default: hsl(var(--border-default));
  --color-text-primary: hsl(var(--text-primary));
  --color-text-secondary: hsl(var(--text-secondary));
  --color-text-tertiary: hsl(var(--text-tertiary));
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- [ ] **Step 2: Aggiungi classi utility dopo il blocco `body {}`**

Dopo il blocco `body { ... }` (riga 41), prima di `.calendar-shell`, inserisci:

```css
@layer components {
  .btn-primary {
    @apply inline-flex items-center gap-2 rounded-xl bg-sidebar-bg px-4 py-2.5 text-sm font-semibold text-brand shadow-sm transition hover:opacity-90 active:scale-95;
  }
  .btn-secondary {
    @apply inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-2 active:scale-95;
  }
  .btn-ghost {
    @apply inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary underline underline-offset-4 transition hover:text-text-primary;
  }
  .btn-danger {
    @apply inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95;
  }
  .btn-sm {
    @apply h-8 rounded-lg px-3 py-0 text-xs;
  }
  .input-base {
    @apply h-11 w-full rounded-xl border border-border-default bg-surface-1 px-3.5 text-sm text-text-primary transition placeholder:text-text-tertiary focus:border-sidebar-bg focus:outline-none focus:ring-2 focus:ring-sidebar-bg/10;
  }
  .label-base {
    @apply text-[10px] font-bold uppercase tracking-[.06em] text-text-secondary;
  }
}
```

- [ ] **Step 3: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore TypeScript o CSS. Se appaiono errori, correggili prima di procedere.

- [ ] **Step 4: Commit**

```powershell
git add app/globals.css
git commit -m "style: add semantic CSS tokens and utility classes (Layer 1)"
```

---

### Task 2: Layer 2a — Card warm surface (`card.tsx`)

**Files:**
- Modify: `components/card.tsx`

Aggiorna Card e CardHeader con superficie calda `surface-1`, bordo warm, shadow warm, separatore gradient sottile sotto il titolo.

- [ ] **Step 1: Sostituisci il contenuto di `components/card.tsx`**

```tsx
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-[0_1px_3px_rgba(80,40,20,0.07),0_4px_16px_rgba(80,40,20,0.04)] md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-text-secondary">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mb-5 h-px bg-gradient-to-r from-border-subtle to-transparent" />
    </>
  );
}
```

- [ ] **Step 2: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```powershell
git add components/card.tsx
git commit -m "style: update Card with warm surface-1 and gradient separator (Layer 2a)"
```

---

### Task 3: Layer 2b — KpiCard redesign (`kpi-card.tsx`)

**Files:**
- Modify: `components/kpi-card.tsx`

Aggiunge prop `icon?: LucideIcon` opzionale, redesign layout: micro-label colorata sopra + valore extrabold 28px + icon box tinted in alto a destra.

- [ ] **Step 1: Sostituisci il contenuto di `components/kpi-card.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

type Status = "ok" | "warn" | "critical" | "neutral";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  status?: Status;
  icon?: LucideIcon;
};

const statusStyles: Record<
  Status,
  { card: string; label: string; value: string; iconBg: string; iconColor: string }
> = {
  ok: {
    card: "border-emerald-200 bg-surface-1",
    label: "text-emerald-700",
    value: "text-emerald-800",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
  },
  warn: {
    card: "border-amber-200 bg-surface-1",
    label: "text-amber-700",
    value: "text-amber-800",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  critical: {
    card: "border-rose-200 bg-surface-1",
    label: "text-rose-700",
    value: "text-rose-800",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
  },
  neutral: {
    card: "border-border-subtle bg-surface-1",
    label: "text-text-secondary",
    value: "text-text-primary",
    iconBg: "bg-surface-2",
    iconColor: "text-text-secondary",
  },
};

export function KpiCard({ title, value, subtitle, status = "neutral", icon: Icon }: Props) {
  const s = statusStyles[status];
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_1px_3px_rgba(80,40,20,0.07)] md:p-5 ${s.card}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-[.06em] ${s.label}`}>{title}</p>
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.iconBg}`}>
            <Icon className={`h-4 w-4 ${s.iconColor}`} />
          </div>
        )}
      </div>
      <p className={`text-[28px] font-extrabold leading-none tracking-tight ${s.value}`}>{value}</p>
      {subtitle && <p className={`mt-1.5 text-xs ${s.label}`}>{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore. `icon` è opzionale quindi nessuna pagina esistente va aggiornata.

- [ ] **Step 3: Commit**

```powershell
git add components/kpi-card.tsx
git commit -m "style: redesign KpiCard with extrabold value, micro-label, optional icon (Layer 2b)"
```

---

### Task 4: Layer 3a/b — TopBar + BottomNav

**Files:**
- Modify: `components/top-bar.tsx`
- Modify: `components/bottom-nav.tsx`

TopBar: box amber 26×26 per il logo, sfondo leggermente più scuro (`#5c1526`), active state con bordo amber. BottomNav: barra amber sopra l'item attivo invece del fill opaco `bg-white/15`.

- [ ] **Step 1: Sostituisci il contenuto di `components/top-bar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { BookOpen, ClipboardList, Euro, Home, LogOut, Plus, Settings, Warehouse } from "lucide-react";
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
    <header className="border-b border-white/10 bg-[#5c1526] shadow-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1 text-white hover:bg-white/10">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-brand">
            <BookOpen className="h-3.5 w-3.5 text-sidebar-bg" />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-bold">Alva Host</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-brand/70">Manager</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "border border-brand/25 bg-brand/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

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
```

- [ ] **Step 2: Sostituisci il contenuto di `components/bottom-nav.tsx`**

```tsx
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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-sidebar-bg shadow-[0_-2px_16px_rgba(0,0,0,0.2)] md:hidden"
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
              className={`relative flex min-h-[52px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all ${
                active ? "text-brand" : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-sm bg-brand" />
              )}
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
              <span className={`text-[11px] leading-none ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```powershell
git add components/top-bar.tsx components/bottom-nav.tsx
git commit -m "style: TopBar logo box + active border, BottomNav amber bar indicator (Layer 3a/b)"
```

---

### Task 5: Layer 3c — ActionBadges Lucide redesign

**Files:**
- Modify: `components/action-badges.tsx`
- Modify: `lib/actionMeta.ts`

Sostituisce le emoji con Lucide icons. Rimuove `getActionIcon` (usata solo da `action-badges.tsx` che stiamo riscrivendo). Ridisegna `ActionTypeBadge` con icon box 30×30 colorato + testo colored.

- [ ] **Step 1: Sostituisci `lib/actionMeta.ts`**

```ts
export const ACTION_COLORS = {
  booking: "#3b82f6",
  cleaning: "#16a34a",
  laundry: "#ea580c",
  linen: "#facc15",
  maintenance: "#7e22ce",
  shopping: "#64748b",
} as const;

export function getActionCategory(actionType: string): "cleaning" | "laundry" | "linen" | "maintenance" | "shopping" {
  const upper = actionType.toUpperCase();
  if (upper.includes("BIANCHERIA")) return "linen";
  if (upper.includes("PULIZIA") || upper.includes("LETTO")) return "cleaning";
  if (upper.includes("LAVATRICI") || upper.includes("LAVAND")) return "laundry";
  if (upper.includes("MANUT")) return "maintenance";
  return "shopping";
}
```

- [ ] **Step 2: Sostituisci `components/action-badges.tsx`**

```tsx
import { getActionCategory } from "@/lib/actionMeta";
import type { ActionStatus } from "@/types/db";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Layers,
  ShoppingCart,
  Sparkles,
  Wind,
  Wrench,
} from "lucide-react";

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "FATTO" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status === "FATTO" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

type BadgeConfig = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  textColor: string;
};

const BADGE_CONFIG: Record<"cleaning" | "laundry" | "linen" | "maintenance" | "shopping", BadgeConfig> = {
  cleaning: {
    icon: Sparkles,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    textColor: "text-emerald-800",
  },
  linen: {
    icon: Layers,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
    textColor: "text-purple-800",
  },
  laundry: {
    icon: Wind,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
    textColor: "text-orange-800",
  },
  maintenance: {
    icon: Wrench,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    textColor: "text-amber-800",
  },
  shopping: {
    icon: ShoppingCart,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    textColor: "text-slate-700",
  },
};

const DEFAULT_CONFIG: BadgeConfig = {
  icon: ClipboardList,
  iconBg: "bg-zinc-100",
  iconColor: "text-zinc-600",
  textColor: "text-zinc-700",
};

export function ActionTypeBadge({ actionType }: { actionType: string }) {
  const category = getActionCategory(actionType);
  const config = BADGE_CONFIG[category] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}>
        <Icon className={`h-4 w-4 ${config.iconColor}`} />
      </div>
      <span className={`text-xs font-semibold ${config.textColor}`}>{actionType}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```powershell
git add components/action-badges.tsx lib/actionMeta.ts
git commit -m "style: replace emoji with Lucide icons in ActionTypeBadge (Layer 3c)"
```

---

### Task 6: Layer 3d — Page headers pattern (tutte le pagine)

**Files:**
- Modify: `app/page.tsx` (riga 78-81)
- Modify: `app/bookings/page.tsx` (riga 203-206)
- Modify: `app/actions/page.tsx` (riga 559-562)
- Modify: `app/finance/page.tsx` (riga 159-162)
- Modify: `app/inventory/page.tsx` (riga 512-516)
- Modify: `app/settings/page.tsx` (riga 11-14)

Ogni pagina riceve il pattern: `icon-box burgundy 40×40 + h1 28px bold + sottotitolo xs`. Sostituire sempre il blocco `<header className="space-y-1">...</header>` con quello nuovo.

- [ ] **Step 1: Aggiorna `app/page.tsx`**

Aggiungi `LayoutDashboard` all'import di lucide (attualmente non ci sono import lucide in questo file — aggiungilo):

```tsx
import { LayoutDashboard } from "lucide-react";
```

Sostituisci (righe 78-81):
```tsx
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">Panoramica operativa giornaliera</p>
      </header>
```
Con:
```tsx
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <LayoutDashboard className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Dashboard</h1>
          <p className="mt-1 text-xs text-text-secondary">Panoramica operativa giornaliera</p>
        </div>
      </header>
```

- [ ] **Step 2: Aggiorna `app/bookings/page.tsx`**

Aggiungi `BedDouble` agli import lucide esistenti (riga 10 — attualmente: `CalendarDays, ChevronDown, PenLine, Plus, Save, Trash2, CalendarOff`):

```tsx
import { BedDouble, CalendarDays, CalendarOff, ChevronDown, PenLine, Plus, Save, Trash2 } from "lucide-react";
```

Sostituisci (righe 203-206):
```tsx
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Bookings</h1>
        <p className="text-sm text-zinc-500">Gestione prenotazioni e azioni collegate</p>
      </header>
```
Con:
```tsx
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <BedDouble className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Bookings</h1>
          <p className="mt-1 text-xs text-text-secondary">Gestione prenotazioni e azioni collegate</p>
        </div>
      </header>
```

- [ ] **Step 3: Aggiorna `app/actions/page.tsx`**

Aggiungi `CheckSquare` agli import lucide esistenti (riga 6 — attualmente: `CalendarRange, CheckCheck, ChevronLeft, ChevronRight, RefreshCw, ClipboardList`):

```tsx
import { CalendarRange, CheckCheck, CheckSquare, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
```

Sostituisci (righe 559-562):
```tsx
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Actions</h1>
        <p className="text-sm text-zinc-500">Azioni raggruppate per data</p>
      </header>
```
Con:
```tsx
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <CheckSquare className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Azioni</h1>
          <p className="mt-1 text-xs text-text-secondary">Azioni raggruppate per data</p>
        </div>
      </header>
```

- [ ] **Step 4: Aggiorna `app/finance/page.tsx`**

Aggiungi `TrendingUp` agli import lucide esistenti (riga 11 — attualmente: `ChartColumn, LineChartIcon, Plus, Trash2`):

```tsx
import { ChartColumn, LineChartIcon, Plus, TrendingUp, Trash2 } from "lucide-react";
```

Sostituisci (righe 159-162):
```tsx
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Finance / Spese</h1>
        <p className="text-sm text-zinc-500">Mese corrente con lista movimenti e analisi trend</p>
      </header>
```
Con:
```tsx
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <TrendingUp className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Finance</h1>
          <p className="mt-1 text-xs text-text-secondary">Mese corrente con lista movimenti e analisi trend</p>
        </div>
      </header>
```

- [ ] **Step 5: Aggiorna `app/inventory/page.tsx`**

Aggiungi `Package` agli import lucide esistenti (riga — attualmente: `AlertTriangle, ShoppingCart`):

```tsx
import { AlertTriangle, Package, ShoppingCart } from "lucide-react";
```

Sostituisci (righe 512-516):
```tsx
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Rifornimento</h1>
        <p className="text-sm text-zinc-500">
          Consumabili a 3 stati, biancheria a quantita
        </p>
      </header>
```
Con:
```tsx
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <Package className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Rifornimento</h1>
          <p className="mt-1 text-xs text-text-secondary">Consumabili a 3 stati, biancheria a quantità</p>
        </div>
      </header>
```

- [ ] **Step 6: Aggiorna `app/settings/page.tsx`**

Sostituisci il contenuto completo del file:

```tsx
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { requireOrganizationState } from "@/lib/organizationContext";

export default async function SettingsPage() {
  const { organization } = await requireOrganizationState();

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <Settings2 className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Impostazioni</h1>
          <p className="mt-1 text-xs text-text-secondary">Configurazioni operative del workspace</p>
        </div>
      </header>

      <Card className="p-6">
        <CardHeader
          title="Workspace"
          subtitle="Dati base dell'organizzazione attiva"
        />
        <WorkspaceSettingsForm organization={organization} mode="settings" />
      </Card>

      <Card>
        <CardHeader title="Sezioni avanzate" subtitle="Manteniamo disponibili i moduli tecnici senza appesantire la navigazione principale" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/warehouse" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Magazzino completo (Warehouse)
          </Link>
          <Link href="/onboarding" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Rivedi onboarding
          </Link>
        </div>
      </Card>
    </section>
  );
}
```

- [ ] **Step 7: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 8: Commit**

```powershell
git add app/page.tsx app/bookings/page.tsx app/actions/page.tsx app/finance/page.tsx app/inventory/page.tsx app/settings/page.tsx
git commit -m "style: apply icon-box page header pattern to all pages (Layer 3d)"
```

---

### Task 7: Layer 2c/d — Applica btn-* e input-base a Bookings

**Files:**
- Modify: `app/bookings/page.tsx`

Sostituisce classi inline ad-hoc con le utility `btn-primary`, `btn-secondary`, `btn-danger btn-sm`, `input-base`, `label-base`.

- [ ] **Step 1: Sostituisci labels del form "Nuova prenotazione" (6 occorrenze)**

Pattern da trovare: `className="text-xs font-medium text-zinc-600"`
Sostituisci con: `className="label-base"`

Le 6 label sono: Check-in, Check-out, Ospiti, Canale, Importo (€), Note.

- [ ] **Step 2: Sostituisci inputs del form "Nuova prenotazione" (6 occorrenze)**

Pattern da trovare: `className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-primary focus:outline-none"`
Sostituisci con: `className="input-base"`

- [ ] **Step 3: Sostituisci il bottone "Crea prenotazione" (riga ~250)**

Da:
```tsx
<button className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50" onClick={() => void createBooking()} disabled={loading}>
```
A:
```tsx
<button className="btn-primary mt-4 disabled:opacity-50" onClick={() => void createBooking()} disabled={loading}>
```

- [ ] **Step 4: Sostituisci bottoni mobile card (4 bottoni per card)**

Bottone "Azioni" (mobile):
```tsx
<button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-100" onClick={() => void toggleActionsForBooking(b.id)}>
```
→
```tsx
<button className="btn-secondary btn-sm inline-flex items-center justify-center gap-1" onClick={() => void toggleActionsForBooking(b.id)}>
```

Bottone "Salva" (mobile editing):
```tsx
<button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" onClick={() => void updateBooking(b.id)}>
```
→
```tsx
<button className="btn-primary btn-sm inline-flex items-center justify-center gap-1" onClick={() => void updateBooking(b.id)}>
```

Bottone "Modifica" (mobile):
```tsx
<button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-100" onClick={() => {
```
→
```tsx
<button className="btn-secondary btn-sm inline-flex items-center justify-center gap-1" onClick={() => {
```

Bottone "Elimina" (mobile):
```tsx
<button className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50" onClick={() => void deleteBooking(b.id)}>
```
→
```tsx
<button className="btn-danger btn-sm mt-2 inline-flex w-full items-center justify-center gap-1" onClick={() => void deleteBooking(b.id)}>
```

- [ ] **Step 5: Sostituisci bottoni desktop table (4 bottoni)**

Bottone "Azioni" (desktop):
```tsx
<button className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => void toggleActionsForBooking(b.id)}>
```
→
```tsx
<button className="btn-secondary btn-sm inline-flex items-center gap-1" onClick={() => void toggleActionsForBooking(b.id)}>
```

Bottone "Salva" (desktop):
```tsx
<button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700" onClick={() => void updateBooking(b.id)}>
```
→
```tsx
<button className="btn-primary btn-sm inline-flex items-center gap-1" onClick={() => void updateBooking(b.id)}>
```

Bottone "Modifica" (desktop):
```tsx
<button className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => {
```
→
```tsx
<button className="btn-secondary btn-sm inline-flex items-center gap-1" onClick={() => {
```

Bottone "Elimina" (desktop):
```tsx
<button className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" onClick={() => void deleteBooking(b.id)}>
```
→
```tsx
<button className="btn-danger btn-sm inline-flex items-center gap-1" onClick={() => void deleteBooking(b.id)}>
```

- [ ] **Step 6: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore. Verifica anche che il form di creazione prenotazione sia ancora funzionante (logica immutata).

- [ ] **Step 7: Commit**

```powershell
git add app/bookings/page.tsx
git commit -m "style: apply btn-* and input-base to bookings page (Layer 2c/d)"
```

---

### Task 8: Layer 2c/d — Applica btn-* e input-base a Finance

**Files:**
- Modify: `app/finance/page.tsx`

Sostituisce classi inline nei form e bottoni della pagina Finance.

- [ ] **Step 1: Sostituisci inputs sezione "Periodo" (2 inputs + 1 select)**

Pattern da trovare: `className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-primary"`
Sostituisci con: `className="input-base mt-1"`

Applica agli elementi: input month, select analisi trend (3 elementi totali).

- [ ] **Step 2: Sostituisci il bottone "Aggiungi"**

Da:
```tsx
className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-medium text-white transition hover:bg-rose-700 active:scale-95"
```
A:
```tsx
className="btn-danger min-h-[44px]"
```

- [ ] **Step 3: Sostituisci inputs form spese (3 inputs interni al form)**

Pattern da trovare: `className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-rose-500"`
Sostituisci con: `className="input-base mt-1"`

Applica agli elementi: input date, input importo, select categoria.

- [ ] **Step 4: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

- [ ] **Step 5: Commit**

```powershell
git add app/finance/page.tsx
git commit -m "style: apply btn-* and input-base to finance page (Layer 2c/d)"
```

---

### Task 9: Layer 2c/d — Applica input-base a Actions e Inventory

**Files:**
- Modify: `app/actions/page.tsx`
- Modify: `app/inventory/page.tsx`

Sostituisce classi inline input/label nei form delle due pagine più complesse. I modali separati (`CleaningModal`, `ActionChecklistModal`) non vengono toccati in questa fase.

- [ ] **Step 1: Leggi la parte dei form in actions/page.tsx**

```powershell
Get-Content "c:\Users\Enrico\airbnb-manager\app\actions\page.tsx" | Select-Object -Skip 555 -First 200
```

Cerca pattern: `border border-zinc-300`, `text-xs font-medium text-zinc-600`, `text-xs text-zinc-600`.

- [ ] **Step 2: Applica input-base e label-base in `app/actions/page.tsx`**

Per ogni `<input>` o `<select>` nel JSX principale (non nei modal importati) con classi del tipo `h-11 rounded-xl border border-zinc-300 px-3 text-sm`:
- Sostituisci con `className="input-base"`

Per ogni `<label>` con classi `text-xs font-medium text-zinc-600` o `text-xs text-zinc-600`:
- Sostituisci con `className="label-base block"` (aggiungendo `block` se la label ha `display:block` implicito)

- [ ] **Step 3: Leggi la parte dei form in inventory/page.tsx**

```powershell
Get-Content "c:\Users\Enrico\airbnb-manager\app\inventory\page.tsx" | Select-Object -Skip 509 -First 200
```

Cerca pattern: `border border-zinc-300`, `text-xs font-medium text-zinc-600`.

- [ ] **Step 4: Applica input-base e label-base in `app/inventory/page.tsx`**

Per ogni `<input>` o `<select>` nel JSX con classi del tipo `h-10 rounded-lg border border-zinc-300 px-2 text-sm` o simili:
- Sostituisci con `className="input-base"` (o `input-base h-10` se l'altezza specifica h-10 è necessaria per il layout)

Nota: `inventory/page.tsx` ha bottoni di rifornimento — non sostituirli con btn-* perché hanno logica di stato disabilitato personalizzata.

- [ ] **Step 5: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 6: Commit**

```powershell
git add app/actions/page.tsx app/inventory/page.tsx
git commit -m "style: apply input-base to actions and inventory forms (Layer 2c/d)"
```

---

### Task 10: Layer 4a — Calendar CSS aggiornato (`globals.css`)

> (ex Task 9 — rinumerato dopo aggiunta Task 9 per actions/inventory)

**Files:**
- Modify: `app/globals.css`

Tre modifiche chirurgiche al CSS del calendario: oggi amber (non blu), event pill più definiti, legenda con quadratini invece di pill rotondi.

- [ ] **Step 1: Cambia il colore di "oggi" da blu ad amber**

In `app/globals.css`, trova (righe 107-109):
```css
.calendar-modern .fc-daygrid-day.fc-day-today {
  background: rgba(59, 130, 246, 0.08);
}
```
Sostituisci con:
```css
.calendar-modern .fc-daygrid-day.fc-day-today {
  background: rgba(245, 200, 66, 0.15);
  border: 1.5px solid rgba(245, 200, 66, 0.45);
  border-radius: 6px;
}
```

- [ ] **Step 2: Aggiorna styling degli event pill**

Trova (righe 111-118):
```css
.calendar-modern .fc-event {
  border: 0;
  border-radius: 10px;
  padding: 0.1rem 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(54, 40, 24, 0.12);
}
```
Sostituisci con:
```css
.calendar-modern .fc-event {
  border: 0;
  border-radius: 8px;
  padding: 0.15rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: Cambia legenda da pill circolari a quadratini**

Trova (righe 148-158):
```css
.calendar-legend-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  padding: 0 0.3rem;
  font-weight: 700;
  color: #fff;
}
```
Sostituisci con:
```css
.calendar-legend-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1rem;
  height: 1.1rem;
  border-radius: 4px;
  font-weight: 700;
  color: #fff;
}
```

- [ ] **Step 4: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

- [ ] **Step 5: Commit**

```powershell
git add app/globals.css
git commit -m "style: calendar today amber, event pills refined, legend squares (Layer 4a)"
```

---

### Task 11: Layer 4b — Finance Recharts brand colors

**Files:**
- Modify: `app/finance/page.tsx`

Aggiorna i colori dei grafici Recharts: burgundy per revenue, amber per expenses, verde brand per occupancyRate, CartesianGrid e Tooltip warm.

Il file ha 2 grafici: `BarChart` (Revenue vs Spese, riga ~390) e `LineChart` (Occupancy Rate, riga ~413).

- [ ] **Step 1: Aggiorna BarChart**

Trova (riga ~391):
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
```
Sostituisci:
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#e0d5c8" />
```

Trova (riga ~401):
```tsx
<Tooltip />
```
Sostituisci:
```tsx
<Tooltip
  contentStyle={{
    background: "#fdfaf7",
    border: "1px solid #e0d5c8",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(80,40,20,0.08)",
  }}
/>
```

Trova (riga ~402):
```tsx
<Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
```
Sostituisci:
```tsx
<Bar dataKey="revenue" fill="#701a2f" radius={[6, 6, 0, 0]} />
```

Trova (riga ~403):
```tsx
<Bar dataKey="expenses" fill="#059669" radius={[6, 6, 0, 0]} />
```
Sostituisci:
```tsx
<Bar dataKey="expenses" fill="#f5c842" radius={[6, 6, 0, 0]} />
```

- [ ] **Step 2: Aggiorna LineChart**

Trova (riga ~414):
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
```
Sostituisci:
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#e0d5c8" />
```

Trova (riga ~424):
```tsx
<Tooltip />
```
Sostituisci:
```tsx
<Tooltip
  contentStyle={{
    background: "#fdfaf7",
    border: "1px solid #e0d5c8",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(80,40,20,0.08)",
  }}
/>
```

Trova (riga ~425):
```tsx
<Line type="monotone" dataKey="occupancyRate" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
```
Sostituisci:
```tsx
<Line type="monotone" dataKey="occupancyRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
```

- [ ] **Step 3: Verifica build**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

- [ ] **Step 4: Commit**

```powershell
git add app/finance/page.tsx
git commit -m "style: Recharts brand colors — burgundy/amber bars, green line, warm tooltip (Layer 4b)"
```

---

### Task 12: Layer 4c — Dashboard KPI-first + legenda quadratini

**Files:**
- Modify: `app/page.tsx`

Inverte l'ordine: KPI grid prima, Card calendario dopo. Aggiorna markup della legenda usando quadratini `rounded-[3px]` inline invece dei `.calendar-legend-token` circolari.

- [ ] **Step 1: Riordina e aggiorna il JSX del return in `app/page.tsx`**

Sostituisci l'intero blocco `return (...)` con:

```tsx
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <LayoutDashboard className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Dashboard</h1>
          <p className="mt-1 text-xs text-text-secondary">Panoramica operativa giornaliera</p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Prenotazioni Totali"
              value={String(bookings.length)}
              status={bookings.length > 0 ? "ok" : "neutral"}
            />
            <KpiCard
              title="Azioni Oggi"
              value={String(todayActions)}
              subtitle={`${openActions} da fare`}
              status={todayActions === 0 ? "neutral" : openActions > 0 ? "warn" : "ok"}
            />
            <KpiCard
              title="Azioni Aperte"
              value={String(openActions)}
              status={openActions === 0 ? "ok" : openActions >= 3 ? "critical" : "warn"}
            />
            <KpiCard
              title="Giorno"
              value={isClient ? new Date().toLocaleDateString("it-IT") : ""}
              status="neutral"
            />
          </>
        )}
      </div>

      <Card className="p-4">
        <CardHeader title="Calendario" subtitle="Prenotazioni e azioni" />
        <CalendarClient />
        <div className="calendar-legend mt-4">
          <span className="calendar-legend-label">Legenda</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#3b82f6]" />
          <span className="calendar-legend-text">Prenotazioni</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#16a34a]" />
          <span className="calendar-legend-text">Pulizia</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#facc15]" />
          <span className="calendar-legend-text">Biancheria</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#ea580c]" />
          <span className="calendar-legend-text">Lavatrici</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#7e22ce]" />
          <span className="calendar-legend-text">Manutenzione</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#64748b]" />
          <span className="calendar-legend-text">Spesa</span>
        </div>
      </Card>
    </section>
  );
```

Nota: `LayoutDashboard` è già stato importato nel Task 6 Step 1. Non aggiungere import duplicati.

- [ ] **Step 2: Verifica build finale**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```powershell
git add app/page.tsx
git commit -m "style: dashboard KPI-first order, legend rounded squares (Layer 4c)"
```

---

## Checkpoint finale (dopo tutti i task)

- [ ] Avvia dev server: `npm run dev`
- [ ] Apri `http://localhost:3000` su viewport 375px (DevTools mobile) e verifica:
  - KPI cards appaiono **prima** del calendario nella dashboard
  - Legenda calendario ha **quadratini** non pill circolari
  - Sfondo pagina è più scuro (warm beige) e le card `surface-1` si distinguono
  - Tutti i 5 tab del BottomNav portano alla pagina corretta
  - Barra amber appare **in cima** all'item attivo nel BottomNav (non fill opaco)
  - TopBar ha box amber 26×26 con icona BookOpen burgundy
  - Ogni pagina ha l'header con il box icona burgundy 40×40
  - `ActionTypeBadge` mostra icone Lucide (Sparkles=Pulizia, Layers=Biancheria, ecc.)
  - Form bookings: labels uppercase micro, inputs warm, bottoni burgundy/amber/rose
  - Finance chart ha barre burgundy (#701a2f) + amber (#f5c842), tooltip warm
  - Il "giorno oggi" nel calendario è evidenziato in amber (non blu)

---

## Vincoli rispettati

- Nessun cambio a logica, API, state management, route handlers
- `skeleton.tsx` e `toast.tsx` non toccati
- Mobile-first: ogni cambio compatibile con viewport 375px
- Nessuna nuova classe inline: solo utility da `globals.css` o Tailwind built-in
