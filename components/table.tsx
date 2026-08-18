import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong/12 bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-text-primary">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border-strong/12 bg-surface-muted text-xs uppercase tracking-[0.12em] text-text-secondary">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border-strong/10">{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`transition-colors duration-150 hover:bg-surface-muted ${className}`}>{children}</tr>;
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
