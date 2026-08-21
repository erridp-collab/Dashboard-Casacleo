import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "app", "api");
const HTTP_EXPORT = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

describe("API authentication boundary", () => {
  it("keeps every tenant API method behind requireRouteContext", () => {
    const failures: string[] = [];

    for (const file of routeFiles(API_ROOT)) {
      const route = relative(API_ROOT, file).replaceAll("\\", "/");
      if (route.startsWith("cron/")) continue;

      const source = readFileSync(file, "utf8");
      const exports = [...source.matchAll(HTTP_EXPORT)];

      for (let index = 0; index < exports.length; index += 1) {
        const current = exports[index];
        const next = exports[index + 1];
        const methodBody = source.slice(current.index, next?.index ?? source.length);
        if (!methodBody.includes("requireRouteContext(")) {
          failures.push(`${route}:${current[1]}`);
        }
      }
    }

    expect(failures, `API methods without tenant auth: ${failures.join(", ")}`).toEqual([]);
  });

  it("keeps system cron routes behind an explicit shared secret", () => {
    const cronFile = join(API_ROOT, "cron", "cleaning-reminder", "route.ts");
    const source = readFileSync(cronFile, "utf8");

    expect(source).toContain("process.env.APP_PASSWORD");
    expect(source).toContain("status: 401");
  });

  it("keeps the unified bookings read scoped on both sides of the relation", () => {
    const bookingsFile = join(API_ROOT, "bookings", "route.ts");
    const source = readFileSync(bookingsFile, "utf8");
    const getStart = source.indexOf("export async function GET");
    const postStart = source.indexOf("export async function POST", getStart);
    const getBody = source.slice(getStart, postStart);

    expect(getBody).toContain('.eq("organization_id", organizationId)');
    expect(getBody).toContain('.eq("actions.organization_id", organizationId)');
    expect(getBody).toContain('timed(phases, "db-bookings-with-cleaning"');
    expect(getBody).not.toContain('.from("actions")');
    expect(getBody).not.toContain("db-actions-status");

    const dashboardSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    expect(dashboardSource).toContain("includeCleaningStatus=false");
  });

  it("keeps the unified finance expense read scoped on both sides of the relation", () => {
    const financeFile = join(API_ROOT, "finance", "route.ts");
    const source = readFileSync(financeFile, "utf8");
    const getStart = source.indexOf("export async function GET");
    const postStart = source.indexOf("export async function POST", getStart);
    const getBody = source.slice(getStart, postStart);

    expect(getBody).toContain("EXPENSE_WITH_SOURCE_ACTION_SELECT");
    expect(getBody).toContain('.eq("organization_id", organizationId)');
    expect(getBody).toContain('.eq("source_action.organization_id", organizationId)');

    const legacyStart = getBody.indexOf("if (usesLegacyExpenseProjection)");
    const legacyBody = getBody.slice(legacyStart);
    expect(legacyStart).toBeGreaterThan(-1);
    expect(legacyBody).toContain('.from("actions")');
    expect(legacyBody).toContain('.eq("organization_id", organizationId)');
  });
});
