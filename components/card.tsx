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
      className={`rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(251,246,239,0.96))] p-5 shadow-[0_16px_40px_rgba(77,40,17,0.08)] backdrop-blur md:p-6 ${className}`}
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
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mb-5 h-px bg-gradient-to-r from-border-default/70 via-border-subtle to-transparent" />
    </>
  );
}
