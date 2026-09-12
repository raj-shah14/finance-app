/**
 * Category names that represent internal money movement, not real
 * spending — credit card payments, account-to-account transfers, ATM
 * withdrawals. Excluded from spending totals so paying off a credit card
 * doesn't also show up as spend.
 */
export const TRANSFER_CATEGORIES = ["Transfers"];

/**
 * Category names that represent real money coming in — paychecks and
 * contributions into savings/investment accounts. Used both to compute
 * total income and (via EXCLUDED_FROM_SPENDING below) to keep deposits
 * out of spending totals.
 */
export const INCOME_CATEGORIES = ["Income", "Savings & Investments"];

/**
 * Categories excluded from spending totals/heatmaps — transfers and
 * income combined, so credit-card payments, salary deposits, and
 * internal transfers do not double-count or skew expense charts.
 *
 * Every name here must correspond to an actual entry in
 * DEFAULT_CATEGORIES (or one a user creates) — a name that never gets
 * assigned to a real transaction silently does nothing. Add a category
 * to TRANSFER_CATEGORIES or INCOME_CATEGORIES above instead of pushing
 * a name onto this list directly, so every consumer (spend totals,
 * income totals, the Transactions summary) stays in sync automatically
 * rather than needing its own hand-copied list.
 */
export const EXCLUDED_FROM_SPENDING = [...TRANSFER_CATEGORIES, ...INCOME_CATEGORIES];

// Colors are a muted jewel-tone set rather than bright web-safe hues, kept
// in sync by name with PALETTE in lib/format.ts. Changing these alone only
// affects newly-created categories — prisma/seed.ts's upsert re-applies
// them to existing default-category rows on the next `npx tsx prisma/seed.ts`
// run (which the deploy pipeline already does on every push).
export const DEFAULT_CATEGORIES = [
  { name: "Housing", emoji: "🏠", color: "#5C6AC4", sortOrder: 1 },
  { name: "Groceries", emoji: "🛒", color: "#3F9C6D", sortOrder: 2 },
  { name: "Dining Out", emoji: "🍽️", color: "#D97747", sortOrder: 3 },
  { name: "Gas & Transport", emoji: "⛽", color: "#C99A3D", sortOrder: 4 },
  { name: "Utilities", emoji: "💡", color: "#3F9C9C", sortOrder: 5 },
  { name: "Entertainment", emoji: "🎮", color: "#8B5FBF", sortOrder: 6 },
  { name: "Healthcare", emoji: "🏥", color: "#C15C5C", sortOrder: 7 },
  { name: "Shopping", emoji: "🛍️", color: "#C15C8C", sortOrder: 8 },
  { name: "Education", emoji: "📚", color: "#4C8FA6", sortOrder: 9 },
  { name: "Travel", emoji: "✈️", color: "#4F7CAC", sortOrder: 10 },
  { name: "Savings & Investments", emoji: "💰", color: "#2E8B57", sortOrder: 11 },
  { name: "Subscriptions", emoji: "📦", color: "#7B68B5", sortOrder: 12 },
  { name: "Pets", emoji: "🐾", color: "#B8895A", sortOrder: 13 },
  { name: "Gifts", emoji: "🎁", color: "#C1487E", sortOrder: 14 },
  { name: "Transfers", emoji: "🔁", color: "#6B7280", sortOrder: 15 },
  { name: "Income", emoji: "💵", color: "#3FA34D", sortOrder: 16 },
  { name: "Uncategorized", emoji: "❓", color: "#9ca3af", sortOrder: 99 },
] as const;

// Maps Plaid personal_finance_category.detailed to our category names
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  RENT_AND_UTILITIES_RENT: "Housing",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities",
  RENT_AND_UTILITIES_WATER: "Utilities",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities",
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Dining Out",
  FOOD_AND_DRINK_FAST_FOOD: "Dining Out",
  FOOD_AND_DRINK_COFFEE: "Dining Out",
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "Dining Out",
  TRANSPORTATION_GAS: "Gas & Transport",
  TRANSPORTATION_PARKING: "Gas & Transport",
  TRANSPORTATION_PUBLIC_TRANSIT: "Gas & Transport",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Gas & Transport",
  TRANSPORTATION_TOLLS: "Gas & Transport",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Entertainment",
  ENTERTAINMENT_SPORTING_EVENTS: "Entertainment",
  ENTERTAINMENT_TV_AND_MOVIES: "Entertainment",
  ENTERTAINMENT_VIDEO_GAMES: "Entertainment",
  MEDICAL_DOCTOR: "Healthcare",
  MEDICAL_DENTIST: "Healthcare",
  MEDICAL_EYE_CARE: "Healthcare",
  MEDICAL_PHARMACY: "Healthcare",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "Shopping",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "Shopping",
  GENERAL_MERCHANDISE_ELECTRONICS: "Shopping",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "Shopping",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Healthcare",
  TRAVEL_FLIGHTS: "Travel",
  TRAVEL_LODGING: "Travel",
  TRAVEL_RENTAL_CARS: "Travel",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Housing",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "Savings & Investments",
  // Generic internal transfers — not real spending or income, excluded
  // from totals via EXCLUDED_FROM_SPENDING.
  TRANSFER_IN_ACCOUNT_TRANSFER: "Transfers",
  TRANSFER_IN_DEPOSIT: "Transfers",
  TRANSFER_IN_SAVINGS: "Transfers",
  TRANSFER_IN_OTHER_TRANSFER_IN: "Transfers",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "Transfers",
  TRANSFER_OUT_WITHDRAWAL: "Transfers",
  TRANSFER_OUT_SAVINGS: "Transfers",
  TRANSFER_OUT_OTHER_TRANSFER_OUT: "Transfers",
  // A credit card payment is money moving between your own accounts, same
  // as any other transfer — not spending, and not income either.
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Transfers",
  BANK_FEES_OVERDRAFT_FEES: "Utilities",
  GENERAL_SERVICES_INSURANCE: "Utilities",
  GENERAL_SERVICES_PET_CARE: "Pets",
  GENERAL_SERVICES_EDUCATION: "Education",
  // Real income — previously unmapped, so paychecks fell through to
  // "Uncategorized" and were never counted toward totalIncome (and could
  // even reduce reported spending, since Uncategorized rows aren't
  // excluded from spend totals).
  INCOME_WAGES: "Income",
  INCOME_DIVIDENDS: "Income",
  INCOME_INTEREST_EARNED: "Income",
  INCOME_RETIREMENT_PENSION: "Income",
  INCOME_UNEMPLOYMENT: "Income",
  INCOME_TAX_REFUND: "Income",
  INCOME_OTHER_INCOME: "Income",
};
