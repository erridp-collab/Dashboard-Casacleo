const CLICK_MARK_PREFIX = "nav:";
const CLICK_SUFFIX = ":click";
const VISIBLE_SUFFIX = ":visible";

/** Called on nav-link click. Marks the start of a "how long until data is on screen" window. */
export function markNavClick(route: string): void {
  if (typeof performance === "undefined") return;
  performance.mark(`${CLICK_MARK_PREFIX}${route}${CLICK_SUFFIX}`);
}

/**
 * Called from a page's data-loaded success path (not on error, not on silent
 * background revalidation). No-ops silently if there is no pending click
 * mark for this route — e.g. a silent revalidation triggered by a filter
 * change, not a menu click — so it's safe to call unconditionally.
 */
export function markDataVisible(route: string): void {
  if (typeof performance === "undefined") return;
  const clickMark = `${CLICK_MARK_PREFIX}${route}${CLICK_SUFFIX}`;
  const visibleMark = `${CLICK_MARK_PREFIX}${route}${VISIBLE_SUFFIX}`;

  if (performance.getEntriesByName(clickMark, "mark").length === 0) return;

  try {
    const measure = performance.measure(visibleMark, clickMark);
    console.log(`[perf] nav:${route} click-to-visible ${measure.duration.toFixed(1)}ms`);
  } finally {
    performance.clearMarks(clickMark);
    performance.clearMeasures(visibleMark);
  }
}
