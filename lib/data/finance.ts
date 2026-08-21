export const EXPENSE_WITH_SOURCE_ACTION_SELECT = `
  *,
  source_action:actions!expenses_source_action_id_fkey (
    id,
    organization_id,
    details
  )
`;

type ExpenseRow = Record<string, unknown>;

function embeddedSourceAction(value: unknown): ExpenseRow | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as ExpenseRow) : null;
  }
  return value && typeof value === "object" ? (value as ExpenseRow) : null;
}

/**
 * Reads refill details only when the parent expense and embedded action agree
 * on both relationship id and authorized tenant.
 */
export function expenseRestockDetail(expense: ExpenseRow, organizationId: string): string | null {
  if (String(expense.origin ?? "") !== "automatica_da_rifornimento") return null;

  const sourceActionId = expense.source_action_id;
  if (typeof sourceActionId !== "string" || sourceActionId.length === 0) return null;

  const action = embeddedSourceAction(expense.source_action);
  if (!action) return null;
  if (String(action.organization_id ?? "") !== organizationId) return null;
  if (String(action.id ?? "") !== sourceActionId) return null;

  return action.details ? String(action.details) : null;
}
