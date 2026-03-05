import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-zinc-700">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`transition hover:bg-zinc-50 ${className}`}>{children}</tr>;
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
