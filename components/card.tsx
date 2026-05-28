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
  return (
    <section
      className={`rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-[0_1px_3px_rgba(80,40,20,0.07),0_4px_16px_rgba(80,40,20,0.04)] md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-text-secondary">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mb-5 h-px bg-gradient-to-r from-border-subtle to-transparent" />
    </>
  );
}
