/**
 * Categories that represent transfers or income, not real spending.
 * Excluded from spending totals/heatmaps so credit-card payments and
 * salary deposits do not double-count or skew expense charts.
 */
export const EXCLUDED_FROM_SPENDING = ["Salary", "CC Bill", "CC Payments"];

export const DEFAULT_CATEGORIES = [
  { name: "Housing", emoji: "🏠", color: "#6366f1", sortOrder: 1 },
  { name: "Groceries", emoji: "🛒", color: "#22c55e", sortOrder: 2 },
  { name: "Dining Out", emoji: "🍽️", color: "#f97316", sortOrder: 3 },
  { name: "Gas & Transport", emoji: "⛽", color: "#eab308", sortOrder: 4 },
  { name: "Utilities", emoji: "💡", color: "#06b6d4", sortOrder: 5 },
  { name: "Entertainment", emoji: "🎮", color: "#a855f7", sortOrder: 6 },
  { name: "Healthcare", emoji: "🏥", color: "#ef4444", sortOrder: 7 },
  { name: "Shopping", emoji: "🛍️", color: "#ec4899", sortOrder: 8 },
  { name: "Education", emoji: "📚", color: "#14b8a6", sortOrder: 9 },
  { name: "Travel", emoji: "✈️", color: "#3b82f6", sortOrder: 10 },
  { name: "Savings & Investments", emoji: "💰", color: "#10b981", sortOrder: 11 },
  { name: "Subscriptions", emoji: "📦", color: "#8b5cf6", sortOrder: 12 },
  { name: "Pets", emoji: "🐾", color: "#d97706", sortOrder: 13 },
  { name: "Gifts", emoji: "🎁", color: "#f43f5e", sortOrder: 14 },
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
  GENERAL_SERVICES_INSURANCE: "Utilities",
  GENERAL_SERVICES_PET_CARE: "Pets",
  GENERAL_SERVICES_EDUCATION: "Education",
};
