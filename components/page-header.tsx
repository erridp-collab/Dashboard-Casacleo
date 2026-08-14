import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /**
   * @deprecated Il pattern "icon box" decorativo è stato eliminato
   * (IMPLEMENTATION_PLAN_UI_UX.md, sezione 3). Non viene più renderizzata:
   * rimuovere questa prop dalle pagine quando vengono aggiornate.
   */
  icon?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="page-header-eyebrow">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
