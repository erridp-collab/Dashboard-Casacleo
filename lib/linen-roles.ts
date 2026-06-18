// lib/linen-roles.ts

export type LinenRole =
  | "set_estivo"
  | "set_invernale"
  | "asciugamano_corpo"
  | "asciugamano_doccia"
  | "asciugamano_bidet"
  | "asciugamano_viso"
  | "tappetino_doccia"
  | "mappina_cucina";

export const LINEN_ROLE_VALUES: ReadonlySet<string> = new Set<LinenRole>([
  "set_estivo",
  "set_invernale",
  "asciugamano_corpo",
  "asciugamano_doccia",
  "asciugamano_bidet",
  "asciugamano_viso",
  "tappetino_doccia",
  "mappina_cucina",
]);

export type LinenRoleInfo = {
  value: LinenRole;
  label: string;
  formulaLabel: string;
  consumption: (guests: number) => number;
};

export const LINEN_ROLES: LinenRoleInfo[] = [
  {
    value: "set_estivo",
    label: "Set letto estivo",
    formulaLabel: "1 ogni 2 ospiti per prenotazione",
    consumption: (guests) => Math.ceil(guests / 2),
  },
  {
    value: "set_invernale",
    label: "Set letto invernale",
    formulaLabel: "1 ogni 2 ospiti per prenotazione",
    consumption: (guests) => Math.ceil(guests / 2),
  },
  {
    value: "asciugamano_corpo",
    label: "Asciugamano corpo",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_doccia",
    label: "Asciugamano doccia",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_bidet",
    label: "Asciugamano bidet",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "asciugamano_viso",
    label: "Asciugamano viso",
    formulaLabel: "1 per ospite per prenotazione",
    consumption: (guests) => guests,
  },
  {
    value: "tappetino_doccia",
    label: "Tappetino doccia",
    formulaLabel: "1 fisso per prenotazione",
    consumption: () => 1,
  },
  {
    value: "mappina_cucina",
    label: "Mappina cucina",
    formulaLabel: "1 fisso per prenotazione",
    consumption: () => 1,
  },
];

export function isLinenRole(value: unknown): value is LinenRole {
  return typeof value === "string" && LINEN_ROLE_VALUES.has(value);
}
