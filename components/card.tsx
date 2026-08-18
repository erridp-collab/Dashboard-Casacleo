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
    <section className={`rounded-2xl border border-border-strong/12 bg-surface-raised p-5 md:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mb-5 h-px bg-border-strong/12" />
    </>
  );
}
