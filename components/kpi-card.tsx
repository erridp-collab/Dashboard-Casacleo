type Props = {
  title: string;
  value: string;
  subtitle?: string;
};

export function KpiCard({ title, value, subtitle }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-900 md:text-2xl">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}
