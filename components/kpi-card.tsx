type Status = "ok" | "warn" | "critical" | "neutral";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  status?: Status;
};

const statusStyles: Record<Status, { card: string; value: string; dot: string }> = {
  ok:       { card: "border-emerald-200 bg-emerald-50",  value: "text-emerald-700", dot: "bg-emerald-400" },
  warn:     { card: "border-amber-200 bg-amber-50",      value: "text-amber-700",   dot: "bg-amber-400"   },
  critical: { card: "border-rose-200 bg-rose-50",        value: "text-rose-700",    dot: "bg-rose-400"    },
  neutral:  { card: "border-zinc-200 bg-white",          value: "text-zinc-900",    dot: ""               },
};

export function KpiCard({ title, value, subtitle, status = "neutral" }: Props) {
  const s = statusStyles[status];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${s.card}`}>
      <div className="flex items-center gap-2">
        {status !== "neutral" && <span className={`h-2 w-2 rounded-full ${s.dot}`} />}
        <p className="text-sm text-zinc-500">{title}</p>
      </div>
      <p className={`mt-2 text-xl font-semibold md:text-2xl ${s.value}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}
