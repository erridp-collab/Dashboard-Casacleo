import type { ReactNode } from "react";

/**
 * Grouped operational list — IMPLEMENTATION_PLAN_UI_UX.md, sezione 7 (Azioni)
 * e 8: sezioni con header + divider + spacing al posto di una card per
 * ciascun gruppo (es. per data).
 */
export function ListPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl border border-border-strong/12 bg-surface-raised ${className}`}>{children}</div>;
}

export function ListGroup({ children, isFirst = false }: { children: ReactNode; isFirst?: boolean }) {
  return <div className={isFirst ? "" : "border-t border-border-strong/12"}>{children}</div>;
}

export function ListSectionHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-strong/12 bg-surface-muted px-4 py-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-text-secondary">{title}</h2>
      {action ?? null}
    </div>
  );
}

export function ListRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border-strong/10">{children}</div>;
}

export function ListRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${className}`}>{children}</div>;
}
