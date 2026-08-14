// Colori eventi calendario — allineati alla palette Alva Host in app/globals.css
// (letterali perche' FullCalendar richiede stringhe colore, non classi Tailwind;
// vedi IMPLEMENTATION_PLAN_UI_UX.md, sezione 5 "ridurre l'effetto arcobaleno").
export const ACTION_COLORS = {
  booking: "#B83560", // --brand-primary
  cleaning: "#3D7A5E", // --semantic-success
  laundry: "#E06090", // --brand-secondary
  linen: "#3A6080", // --semantic-info
  maintenance: "#C47A20", // --semantic-warning
  shopping: "#8A2A50", // --text-muted / --border-strong
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
