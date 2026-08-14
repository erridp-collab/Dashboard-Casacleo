import { AlertTriangle } from "lucide-react";
import type { RefillState } from "@/lib/refill";

export function RefillStateBadge({ state }: { state: RefillState }) {
  if (state === "DA_RIFORNIRE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-semantic-error/10 px-2.5 py-1 text-xs font-medium text-text-primary">
        <AlertTriangle className="h-3.5 w-3.5 text-semantic-error" aria-hidden="true" />
        Da rifornire
      </span>
    );
  }
  if (state === "IN_ESAURIMENTO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-semantic-warning/10 px-2.5 py-1 text-xs font-medium text-text-primary">
        <AlertTriangle className="h-3.5 w-3.5 text-semantic-warning" aria-hidden="true" />
        In esaurimento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-semantic-success/10 px-2.5 py-1 text-xs font-medium text-semantic-success">
      OK
    </span>
  );
}
