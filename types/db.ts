export type ActionStatus = "DA_FARE" | "FATTO";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRole {
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "staff";
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  organization_id?: string;
  check_in: string;
  check_out: string;
  guests: number;
  channel: string | null;
  notes: string | null;
  total_amount?: number | null;
  cleaning_status?: ActionStatus | null;
  created_at?: string;
}

export interface Action {
  id: string;
  organization_id?: string;
  booking_id: string | null;
  action_date: string;
  action_type: string;
  status: ActionStatus;
  details: string | null;
  amount: number | null;
  created_at?: string;
}

export interface ActionChecklistItem {
  id: string;
  organization_id?: string;
  action_id: string;
  label: string;
  done: boolean;
  sort_order: number | null;
  created_at?: string;
}

export interface Product {
  id: string;
  organization_id?: string;
  name: string;
  category?: string | null;
  quantity: number;
  threshold: number;
  max_qty?: number | null;
  consumption_per_checkout?: number | null;
  unit: string | null;
  updated_at?: string;
}

export interface Expense {
  id: string;
  organization_id?: string;
  expense_date: string;
  amount: number;
  category: string | null;
  notes: string | null;
  created_at?: string;
}

export interface MonthlyFinancePoint {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  occupancyRate: number;
}
