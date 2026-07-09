export const ACTION_COLORS = {
  booking: "#3b82f6",
  cleaning: "#16a34a",
  laundry: "#ea580c",
  linen: "#facc15",
  maintenance: "#7e22ce",
  shopping: "#64748b",
} as const;

export function getActionCategory(actionType: string): "cleaning" | "laundry" | "linen" | "maintenance" | "shopping" {
  const upper = actionType.toUpperCase();
  if (upper.includes("BIANCHERIA")) return "linen";
  if (upper.includes("PULIZIA") || upper.includes("LETTO")) return "cleaning";
  if (upper.includes("LAVATRICI") || upper.includes("LAVAND")) return "laundry";
  if (upper.includes("MANUT")) return "maintenance";
  return "shopping";
}

export function getActionTypeLabel(actionType: string): string {
  const upper = actionType.toUpperCase();
  if (upper.includes("BIANCHERIA")) return "Cambio biancheria";
  if (upper.includes("PREPARA_LETTO")) return "Preparazione letto";
  if (upper.includes("PULIZIA")) return "Pulizia";
  if (upper.includes("LAVATRICI") || upper.includes("LAVAND")) return "Lavatrici";
  if (upper.includes("MANUT")) return "Manutenzione";
  if (upper === "SPESA") return "Spesa";
  return "Attività";
}
