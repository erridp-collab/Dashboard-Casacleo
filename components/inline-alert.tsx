import type { ReactNode } from "react";

type InlineAlertProps = {
  children: ReactNode;
  title?: string;
  tone?: "error" | "success" | "info" | "warning";
};

const toneClassName: Record<NonNullable<InlineAlertProps["tone"]>, string> = {
  error: "border-semantic-error/30 bg-semantic-error/8 text-text-primary",
  success: "border-semantic-success/25 bg-semantic-success/8 text-semantic-success",
  info: "border-semantic-info/25 bg-semantic-info/8 text-semantic-info",
  warning: "border-semantic-warning/30 bg-semantic-warning/8 text-text-primary",
};

export function InlineAlert({ children, title, tone = "error" }: InlineAlertProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClassName[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1.5" : ""}>{children}</div>
    </div>
  );
}
