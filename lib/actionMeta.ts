export const ACTION_COLORS = {
  booking: "#3b82f6",
  cleaning: "#16a34a",
  laundry: "#ea580c",
  maintenance: "#7e22ce",
  generic: "#64748b",
} as const;

export function getActionCategory(actionType: string): "cleaning" | "laundry" | "maintenance" | "generic" {
  const upper = actionType.toUpperCase();
  if (upper.includes("PULIZIA") || upper.includes("LETTO")) return "cleaning";
  if (upper.includes("LAVATRICI") || upper.includes("LAVAND")) return "laundry";
  if (upper.includes("MANUT")) return "maintenance";
  return "generic";
}

export function getActionIcon(actionType: string): string {
  const category = getActionCategory(actionType);
  if (category === "cleaning") return "🧹";
  if (category === "laundry") return "🧺";
  if (category === "maintenance") return "🛠";
  return "📌";
}

