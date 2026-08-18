import type { ReactNode } from "react";
import Link from "next/link";

type AuthShellProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ icon, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <div className="auth-shell-panel">
        <div className="space-y-8">
          <div className="space-y-6 text-center">
            <Link
              href="/"
              className="mx-auto inline-flex w-fit items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-text-secondary transition-colors duration-150 hover:text-text-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-gold">{icon}</span>
              Alva Host
            </Link>
            <div className="space-y-2">
              <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text-primary sm:text-[32px]">{title}</h1>
              <p className="mx-auto max-w-md text-sm leading-6 text-text-secondary sm:text-[15px]">{subtitle}</p>
            </div>
          </div>
          {children}
          {footer ? <div className="text-center text-sm text-text-secondary">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
