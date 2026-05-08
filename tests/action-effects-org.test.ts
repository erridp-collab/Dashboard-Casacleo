import { describe, expect, it } from "vitest";
import { applyLinenConsumptionDelta } from "@/lib/action-effects";

describe("action-effects organization guards", () => {
  it("requires organizationId for linen consumption deltas", async () => {
    await expect(
      applyLinenConsumptionDelta({ sets_estivo: 1 }, 1),
    ).rejects.toThrow("organizationId is required");
  });
});
