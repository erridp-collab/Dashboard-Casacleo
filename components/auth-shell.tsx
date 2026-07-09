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
      <div className="auth-shell-glow auth-shell-glow--top" />
      <div className="auth-shell-glow auth-shell-glow--bottom" />
      <div className="auth-shell-panel">
        <div className="space-y-8">
          <div className="space-y-6 text-center">
            <Link href="/" className="mx-auto inline-flex w-fit items-center gap-3 rounded-full border border-white/60 bg-white/75 px-4 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-bg text-brand shadow-[0_12px_24px_rgba(92,21,38,0.28)]">
                {icon}
              </span>
              <span className="leading-none">
                <span className="block text-[13px] font-semibold tracking-[0.08em] text-text-secondary">ALVA HOST</span>
                <span className="mt-1 block text-lg font-semibold tracking-[-0.03em] text-text-primary">{title}</span>
              </span>
            </Link>
            <div className="space-y-2">
              <h1 className="text-[30px] font-bold tracking-[-0.04em] text-text-primary sm:text-[34px]">{title}</h1>
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
