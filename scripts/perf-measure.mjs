import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseURL = process.argv[2];
const runs = Number(process.argv[3] ?? 20);
const authFile = resolve(process.argv[4] ?? "playwright/.auth/user.json");

if (!baseURL || !Number.isInteger(runs) || runs < 1) {
  throw new Error("Usage: node scripts/perf-measure.mjs <base-url> [runs] [storage-state]");
}
if (!existsSync(authFile)) {
  throw new Error(`Missing Playwright storage state: ${authFile}`);
}

const routes = [
  { key: "dashboard", label: "Riepilogo", path: "/", apis: ["/api/bookings", "/api/actions"] },
  { key: "actions", label: "Azioni", path: "/actions", apis: ["/api/actions"] },
  { key: "bookings", label: "Prenotazioni", path: "/bookings", apis: ["/api/bookings"] },
  { key: "inventory", label: "Rifornimento", path: "/inventory", apis: ["/api/products"] },
  { key: "finance", label: "Spese", path: "/finance", apis: ["/api/finance"] },
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function round(value) {
  return Number(value.toFixed(1));
}

function summarize(values) {
  return {
    samples: values.length,
    min: round(Math.min(...values)),
    p50: round(percentile(values, 0.5)),
    p75: round(percentile(values, 0.75)),
    p95: round(percentile(values, 0.95)),
    max: round(Math.max(...values)),
  };
}

function matchesApi(response, path) {
  const url = new URL(response.url());
  return url.pathname === path && response.request().method() === "GET";
}

function parseServerTiming(header) {
  if (!header) return [];
  return header.split(",").flatMap((part) => {
    const match = part.trim().match(/^([^;]+);dur=([0-9.]+)/);
    return match ? [{ name: match[1], duration: Number(match[2]) }] : [];
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: authFile,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const samples = Object.fromEntries(routes.map((route) => [route.key, []]));
const serverTiming = Object.fromEntries(routes.map((route) => [route.key, {}]));
const consolePerf = [];

page.on("console", (message) => {
  const text = message.text();
  if (text.startsWith("[perf] nav:")) consolePerf.push(text);
});

async function waitForCurrentData(route) {
  const responses = route.apis.map((api) =>
    page.waitForResponse(
      (response) => matchesApi(response, api) && response.status() === 200,
      { timeout: 30_000 },
    ),
  );
  return Promise.all(responses);
}

async function navigateAndMeasure(route, record) {
  const responsePromise = waitForCurrentData(route);
  await page.evaluate(() => {
    window.__alvaExternalPerfStart = null;
    document.addEventListener(
      "click",
      () => {
        window.__alvaExternalPerfStart = performance.now();
      },
      { capture: true, once: true },
    );
  });

  await page.getByRole("link", { name: route.label, exact: true }).click();
  await page.waitForFunction((path) => window.location.pathname === path, route.path);
  const responses = await responsePromise;

  const duration = await page.evaluate(
    () =>
      new Promise((resolveDuration) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (typeof window.__alvaExternalPerfStart !== "number") {
              throw new Error("Navigation click was not observed");
            }
            resolveDuration(performance.now() - window.__alvaExternalPerfStart);
          });
        });
      }),
  );

  if (record) {
    samples[route.key].push(duration);
    for (const response of responses) {
      for (const metric of parseServerTiming(response.headers()["server-timing"])) {
        serverTiming[route.key][metric.name] ??= [];
        serverTiming[route.key][metric.name].push(metric.duration);
      }
    }
  }
}

try {
  await page.goto(`${baseURL}/finance`, { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname === "/login") {
    throw new Error("Stored authentication state is not valid for this server");
  }
  for (const route of routes) await navigateAndMeasure(route, false);
  for (let run = 0; run < runs; run += 1) {
    for (const route of routes) await navigateAndMeasure(route, true);
  }

  const summary = Object.fromEntries(
    routes.map((route) => [route.key, summarize(samples[route.key])]),
  );
  const serverSummary = Object.fromEntries(
    routes.map((route) => [
      route.key,
      Object.fromEntries(
        Object.entries(serverTiming[route.key]).map(([name, values]) => [name, summarize(values)]),
      ),
    ]),
  );

  process.stdout.write(
    `${JSON.stringify({
      baseURL,
      runs,
      summary,
      serverSummary,
      consolePerfCount: consolePerf.length,
      recentConsolePerf: consolePerf.slice(-5),
    }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
