import { getActionCategory, getActionIcon } from "@/lib/actionMeta";
import type { ActionStatus } from "@/types/db";

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        status === "FATTO" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
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
        : category === "maintenance"
          ? "bg-purple-100 text-purple-800"
          : "bg-slate-100 text-slate-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${className}`}>
      <span className="mr-1">{getActionIcon(actionType)}</span>
      {actionType}
    </span>
  );
}

