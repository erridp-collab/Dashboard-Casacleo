import { getActionCategory, getActionTypeLabel } from "@/lib/actionMeta";
import type { ActionStatus } from "@/types/db";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Layers,
  ShoppingCart,
  Sparkles,
  Wind,
  Wrench,
} from "lucide-react";

export function StatusBadge({ status }: { status: ActionStatus }) {
  const done = status === "FATTO";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-text-primary ${
        done ? "bg-semantic-success/10" : "bg-semantic-warning/10"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-semantic-success" aria-hidden="true" />
      ) : (
        <CircleDashed className="h-3.5 w-3.5 text-semantic-warning" aria-hidden="true" />
      )}
      {done ? "Completata" : "Da fare"}
    </span>
  );
}

type BadgeConfig = {
  icon: LucideIcon;
};

const BADGE_CONFIG: Record<"cleaning" | "laundry" | "linen" | "maintenance" | "shopping", BadgeConfig> = {
  cleaning: {
    icon: Sparkles,
  },
  linen: {
    icon: Layers,
  },
  laundry: {
    icon: Wind,
  },
  maintenance: {
    icon: Wrench,
  },
  shopping: {
    icon: ShoppingCart,
  },
};

const DEFAULT_CONFIG: BadgeConfig = {
  icon: ClipboardList,
};

export function ActionTypeBadge({ actionType }: { actionType: string }) {
  const category = getActionCategory(actionType);
  const config = BADGE_CONFIG[category] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-surface-muted">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <span className="text-xs font-semibold text-text-primary">{getActionTypeLabel(actionType)}</span>
    </div>
  );
}
