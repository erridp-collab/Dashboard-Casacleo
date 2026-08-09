import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

type Status = "ok" | "warn" | "critical" | "neutral";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  status?: Status;
  icon?: LucideIcon;
  onClick?: () => void;
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

export function KpiCard({ title, value, subtitle, status = "neutral", icon: Icon, onClick }: Props) {
  const s = statusStyles[status];
  const clickable = Boolean(onClick);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={`relative rounded-[24px] border p-4 shadow-[0_14px_32px_rgba(77,40,17,0.08)] md:p-5 ${s.card} ${
        clickable
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(77,40,17,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-[.06em] ${s.label}`}>{title}</p>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.iconBg}`}>
            <Icon className={`h-4 w-4 ${s.iconColor}`} />
          </div>
        )}
      </div>
      <p className={`text-[28px] font-extrabold leading-none tracking-tight ${s.value}`}>{value}</p>
      {subtitle && <p className={`mt-1.5 text-xs ${s.label}`}>{subtitle}</p>}
      {clickable && (
        <span className={`absolute bottom-3 right-4 text-sm font-bold ${s.label}`} aria-hidden="true">
          ›
        </span>
      )}
    </div>
  );
}
