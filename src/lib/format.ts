/**
 * Shared formatters and chart palette used across dashboard pages.
 */

export function formatCurrency(amount: number): string {
  return "$" + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCurrencyDetail(amount: number): string {
  return "$" + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`;
}

// Dashboard palette — purple/orange/red, matching the redesigned dashboard.
export const PALETTE = {
  purple: "#7c3aed",
  purpleLight: "#a855f7",
  purpleSoft: "#c4b5fd",
  orange: "#f97316",
  orangeDeep: "#ea580c",
  red: "#ef4444",
  yellow: "#fbbf24",
  teal: "#14b8a6",
  emerald: "#10b981",
  blue: "#3b82f6",
  gray: "#9ca3af",
  grayDark: "#4b5563",
} as const;

// Default categorical palette for charts (cycles through these colors).
export const CATEGORICAL_COLORS = [
  PALETTE.purple,
  PALETTE.purpleLight,
  PALETTE.orange,
  PALETTE.yellow,
  PALETTE.teal,
  PALETTE.red,
  PALETTE.emerald,
  PALETTE.blue,
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * Maps the long, official institution name from Plaid (e.g. "American Express",
 * "Bank of America") to a short, dashboard-friendly label. Falls back to the
 * original name if no mapping is defined.
 */
const INSTITUTION_SHORT_NAMES: Record<string, string> = {
  "American Express": "Amex",
  "Amex": "Amex",
  "Bank of America": "BofA",
  "Bank Of America": "BofA",
  "Citibank": "Citi",
  "Citi": "Citi",
  "JPMorgan Chase": "Chase",
  "JP Morgan Chase": "Chase",
  "Chase": "Chase",
  "Wells Fargo": "Wells Fargo",
  "Capital One": "Capital One",
  "Discover": "Discover",
};

export function shortInstitution(name: string | null | undefined, fallback = "Account"): string {
  if (!name) return fallback;
  return INSTITUTION_SHORT_NAMES[name] ?? name;
}
