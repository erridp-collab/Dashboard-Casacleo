import { getActionCategory } from "@/lib/actionMeta";
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

type BadgeConfig = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  textColor: string;
};

const BADGE_CONFIG: Record<"cleaning" | "laundry" | "linen" | "maintenance" | "shopping", BadgeConfig> = {
  cleaning: {
    icon: Sparkles,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    textColor: "text-emerald-800",
  },
  linen: {
    icon: Layers,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
    textColor: "text-purple-800",
  },
  laundry: {
    icon: Wind,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
    textColor: "text-orange-800",
  },
  maintenance: {
    icon: Wrench,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    textColor: "text-amber-800",
  },
  shopping: {
    icon: ShoppingCart,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    textColor: "text-slate-700",
  },
};

const DEFAULT_CONFIG: BadgeConfig = {
  icon: ClipboardList,
  iconBg: "bg-zinc-100",
  iconColor: "text-zinc-600",
  textColor: "text-zinc-700",
};

export function ActionTypeBadge({ actionType }: { actionType: string }) {
  const category = getActionCategory(actionType);
  const config = BADGE_CONFIG[category] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}>
        <Icon className={`h-4 w-4 ${config.iconColor}`} />
      </div>
      <span className={`text-xs font-semibold ${config.textColor}`}>{actionType}</span>
    </div>
  );
}
