import type { Action } from "@/types/db";

export type DashboardActionMetrics = {
  todayActions: Action[];
  openToday: number;
  overdueOpen: Action[];
};

export function computeDashboardActionMetrics(actions: Action[], todayIso: string): DashboardActionMetrics {
  const todayActions = actions.filter((a) => a.action_date === todayIso);
  const openToday = todayActions.filter((a) => a.status === "DA_FARE").length;
  const overdueOpen = actions.filter((a) => a.status === "DA_FARE" && a.action_date < todayIso);
  return { todayActions, openToday, overdueOpen };
}
