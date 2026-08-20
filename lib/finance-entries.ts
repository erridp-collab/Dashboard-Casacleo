import { monthKey } from "@/lib/format";

/**
 * L'incasso di una prenotazione appartiene interamente al mese del check-in,
 * anche se il soggiorno si estende nel mese successivo (es. 29 agosto -> 4
 * settembre: l'incasso va contato solo su agosto).
 */
export function isBookingRevenueInSelectedMonth(checkIn: Date, selectedMonthDate: Date): boolean {
  return monthKey(checkIn) === monthKey(selectedMonthDate);
}
