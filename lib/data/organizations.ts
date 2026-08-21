export const MEMBERSHIP_WITH_ORGANIZATION_SELECT = `
  organization_id,
  organization:organizations!user_roles_organization_id_fkey (
    id,
    name,
    slug,
    currency_code,
    timezone,
    settings
  )
`;

export type OrganizationProjectionRecord = {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  settings: Record<string, unknown>;
};

type MembershipProjection = Record<string, unknown>;

function embeddedOrganization(value: unknown): MembershipProjection | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as MembershipProjection) : null;
  }
  return value && typeof value === "object" ? (value as MembershipProjection) : null;
}

function settingsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Selects a membership and rejects an embedded organization whose FK id disagrees. */
export function organizationFromMembershipRows(
  rows: MembershipProjection[],
  preferredOrganizationId?: string | null,
): OrganizationProjectionRecord | null {
  const selected =
    rows.find((row) => String(row.organization_id ?? "") === preferredOrganizationId) ?? rows[0];
  if (!selected) return null;

  const membershipOrganizationId = String(selected.organization_id ?? "");
  const organization = embeddedOrganization(selected.organization);
  if (!membershipOrganizationId || !organization) return null;
  if (String(organization.id ?? "") !== membershipOrganizationId) return null;

  return {
    id: membershipOrganizationId,
    name: String(organization.name ?? ""),
    slug: String(organization.slug ?? ""),
    currency_code: String(organization.currency_code ?? "EUR"),
    timezone: String(organization.timezone ?? "Europe/Rome"),
    settings: settingsRecord(organization.settings),
  };
}
