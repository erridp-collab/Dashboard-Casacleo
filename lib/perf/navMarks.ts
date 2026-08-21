const CLICK_MARK_PREFIX = "nav:";
const CLICK_SUFFIX = ":click";
const VISIBLE_SUFFIX = ":visible";
export const NAVIGATION_ID_HEADER = "x-alva-navigation-id";
export const NAVIGATION_START_EVENT = "alva:navigation-start";
export const NAVIGATION_END_EVENT = "alva:navigation-end";

type ActiveNavigation = {
  id: string;
  route: string;
};

let activeNavigation: ActiveNavigation | null = null;
const scheduledPaints = new Set<string>();

function clickMark(route: string): string {
  return `${CLICK_MARK_PREFIX}${route}${CLICK_SUFFIX}`;
}

function visibleMark(route: string): string {
  return `${CLICK_MARK_PREFIX}${route}${VISIBLE_SUFFIX}`;
}

export function activeNavigationId(): string | null {
  return activeNavigation?.id ?? null;
}

function emitNavigationEvent(name: string, navigation: ActiveNavigation): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail: navigation }));
}

/** Called on nav-link click. Marks the start of a "how long until data is on screen" window. */
export function markNavClick(route: string): void {
  if (typeof performance === "undefined" || typeof crypto === "undefined") return;

  if (activeNavigation) {
    performance.clearMarks(clickMark(activeNavigation.route));
    performance.clearMeasures(visibleMark(activeNavigation.route));
    scheduledPaints.delete(activeNavigation.id);
  }

  activeNavigation = { id: crypto.randomUUID(), route };
  performance.mark(clickMark(route));
  emitNavigationEvent(NAVIGATION_START_EVENT, activeNavigation);
}

/**
 * Called from a page's data-loaded success path (not on error, not on silent
 * background revalidation). No-ops silently if there is no pending click
 * mark for this route — e.g. a silent revalidation triggered by a filter
 * change, not a menu click — so it's safe to call unconditionally.
 */
export function markDataVisible(route: string): void {
  if (typeof performance === "undefined") return;
  const navigation = activeNavigation;
  const routeClickMark = clickMark(route);
  const routeVisibleMark = visibleMark(route);

  if (!navigation || navigation.route !== route) return;
  if (performance.getEntriesByName(routeClickMark, "mark").length === 0) return;
  if (scheduledPaints.has(navigation.id)) return;

  scheduledPaints.add(navigation.id);

  const finishMeasurement = () => {
    if (activeNavigation?.id !== navigation.id) return;

    try {
      const measure = performance.measure(routeVisibleMark, routeClickMark);
      console.log(
        `[perf] nav:${route} click-to-painted ${measure.duration.toFixed(1)}ms navId=${navigation.id}`,
      );
    } finally {
      performance.clearMarks(routeClickMark);
      performance.clearMeasures(routeVisibleMark);
      scheduledPaints.delete(navigation.id);
      activeNavigation = null;
      emitNavigationEvent(NAVIGATION_END_EVENT, navigation);
    }
  };

  // setState only schedules a React update. Two animation frames ensure the
  // committed UI has reached a paint opportunity before we stop the clock.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(finishMeasurement));
  } else {
    finishMeasurement();
  }
}
