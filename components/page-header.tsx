import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, icon, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="page-header-icon">
            {icon}
          </div>
        ) : null}
        <div className="space-y-1.5">
          {eyebrow ? <p className="page-header-eyebrow">{eyebrow}</p> : null}
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.03em] text-text-primary sm:text-[34px]">{title}</h1>
          {subtitle ? <p className="max-w-2xl text-sm text-text-secondary sm:text-[15px]">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
