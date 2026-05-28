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
