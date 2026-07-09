import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-border-subtle/80 bg-white/70">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-text-primary">{children}</table>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[rgba(255,252,247,0.95)] to-transparent md:hidden" />
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border-subtle bg-white/65 text-xs uppercase tracking-[0.12em] text-text-secondary">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border-subtle/70">{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`transition hover:bg-white/80 ${className}`}>{children}</tr>;
}

export function TableHeaderCell({
  children,
  className = "",
  ...props
}: { children: ReactNode; className?: string } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-3 py-3 font-medium ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
  ...props
}: { children: ReactNode; className?: string } & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-3 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
