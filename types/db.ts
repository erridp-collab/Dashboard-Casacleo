export type ActionStatus = "DA_FARE" | "FATTO";

export interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  channel: string | null;
  notes: string | null;
  total_amount?: number | null;
  created_at?: string;
}

export interface Action {
  id: string;
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
  action_id: string;
  label: string;
  done: boolean;
  sort_order: number | null;
  created_at?: string;
}

export interface Product {
  id: string;
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
