// Colori eventi calendario — allineati alla palette Alva Host in app/globals.css
// (letterali perche' FullCalendar richiede stringhe colore, non classi Tailwind;
// vedi IMPLEMENTATION_PLAN_UI_UX.md, sezione 5 "ridurre l'effetto arcobaleno").
export const ACTION_COLORS = {
  booking: "#B83560", // --brand-primary
  cleaning: "#3E7D8A", // categoriale, teal — non riusa --semantic-success
  laundry: "#E06090", // --brand-secondary
  linen: "#6B5B95", // categoriale, prugna — non riusa --semantic-info
  maintenance: "#8C6239", // categoriale, bronzo — non riusa --semantic-warning
  shopping: "#8A2A50", // --border-strong
} as const;

// Sigle mostrate al posto del testo intero negli eventi calendario su schermi stretti
// (celle giorno troppo piccole per il testo completo). "Pr"/"Pu" a due lettere per
// distinguere Prenotazioni da Pulizia, che condividono l'iniziale.
export const ACTION_ABBR: Record<"booking" | "cleaning" | "laundry" | "linen" | "maintenance" | "shopping", string> = {
  booking: "Pr",
  cleaning: "Pu",
  linen: "B",
  laundry: "L",
  maintenance: "M",
  shopping: "S",
};

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
