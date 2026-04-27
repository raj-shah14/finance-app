import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a [start, end] date range for the given month in UTC.
 *
 * Plaid stores transaction dates at UTC midnight (e.g. "2026-04-01" →
 * 2026-04-01T00:00:00Z). Building month bounds with `new Date(year, month, ...)`
 * uses the server's local timezone, which causes the next month's first day
 * to leak into the current month (or the current month's first day to be
 * dropped) when the server runs west of UTC.
 */
export function monthBoundsUTC(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}
