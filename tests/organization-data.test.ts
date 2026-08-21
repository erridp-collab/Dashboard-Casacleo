import { describe, expect, it } from "vitest";
import { organizationFromMembershipRows } from "@/lib/data/organizations";

const organizationA = {
  id: "org-a",
  name: "Org A",
  slug: "org-a",
  currency_code: "EUR",
  timezone: "Europe/Rome",
  settings: { onboarding_completed: true },
};

describe("organizationFromMembershipRows", () => {
  it("selects the preferred membership and its embedded organization", () => {
    const result = organizationFromMembershipRows(
      [
        { organization_id: "org-a", organization: organizationA },
        { organization_id: "org-b", organization: { ...organizationA, id: "org-b", name: "Org B" } },
      ],
      "org-b",
    );

    expect(result).toMatchObject({ id: "org-b", name: "Org B" });
  });

  it("falls back to the first membership when the preferred id is not authorized", () => {
    expect(
      organizationFromMembershipRows(
        [{ organization_id: "org-a", organization: organizationA }],
        "org-not-authorized",
      ),
    ).toMatchObject({ id: "org-a" });
  });

  it("rejects an embedded organization whose id differs from the membership FK", () => {
    expect(
      organizationFromMembershipRows([
        { organization_id: "org-a", organization: { ...organizationA, id: "org-b" } },
      ]),
    ).toBeNull();
  });
});
