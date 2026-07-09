import type { ReactNode } from "react";

type InlineAlertProps = {
  children: ReactNode;
  title?: string;
  tone?: "error" | "success" | "info" | "warning";
};

const toneClassName: Record<NonNullable<InlineAlertProps["tone"]>, string> = {
  error: "border-rose-200/90 bg-rose-50/95 text-rose-800",
  success: "border-emerald-200/90 bg-emerald-50/95 text-emerald-800",
  info: "border-amber-200/80 bg-amber-50/90 text-amber-900",
  warning: "border-amber-200/80 bg-amber-50/90 text-amber-900",
};

export function InlineAlert({ children, title, tone = "error" }: InlineAlertProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${toneClassName[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1.5" : ""}>{children}</div>
    </div>
  );
}
