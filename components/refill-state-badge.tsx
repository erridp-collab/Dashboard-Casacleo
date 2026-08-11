import { AlertTriangle } from "lucide-react";
import type { RefillState } from "@/lib/refill";

export function RefillStateBadge({ state }: { state: RefillState }) {
  if (state === "DA_RIFORNIRE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        DA RIFORNIRE
      </span>
    );
  }
  if (state === "IN_ESAURIMENTO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        IN ESAURIMENTO
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">OK</span>;
}
