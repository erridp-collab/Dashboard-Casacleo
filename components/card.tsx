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
  return <section className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

