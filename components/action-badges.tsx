import { getActionCategory, getActionIcon } from "@/lib/actionMeta";
import type { ActionStatus } from "@/types/db";
import { CheckCircle2, CircleDashed } from "lucide-react";

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "FATTO" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status === "FATTO" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

export function ActionTypeBadge({ actionType }: { actionType: string }) {
  const category = getActionCategory(actionType);

  const className =
    category === "cleaning"
      ? "bg-green-100 text-green-800"
      : category === "laundry"
        ? "bg-orange-100 text-orange-800"
        : category === "linen"
          ? "bg-yellow-100 text-yellow-800"
        : category === "maintenance"
          ? "bg-purple-100 text-purple-800"
          : "bg-slate-100 text-slate-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      <span className="mr-1">{getActionIcon(actionType)}</span>
      {actionType}
    </span>
  );
}
