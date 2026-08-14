import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

type Status = "ok" | "warn" | "critical" | "neutral";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  status?: Status;
  /** Testo accessibile per l'indicatore di stato (letto dagli screen reader). */
  statusLabel?: string;
  icon?: LucideIcon;
  onClick?: () => void;
};

const statusIndicator: Record<Status, { dot: string; text: string; label: string } | null> = {
  ok: { dot: "bg-semantic-success", text: "text-semantic-success", label: "OK" },
  warn: { dot: "bg-semantic-warning", text: "text-semantic-warning", label: "Attenzione" },
  critical: { dot: "bg-semantic-error", text: "text-semantic-error", label: "Critico" },
  neutral: null,
};

export function KpiCard({ title, value, subtitle, status = "neutral", statusLabel, icon: Icon, onClick }: Props) {
  const indicator = statusIndicator[status];
  const clickable = Boolean(onClick);
  const statusText = indicator ? (statusLabel ?? indicator.label) : null;

  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.06em] text-text-secondary">
          {indicator && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${indicator.dot}`} aria-hidden="true" />}
          {title}
        </p>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
            <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="text-[28px] font-extrabold leading-none tracking-tight text-text-primary">{value}</p>
      {(subtitle || statusText) && (
        <p className={`mt-1.5 text-xs ${indicator ? indicator.text : "text-text-secondary"}`}>
          {[subtitle, statusText].filter(Boolean).join(" · ")}
        </p>
      )}
      {clickable && (
        <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-text-secondary" aria-hidden="true" />
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative w-full rounded-2xl border border-border-strong/12 bg-surface-raised p-4 text-left transition-colors duration-150 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary md:p-5"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="relative rounded-2xl border border-border-strong/12 bg-surface-raised p-4 md:p-5">{body}</div>
  );
}
