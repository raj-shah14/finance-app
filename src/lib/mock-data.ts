// Mock data for running the app without a real database or API keys

// ─── Categories ───────────────────────────────────────────────────────────────

export const mockCategoriesData = [
  { id: "cat_housing_01", name: "Housing", emoji: "🏠", color: "#6366f1", isDefault: true, sortOrder: 1 },
  { id: "cat_groceries_02", name: "Groceries", emoji: "🛒", color: "#22c55e", isDefault: true, sortOrder: 2 },
  { id: "cat_dining_03", name: "Dining Out", emoji: "🍕", color: "#f97316", isDefault: true, sortOrder: 3 },
  { id: "cat_gas_04", name: "Gas & Transport", emoji: "⛽", color: "#eab308", isDefault: true, sortOrder: 4 },
  { id: "cat_utilities_05", name: "Utilities", emoji: "💡", color: "#06b6d4", isDefault: true, sortOrder: 5 },
  { id: "cat_entertainment_06", name: "Entertainment", emoji: "🎮", color: "#a855f7", isDefault: true, sortOrder: 6 },
  { id: "cat_healthcare_07", name: "Healthcare", emoji: "🏥", color: "#ef4444", isDefault: true, sortOrder: 7 },
  { id: "cat_shopping_08", name: "Shopping", emoji: "👗", color: "#ec4899", isDefault: true, sortOrder: 8 },
  { id: "cat_education_09", name: "Education", emoji: "📚", color: "#14b8a6", isDefault: true, sortOrder: 9 },
  { id: "cat_travel_10", name: "Travel", emoji: "✈️", color: "#3b82f6", isDefault: true, sortOrder: 10 },
  { id: "cat_savings_11", name: "Savings & Investments", emoji: "💰", color: "#10b981", isDefault: true, sortOrder: 11 },
  { id: "cat_subscriptions_12", name: "Subscriptions", emoji: "📦", color: "#8b5cf6", isDefault: true, sortOrder: 12 },
  { id: "cat_pets_13", name: "Pets", emoji: "🐾", color: "#d97706", isDefault: true, sortOrder: 13 },
  { id: "cat_gifts_14", name: "Gifts", emoji: "🎁", color: "#f43f5e", isDefault: true, sortOrder: 14 },
  { id: "cat_uncategorized_15", name: "Uncategorized", emoji: "❓", color: "#9ca3af", isDefault: true, sortOrder: 99 },
];

const catById = Object.fromEntries(mockCategoriesData.map((c) => [c.id, c]));

// ─── Insights ─────────────────────────────────────────────────────────────────

const budgetInsights = [
  { categoryName: "Housing", emoji: "🏠", limit: 2200, spent: 2100, percentage: 95, status: "good" },
  { categoryName: "Groceries", emoji: "🛒", limit: 900, spent: 890, percentage: 99, status: "warning" },
  { categoryName: "Dining Out", emoji: "🍕", limit: 500, spent: 645, percentage: 129, status: "over" },
  { categoryName: "Gas & Transport", emoji: "⛽", limit: 400, spent: 380, percentage: 95, status: "good" },
  { categoryName: "Utilities", emoji: "💡", limit: 350, spent: 320, percentage: 91, status: "warning" },
  { categoryName: "Entertainment", emoji: "🎮", limit: 300, spent: 275, percentage: 92, status: "warning" },
  { categoryName: "Shopping", emoji: "👗", limit: 600, spent: 520, percentage: 87, status: "warning" },
  { categoryName: "Subscriptions", emoji: "📦", limit: 200, spent: 165, percentage: 83, status: "warning" },
];

const topCategories = [
  {
    categoryId: "cat_housing_01", categoryName: "Housing", emoji: "🏠", color: "#6366f1",
    amount: 2100, previousAmount: 2100, changePercent: 0, transactionCount: 2,
  },
  {
    categoryId: "cat_groceries_02", categoryName: "Groceries", emoji: "🛒", color: "#22c55e",
    amount: 890, previousAmount: 820, changePercent: 9, transactionCount: 8,
  },
  {
    categoryId: "cat_dining_03", categoryName: "Dining Out", emoji: "🍕", color: "#f97316",
    amount: 645, previousAmount: 580, changePercent: 11, transactionCount: 7,
  },
  {
    categoryId: "cat_gas_04", categoryName: "Gas & Transport", emoji: "⛽", color: "#eab308",
    amount: 380, previousAmount: 410, changePercent: -7, transactionCount: 5,
  },
  {
    categoryId: "cat_utilities_05", categoryName: "Utilities", emoji: "💡", color: "#06b6d4",
    amount: 320, previousAmount: 340, changePercent: -6, transactionCount: 3,
  },
];

const allCategories = [
  ...topCategories,
  {
    categoryId: "cat_entertainment_06", categoryName: "Entertainment", emoji: "🎮", color: "#a855f7",
    amount: 275, previousAmount: 310, changePercent: -11, transactionCount: 3,
  },
  {
    categoryId: "cat_shopping_08", categoryName: "Shopping", emoji: "👗", color: "#ec4899",
    amount: 520, previousAmount: 600, changePercent: -13, transactionCount: 4,
  },
  {
    categoryId: "cat_subscriptions_12", categoryName: "Subscriptions", emoji: "📦", color: "#8b5cf6",
    amount: 165, previousAmount: 165, changePercent: 0, transactionCount: 4,
  },
  {
    categoryId: "cat_healthcare_07", categoryName: "Healthcare", emoji: "🏥", color: "#ef4444",
    amount: 245, previousAmount: 180, changePercent: 36, transactionCount: 2,
  },
  {
    categoryId: "cat_pets_13", categoryName: "Pets", emoji: "🐾", color: "#d97706",
    amount: 87, previousAmount: 95, changePercent: -8, transactionCount: 1,
  },
  {
    categoryId: "cat_gifts_14", categoryName: "Gifts", emoji: "🎁", color: "#f43f5e",
    amount: 120, previousAmount: 0, changePercent: 0, transactionCount: 1,
  },
  {
    categoryId: "cat_savings_11", categoryName: "Savings & Investments", emoji: "💰", color: "#10b981",
    amount: 500, previousAmount: 500, changePercent: 0, transactionCount: 1,
  },
  {
    categoryId: "cat_education_09", categoryName: "Education", emoji: "📚", color: "#14b8a6",
    amount: 0, previousAmount: 0, changePercent: 0, transactionCount: 0,
  },
  {
    categoryId: "cat_travel_10", categoryName: "Travel", emoji: "✈️", color: "#3b82f6",
    amount: 0, previousAmount: 350, changePercent: -100, transactionCount: 0,
  },
  {
    categoryId: "cat_uncategorized_15", categoryName: "Uncategorized", emoji: "❓", color: "#9ca3af",
    amount: 0, previousAmount: 0, changePercent: 0, transactionCount: 0,
  },
];

const dailySpending = [
  { date: "2026-02-01T00:00:00.000Z", amount: 245 },
  { date: "2026-02-02T00:00:00.000Z", amount: 132 },
  { date: "2026-02-03T00:00:00.000Z", amount: 89 },
  { date: "2026-02-04T00:00:00.000Z", amount: 312 },
  { date: "2026-02-05T00:00:00.000Z", amount: 178 },
  { date: "2026-02-06T00:00:00.000Z", amount: 95 },
  { date: "2026-02-07T00:00:00.000Z", amount: 425 },
  { date: "2026-02-08T00:00:00.000Z", amount: 203 },
  { date: "2026-02-09T00:00:00.000Z", amount: 156 },
  { date: "2026-02-10T00:00:00.000Z", amount: 287 },
  { date: "2026-02-11T00:00:00.000Z", amount: 142 },
  { date: "2026-02-12T00:00:00.000Z", amount: 198 },
  { date: "2026-02-13T00:00:00.000Z", amount: 345 },
  { date: "2026-02-14T00:00:00.000Z", amount: 450 },
  { date: "2026-02-15T00:00:00.000Z", amount: 167 },
  { date: "2026-02-16T00:00:00.000Z", amount: 234 },
  { date: "2026-02-17T00:00:00.000Z", amount: 89 },
  { date: "2026-02-18T00:00:00.000Z", amount: 378 },
  { date: "2026-02-19T00:00:00.000Z", amount: 112 },
  { date: "2026-02-20T00:00:00.000Z", amount: 265 },
  { date: "2026-02-21T00:00:00.000Z", amount: 189 },
  { date: "2026-02-22T00:00:00.000Z", amount: 143 },
  { date: "2026-02-23T00:00:00.000Z", amount: 298 },
  { date: "2026-02-24T00:00:00.000Z", amount: 187 },
  { date: "2026-02-25T00:00:00.000Z", amount: 356 },
  { date: "2026-02-26T00:00:00.000Z", amount: 124 },
  { date: "2026-02-27T00:00:00.000Z", amount: 215 },
  { date: "2026-02-28T00:00:00.000Z", amount: 80 },
];

export const mockInsightsData = {
  month: 2,
  year: 2026,
  totalSpending: 6847,
  totalIncome: 12500,
  netSavings: 5653,
  totalChangePercent: -8,
  topCategories,
  allCategories,
  budgetInsights,
  dailySpending,
  perPerson: [
    { userId: "1", name: "Raj", amount: 3920 },
    { userId: "2", name: "Hemisha", amount: 2927 },
  ],
  highlights: {
    wellDone: budgetInsights.filter((b) => b.status === "good"),
    watchOut: budgetInsights.filter((b) => b.status === "over"),
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────

const raj = { firstName: "Raj", lastName: "Shah" };
const hemisha = { firstName: "Hemisha", lastName: "Shah" };

const chaseChecking = { name: "Chase Checking", mask: "4521", type: "depository" };
const chaseSapphire = { name: "Chase Sapphire Reserve", mask: "9876", type: "credit" };
const discoverIt = { name: "Discover It", mask: "3344", type: "credit" };
const wellsFargo = { name: "Wells Fargo Checking", mask: "5566", type: "depository" };
const amexGold = { name: "Amex Gold", mask: "7788", type: "credit" };

export const mockTransactionsData = {
  transactions: [
    {
      id: "txn_01", plaidTransactionId: "plaid_txn_01", accountId: "acct_02", userId: "1", householdId: "hh_01",
      categoryId: "cat_housing_01", amount: 1800, date: "2026-02-01T00:00:00.000Z",
      name: "Apartment Rent Payment", merchantName: "Avalon Apartments", pending: false,
      category: catById["cat_housing_01"], account: chaseSapphire, user: raj,
    },
    {
      id: "txn_02", plaidTransactionId: "plaid_txn_02", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_housing_01", amount: 300, date: "2026-02-01T00:00:00.000Z",
      name: "Renters Insurance", merchantName: "Lemonade", pending: false,
      category: catById["cat_housing_01"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_03", plaidTransactionId: "plaid_txn_03", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_groceries_02", amount: 142.35, date: "2026-02-02T00:00:00.000Z",
      name: "Whole Foods Market", merchantName: "Whole Foods", pending: false,
      category: catById["cat_groceries_02"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_04", plaidTransactionId: "plaid_txn_04", accountId: "acct_04", userId: "2", householdId: "hh_01",
      categoryId: "cat_groceries_02", amount: 98.47, date: "2026-02-04T00:00:00.000Z",
      name: "Trader Joe's", merchantName: "Trader Joe's", pending: false,
      category: catById["cat_groceries_02"], account: discoverIt, user: hemisha,
    },
    {
      id: "txn_05", plaidTransactionId: "plaid_txn_05", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: "cat_groceries_02", amount: 67.82, date: "2026-02-07T00:00:00.000Z",
      name: "Costco Wholesale", merchantName: "Costco", pending: false,
      category: catById["cat_groceries_02"], account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_06", plaidTransactionId: "plaid_txn_06", accountId: "acct_06", userId: "1", householdId: "hh_01",
      categoryId: "cat_dining_03", amount: 85.20, date: "2026-02-03T00:00:00.000Z",
      name: "Nobu Restaurant", merchantName: "Nobu", pending: false,
      category: catById["cat_dining_03"], account: amexGold, user: raj,
    },
    {
      id: "txn_07", plaidTransactionId: "plaid_txn_07", accountId: "acct_04", userId: "2", householdId: "hh_01",
      categoryId: "cat_dining_03", amount: 42.50, date: "2026-02-05T00:00:00.000Z",
      name: "Starbucks", merchantName: "Starbucks", pending: false,
      category: catById["cat_dining_03"], account: discoverIt, user: hemisha,
    },
    {
      id: "txn_08", plaidTransactionId: "plaid_txn_08", accountId: "acct_02", userId: "1", householdId: "hh_01",
      categoryId: "cat_dining_03", amount: 128.90, date: "2026-02-08T00:00:00.000Z",
      name: "Uber Eats", merchantName: "Uber Eats", pending: false,
      category: catById["cat_dining_03"], account: chaseSapphire, user: raj,
    },
    {
      id: "txn_09", plaidTransactionId: "plaid_txn_09", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: "cat_dining_03", amount: 35.75, date: "2026-02-10T00:00:00.000Z",
      name: "Chipotle Mexican Grill", merchantName: "Chipotle", pending: false,
      category: catById["cat_dining_03"], account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_10", plaidTransactionId: "plaid_txn_10", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_gas_04", amount: 58.40, date: "2026-02-03T00:00:00.000Z",
      name: "Shell Gas Station", merchantName: "Shell", pending: false,
      category: catById["cat_gas_04"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_11", plaidTransactionId: "plaid_txn_11", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: "cat_gas_04", amount: 52.15, date: "2026-02-09T00:00:00.000Z",
      name: "Chevron", merchantName: "Chevron", pending: false,
      category: catById["cat_gas_04"], account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_12", plaidTransactionId: "plaid_txn_12", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_gas_04", amount: 145.00, date: "2026-02-14T00:00:00.000Z",
      name: "Uber", merchantName: "Uber", pending: false,
      category: catById["cat_gas_04"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_13", plaidTransactionId: "plaid_txn_13", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_utilities_05", amount: 135.20, date: "2026-02-05T00:00:00.000Z",
      name: "PG&E", merchantName: "PG&E", pending: false,
      category: catById["cat_utilities_05"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_14", plaidTransactionId: "plaid_txn_14", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_utilities_05", amount: 89.99, date: "2026-02-06T00:00:00.000Z",
      name: "Xfinity Internet", merchantName: "Xfinity", pending: false,
      category: catById["cat_utilities_05"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_15", plaidTransactionId: "plaid_txn_15", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: "cat_utilities_05", amount: 94.81, date: "2026-02-06T00:00:00.000Z",
      name: "AT&T Wireless", merchantName: "AT&T", pending: false,
      category: catById["cat_utilities_05"], account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_16", plaidTransactionId: "plaid_txn_16", accountId: "acct_02", userId: "1", householdId: "hh_01",
      categoryId: "cat_entertainment_06", amount: 75.00, date: "2026-02-07T00:00:00.000Z",
      name: "AMC Theatres", merchantName: "AMC Theatres", pending: false,
      category: catById["cat_entertainment_06"], account: chaseSapphire, user: raj,
    },
    {
      id: "txn_17", plaidTransactionId: "plaid_txn_17", accountId: "acct_04", userId: "2", householdId: "hh_01",
      categoryId: "cat_entertainment_06", amount: 120.00, date: "2026-02-13T00:00:00.000Z",
      name: "Ticketmaster", merchantName: "Ticketmaster", pending: false,
      category: catById["cat_entertainment_06"], account: discoverIt, user: hemisha,
    },
    {
      id: "txn_18", plaidTransactionId: "plaid_txn_18", accountId: "acct_06", userId: "1", householdId: "hh_01",
      categoryId: "cat_shopping_08", amount: 234.56, date: "2026-02-10T00:00:00.000Z",
      name: "Amazon.com", merchantName: "Amazon", pending: false,
      category: catById["cat_shopping_08"], account: amexGold, user: raj,
    },
    {
      id: "txn_19", plaidTransactionId: "plaid_txn_19", accountId: "acct_04", userId: "2", householdId: "hh_01",
      categoryId: "cat_shopping_08", amount: 89.99, date: "2026-02-12T00:00:00.000Z",
      name: "Target", merchantName: "Target", pending: false,
      category: catById["cat_shopping_08"], account: discoverIt, user: hemisha,
    },
    {
      id: "txn_20", plaidTransactionId: "plaid_txn_20", accountId: "acct_02", userId: "1", householdId: "hh_01",
      categoryId: "cat_shopping_08", amount: 195.45, date: "2026-02-18T00:00:00.000Z",
      name: "Nordstrom", merchantName: "Nordstrom", pending: false,
      category: catById["cat_shopping_08"], account: chaseSapphire, user: raj,
    },
    {
      id: "txn_21", plaidTransactionId: "plaid_txn_21", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_subscriptions_12", amount: 15.99, date: "2026-02-01T00:00:00.000Z",
      name: "Netflix", merchantName: "Netflix", pending: false,
      category: catById["cat_subscriptions_12"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_22", plaidTransactionId: "plaid_txn_22", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_subscriptions_12", amount: 14.99, date: "2026-02-01T00:00:00.000Z",
      name: "Spotify Premium", merchantName: "Spotify", pending: false,
      category: catById["cat_subscriptions_12"], account: chaseChecking, user: raj,
    },
    {
      id: "txn_23", plaidTransactionId: "plaid_txn_23", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: "cat_subscriptions_12", amount: 22.99, date: "2026-02-01T00:00:00.000Z",
      name: "YouTube Premium Family", merchantName: "Google", pending: false,
      category: catById["cat_subscriptions_12"], account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_24", plaidTransactionId: "plaid_txn_24", accountId: "acct_02", userId: "1", householdId: "hh_01",
      categoryId: "cat_healthcare_07", amount: 245.00, date: "2026-02-15T00:00:00.000Z",
      name: "Kaiser Permanente", merchantName: "Kaiser Permanente", pending: false,
      category: catById["cat_healthcare_07"], account: chaseSapphire, user: raj,
    },
    {
      id: "txn_25", plaidTransactionId: "plaid_txn_25", accountId: "acct_04", userId: "2", householdId: "hh_01",
      categoryId: "cat_pets_13", amount: 87.00, date: "2026-02-11T00:00:00.000Z",
      name: "PetSmart", merchantName: "PetSmart", pending: false,
      category: catById["cat_pets_13"], account: discoverIt, user: hemisha,
    },
    {
      id: "txn_26", plaidTransactionId: "plaid_txn_26", accountId: "acct_06", userId: "1", householdId: "hh_01",
      categoryId: "cat_gifts_14", amount: 120.00, date: "2026-02-14T00:00:00.000Z",
      name: "1-800-Flowers", merchantName: "1-800-Flowers", pending: false,
      category: catById["cat_gifts_14"], account: amexGold, user: raj,
    },
    {
      id: "txn_27", plaidTransactionId: "plaid_txn_27", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_savings_11", amount: 500.00, date: "2026-02-15T00:00:00.000Z",
      name: "Transfer to Savings", merchantName: null, pending: false,
      category: catById["cat_savings_11"], account: chaseChecking, user: raj,
    },
    // Income transactions (negative amounts)
    {
      id: "txn_28", plaidTransactionId: "plaid_txn_28", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: null, amount: -7500, date: "2026-02-01T00:00:00.000Z",
      name: "Payroll - TechCorp Inc", merchantName: "TechCorp Inc", pending: false,
      category: null, account: chaseChecking, user: raj,
    },
    {
      id: "txn_29", plaidTransactionId: "plaid_txn_29", accountId: "acct_05", userId: "2", householdId: "hh_01",
      categoryId: null, amount: -5000, date: "2026-02-01T00:00:00.000Z",
      name: "Payroll - DesignStudio LLC", merchantName: "DesignStudio LLC", pending: false,
      category: null, account: wellsFargo, user: hemisha,
    },
    {
      id: "txn_30", plaidTransactionId: "plaid_txn_30", accountId: "acct_01", userId: "1", householdId: "hh_01",
      categoryId: "cat_groceries_02", amount: 78.23, date: "2026-02-20T00:00:00.000Z",
      name: "Safeway", merchantName: "Safeway", pending: false,
      category: catById["cat_groceries_02"], account: chaseChecking, user: raj,
    },
  ],
  total: 187,
  page: 1,
  totalPages: 4,
};

// ─── Accounts ─────────────────────────────────────────────────────────────────

const recentSync = "2026-02-28T10:30:00.000Z";

export const mockAccountsData = {
  accounts: [
    {
      id: "acct_01", plaidAccountId: "plaid_acct_01", name: "Chase Checking",
      officialName: "Chase Total Checking", type: "depository", subtype: "checking",
      mask: "4521", currentBalance: 8234.50, availableBalance: 8234.50,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Chase", lastSyncedAt: recentSync },
      user: raj,
    },
    {
      id: "acct_02", plaidAccountId: "plaid_acct_02", name: "Chase Sapphire Reserve",
      officialName: "Chase Sapphire Reserve Visa Infinite", type: "credit", subtype: "credit card",
      mask: "9876", currentBalance: -2145.30, availableBalance: 17854.70,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Chase", lastSyncedAt: recentSync },
      user: raj,
    },
    {
      id: "acct_03", plaidAccountId: "plaid_acct_03", name: "Bank of America Savings",
      officialName: "Bank of America Advantage Savings", type: "depository", subtype: "savings",
      mask: "1122", currentBalance: 25670.00, availableBalance: 25670.00,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Bank of America", lastSyncedAt: recentSync },
      user: raj,
    },
    {
      id: "acct_04", plaidAccountId: "plaid_acct_04", name: "Discover It",
      officialName: "Discover It Cash Back", type: "credit", subtype: "credit card",
      mask: "3344", currentBalance: -876.20, availableBalance: 4123.80,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Discover", lastSyncedAt: recentSync },
      user: hemisha,
    },
    {
      id: "acct_05", plaidAccountId: "plaid_acct_05", name: "Wells Fargo Checking",
      officialName: "Wells Fargo Everyday Checking", type: "depository", subtype: "checking",
      mask: "5566", currentBalance: 3456.78, availableBalance: 3456.78,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Wells Fargo", lastSyncedAt: recentSync },
      user: hemisha,
    },
    {
      id: "acct_06", plaidAccountId: "plaid_acct_06", name: "Amex Gold",
      officialName: "American Express Gold Card", type: "credit", subtype: "credit card",
      mask: "7788", currentBalance: -1234.00, availableBalance: 8766.00,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "American Express", lastSyncedAt: recentSync },
      user: raj,
    },
    {
      id: "acct_07", plaidAccountId: "plaid_acct_07", name: "Capital One 360 Savings",
      officialName: "Capital One 360 Performance Savings", type: "depository", subtype: "savings",
      mask: "9900", currentBalance: 15000.00, availableBalance: 15000.00,
      isoCurrencyCode: "USD",
      plaidItem: { institutionName: "Capital One", lastSyncedAt: recentSync },
      user: hemisha,
    },
  ],
};

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const mockBudgetsData = {
  budgets: [
    {
      id: "bgt_01", categoryId: "cat_housing_01", householdId: "hh_01",
      monthlyLimit: 2200, month: 2, year: 2026, spent: 2100, percentage: 95,
      category: { id: "cat_housing_01", name: "Housing", emoji: "🏠", color: "#6366f1", sortOrder: 1 },
    },
    {
      id: "bgt_02", categoryId: "cat_groceries_02", householdId: "hh_01",
      monthlyLimit: 900, month: 2, year: 2026, spent: 890, percentage: 99,
      category: { id: "cat_groceries_02", name: "Groceries", emoji: "🛒", color: "#22c55e", sortOrder: 2 },
    },
    {
      id: "bgt_03", categoryId: "cat_dining_03", householdId: "hh_01",
      monthlyLimit: 500, month: 2, year: 2026, spent: 645, percentage: 129,
      category: { id: "cat_dining_03", name: "Dining Out", emoji: "🍕", color: "#f97316", sortOrder: 3 },
    },
    {
      id: "bgt_04", categoryId: "cat_gas_04", householdId: "hh_01",
      monthlyLimit: 400, month: 2, year: 2026, spent: 380, percentage: 95,
      category: { id: "cat_gas_04", name: "Gas & Transport", emoji: "⛽", color: "#eab308", sortOrder: 4 },
    },
    {
      id: "bgt_05", categoryId: "cat_utilities_05", householdId: "hh_01",
      monthlyLimit: 350, month: 2, year: 2026, spent: 320, percentage: 91,
      category: { id: "cat_utilities_05", name: "Utilities", emoji: "💡", color: "#06b6d4", sortOrder: 5 },
    },
    {
      id: "bgt_06", categoryId: "cat_entertainment_06", householdId: "hh_01",
      monthlyLimit: 300, month: 2, year: 2026, spent: 275, percentage: 92,
      category: { id: "cat_entertainment_06", name: "Entertainment", emoji: "🎮", color: "#a855f7", sortOrder: 6 },
    },
    {
      id: "bgt_07", categoryId: "cat_shopping_08", householdId: "hh_01",
      monthlyLimit: 600, month: 2, year: 2026, spent: 520, percentage: 87,
      category: { id: "cat_shopping_08", name: "Shopping", emoji: "👗", color: "#ec4899", sortOrder: 8 },
    },
    {
      id: "bgt_08", categoryId: "cat_subscriptions_12", householdId: "hh_01",
      monthlyLimit: 200, month: 2, year: 2026, spent: 165, percentage: 83,
      category: { id: "cat_subscriptions_12", name: "Subscriptions", emoji: "📦", color: "#8b5cf6", sortOrder: 12 },
    },
  ],
  month: 2,
  year: 2026,
};

// ─── Sharing Preferences ─────────────────────────────────────────────────────

export let mockSharingPreferences = [
  { categoryId: "cat_housing_01", categoryName: "Housing", emoji: "🏠", sharedWithHousehold: true },
  { categoryId: "cat_groceries_02", categoryName: "Groceries", emoji: "🛒", sharedWithHousehold: true },
  { categoryId: "cat_dining_03", categoryName: "Dining Out", emoji: "🍕", sharedWithHousehold: true },
  { categoryId: "cat_gas_04", categoryName: "Gas & Transport", emoji: "⛽", sharedWithHousehold: true },
  { categoryId: "cat_utilities_05", categoryName: "Utilities", emoji: "💡", sharedWithHousehold: true },
  { categoryId: "cat_entertainment_06", categoryName: "Entertainment", emoji: "🎮", sharedWithHousehold: false },
  { categoryId: "cat_healthcare_07", categoryName: "Healthcare", emoji: "🏥", sharedWithHousehold: true },
  { categoryId: "cat_shopping_08", categoryName: "Shopping", emoji: "👗", sharedWithHousehold: false },
  { categoryId: "cat_education_09", categoryName: "Education", emoji: "📚", sharedWithHousehold: true },
  { categoryId: "cat_travel_10", categoryName: "Travel", emoji: "✈️", sharedWithHousehold: true },
  { categoryId: "cat_savings_11", categoryName: "Savings & Investments", emoji: "💰", sharedWithHousehold: false },
  { categoryId: "cat_subscriptions_12", categoryName: "Subscriptions", emoji: "📦", sharedWithHousehold: false },
  { categoryId: "cat_pets_13", categoryName: "Pets", emoji: "🐾", sharedWithHousehold: true },
  { categoryId: "cat_gifts_14", categoryName: "Gifts", emoji: "🎁", sharedWithHousehold: true },
  { categoryId: "cat_uncategorized_15", categoryName: "Uncategorized", emoji: "❓", sharedWithHousehold: false },
];

export const mockInvitesData = {
  invites: [
    {
      id: "inv_01",
      email: "hemisha@example.com",
      status: "accepted",
      createdAt: "2026-01-15T00:00:00.000Z",
      invitedBy: { firstName: "Raj", lastName: "Shah" },
    },
  ],
};

// ─── Household ────────────────────────────────────────────────────────────────

export interface MockHouseholdMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface MockHousehold {
  id: string;
  name: string;
  createdAt: string;
  members: MockHouseholdMember[];
}

export let mockHouseholdData: MockHousehold | null = {
  id: "hh_01",
  name: "Shah Family",
  createdAt: "2026-01-01T00:00:00.000Z",
  members: [
    { id: "1", name: "Raj Shah", email: "raj@example.com", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" },
    { id: "2", name: "Hemisha Shah", email: "hemisha@example.com", role: "member", joinedAt: "2026-01-15T00:00:00.000Z" },
  ],
};

export function setMockHouseholdData(data: MockHousehold | null) {
  mockHouseholdData = data;
}
