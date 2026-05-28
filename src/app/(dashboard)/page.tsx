"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as InfoTooltip,
  TooltipContent as InfoTooltipContent,
  TooltipProvider as InfoTooltipProvider,
  TooltipTrigger as InfoTooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { format } from "date-fns";
import { shortInstitution } from "@/lib/format";
import { InvestmentFan, DEMO_INVESTMENT_DATA } from "@/components/charts/investment-fan";
import { BudgetPlanDonut, DEMO_BUDGET_DATA, DEMO_BUDGET_TOTAL } from "@/components/charts/budget-plan-donut";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Landmark,
  CreditCard,
} from "lucide-react";

interface CategoryInsight {
  categoryId: string;
  categoryName: string;
  emoji: string;
  color: string;
  amount: number;
  previousAmount: number;
  changePercent: number;
  transactionCount: number;
}

interface BudgetInsight {
  categoryName: string;
  emoji: string;
  limit: number;
  spent: number;
  percentage: number;
  status: "good" | "warning" | "over";
}

interface InsightsData {
  month: number;
  year: number;
  totalSpending: number;
  totalIncome: number | null;
  netSavings: number | null;
  totalChangePercent: number;
  topCategories: CategoryInsight[];
  allCategories: CategoryInsight[];
  budgetInsights: BudgetInsight[];
  creditCardSpend?: number;
  prevCreditCardSpend?: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  plaidItem?: { institutionName: string | null };
}

interface Transaction {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  category?: { name: string; emoji: string; color: string } | null;
  user?: { firstName: string; lastName: string };
}

const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Dashboard palette — purple/orange/red to match reference design.
const PALETTE = {
  purple: "#7c3aed",
  purpleLight: "#a855f7",
  purpleSoft: "#c4b5fd",
  orange: "#f97316",
  orangeDeep: "#ea580c",
  red: "#ef4444",
  yellow: "#fbbf24",
  teal: "#14b8a6",
  gray: "#9ca3af",
  grayDark: "#4b5563",
};

const INVESTMENT_COLORS = [
  PALETTE.purple,
  PALETTE.purpleLight,
  PALETTE.yellow,
  PALETTE.teal,
  PALETTE.orange,
  PALETTE.red,
];

function formatCurrency(amount: number): string {
  return "$" + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatCurrencyDetail(amount: number): string {
  return "$" + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DashboardPage() {
  const now = new Date();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  // Always-household view, regardless of the user's personal/household tab
  // toggle — used by the dashboard's "Household Expenses" tile so it shows
  // the shared total even when the user is in Personal mode.
  const [householdInsights, setHouseholdInsights] = useState<InsightsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [yearlyTrend, setYearlyTrend] = useState<
    { month: string; income: number; expenses: number }[]
  >([]);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [realGoals, setRealGoals] = useState<
    Array<{
      id: string;
      name: string;
      kind: string;
      targetAmount: number;
      currentAmount: number;
      percentage: number;
      color: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [year, setYear] = useState(now.getFullYear());

  const fetchData = useCallback((mode: string, m: number, y: number) => {
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();

    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}&viewMode=${mode}`).then((r) => r.json()),
      fetch(`/api/transactions?limit=6&viewMode=${mode}&startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
      fetch(`/api/accounts`).then((r) => r.json()),
    ])
      .then(([insightsData, txData, acctData]) => {
        setInsights(insightsData.error ? null : insightsData);
        setTransactions(txData.transactions || []);
        setAccounts(acctData.accounts || []);
      })
      .catch(() => {
        setInsights(null);
        setTransactions([]);
        setAccounts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch all 12 months for the income/expense trend chart.
  const fetchYearlyTrend = useCallback((mode: string, y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}&viewMode=${mode}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((results) => {
      setYearlyTrend(
        results.map((d, i) => ({
          month: MONTH_NAMES_SHORT[i],
          income: d?.totalIncome ?? 0,
          expenses: d?.totalSpending ?? 0,
        }))
      );
    });
  }, []);

  useEffect(() => {
    fetchData(viewMode, month, year);
  }, [viewMode, month, year, fetchData]);

  // Separately fetch the always-household insights so the Household
  // Expenses tile reflects shared totals even in Personal viewMode.
  useEffect(() => {
    fetch(`/api/insights?month=${month}&year=${year}&viewMode=household`)
      .then((r) => r.json())
      .then((d) => setHouseholdInsights(d.error ? null : d))
      .catch(() => setHouseholdInsights(null));
  }, [month, year]);

  useEffect(() => {
    fetchYearlyTrend(viewMode, year);
  }, [viewMode, year, fetchYearlyTrend]);

  // Spending heatmap — pull last 12 months of expense transactions, bucket by day.
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    const EXCLUDE = ["Salary", "Income", "CC Bill", "CC Payment", "CC Payments"];

    fetch(`/api/transactions?startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=5000&viewMode=${viewMode}`)
      .then((r) => r.json())
      .then((d) => {
        const map = new Map<string, number>();
        (d.transactions ?? []).forEach((t: { amount: number; date: string; category: { name: string } | null }) => {
          if (t.amount <= 0) return;
          if (t.category && EXCLUDE.includes(t.category.name)) return;
          const key = t.date.slice(0, 10);
          map.set(key, (map.get(key) || 0) + t.amount);
        });
        setHeatmapData(map);
      })
      .catch(() => setHeatmapData(new Map()));
  }, [viewMode]);

  // Goals — fetched once on mount; refresh when the page is re-mounted.
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => setRealGoals(d.goals || []))
      .catch(() => setRealGoals([]));
  }, []);

  // Derived metrics
  const totalIncome = insights?.totalIncome ?? 0;
  const totalExpenses = insights?.totalSpending ?? 0;
  const incomeRatio =
    totalIncome + totalExpenses > 0
      ? Math.round((totalIncome / (totalIncome + totalExpenses)) * 100)
      : 0;

  // Budget aggregate
  const totalBudgetLimit = (insights?.budgetInsights ?? []).reduce(
    (s, b) => s + b.limit,
    0
  );
  const totalBudgetSpent = (insights?.budgetInsights ?? []).reduce(
    (s, b) => s + b.spent,
    0
  );
  const budgetUsedPct =
    totalBudgetLimit > 0
      ? Math.min(Math.round((totalBudgetSpent / totalBudgetLimit) * 100), 100)
      : 0;

  // Investments
  // Savings — depository accounts with subtype 'savings' (HYSA, Marcus, etc.)
  const savingsAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.type === "depository" && a.subtype === "savings"
      ),
    [accounts]
  );
  const totalSavings = savingsAccounts.reduce(
    (s, a) => s + (a.currentBalance ?? 0),
    0
  );

  // Checking — depository accounts with subtype 'checking' (everyday cash).
  const checkingAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.type === "depository" && a.subtype === "checking"
      ),
    [accounts]
  );
  const totalChecking = checkingAccounts.reduce(
    (s, a) => s + (a.currentBalance ?? 0),
    0
  );

  // Investments — brokerage / retirement / crypto accounts (Robinhood,
  // Fidelity, Coinbase, 401k, etc.)
  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.type === "investment"),
    [accounts]
  );
  const totalInvestments = investmentAccounts.reduce(
    (s, a) => s + (a.currentBalance ?? 0),
    0
  );

  // Total "liquid assets" (= savings + investments) — kept available for any
  // future net-worth widget that wants the combined figure.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalLiquidAssets = totalSavings + totalInvestments;

  // Debts (credit + loan)
  const debtAccounts = useMemo(
    () => accounts.filter((a) => a.type === "credit" || a.type === "loan"),
    [accounts]
  );
  const totalDebts = debtAccounts.reduce(
    (s, a) => s + (a.currentBalance ?? 0),
    0
  );

  // Credit-card list used to gate the "Spent on Cards" stats inside the Debts tile.
  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === "credit"),
    [accounts]
  );

  // Financial Goals — real user-created goals when available, otherwise a
  // demo fallback so the chart still has something to render.
  const GOAL_PALETTE = [PALETTE.orange, PALETTE.red, PALETTE.purpleSoft, PALETTE.purple];
  const realGoalChartData = realGoals.slice(0, 4).map((g, i) => ({
    name: g.name,
    value: g.percentage,
    fill: g.color || GOAL_PALETTE[i % GOAL_PALETTE.length],
    target: g.targetAmount,
    current: g.currentAmount,
    remaining: Math.max(0, g.targetAmount - g.currentAmount),
  }));
  // Demo fallback — matches the reference design ($217,000 / 30% overall).
  const DEMO_GOAL_DATA = [
    { name: "Goal 1", value: 70, fill: PALETTE.orange, target: 0, current: 0, remaining: 0 },
    { name: "Goal 2", value: 90, fill: PALETTE.red, target: 0, current: 0, remaining: 0 },
    { name: "Goal 3", value: 55, fill: PALETTE.purpleSoft, target: 0, current: 0, remaining: 0 },
    { name: "Goal 4", value: 25, fill: PALETTE.purple, target: 0, current: 0, remaining: 0 },
  ];
  const goalsAreDemo = realGoalChartData.length === 0;
  const goalData = goalsAreDemo ? DEMO_GOAL_DATA : realGoalChartData;
  // Overall progress = sum of currentAmount / sum of targetAmount across goals
  const realTotalTarget = realGoals.reduce((s, g) => s + g.targetAmount, 0);
  const realTotalProgress = realGoals.reduce((s, g) => s + g.currentAmount, 0);
  const goalsPct = goalsAreDemo
    ? 30
    : realTotalTarget > 0
      ? Math.round((realTotalProgress / realTotalTarget) * 100)
      : 0;
  const displayedGoalsTotal = goalsAreDemo ? 217000 : realTotalProgress;
  // Pending = how much more you still need to save / pay down across all
  // goals combined. Shown in the tile header so the user sees the
  // remaining work at a glance.
  const displayedGoalsPending = goalsAreDemo
    ? Math.max(0, 700000 - 217000) // matches the demo target ($700k total target)
    : Math.max(0, realTotalTarget - realTotalProgress);

  // Investment breakdown for donut — fall back to demo data when no real
  // investment accounts are linked, so the fan chart can still be previewed.
  // Savings pie — one wedge per HYSA / depository-savings account, labeled
  // by institution. Falls back to demo data when nothing is linked.
  const realSavingsPie = savingsAccounts
    .filter((a) => (a.currentBalance ?? 0) > 0)
    .map((a, i) => ({
      name: shortInstitution(a.plaidItem?.institutionName, a.name || a.subtype || "Account"),
      value: a.currentBalance ?? 0,
      color: INVESTMENT_COLORS[i % INVESTMENT_COLORS.length],
    }));
  const savingsPie = realSavingsPie.length > 0 ? realSavingsPie : DEMO_INVESTMENT_DATA;
  const savingsPieIsDemo = realSavingsPie.length === 0;
  const displayedSavingsTotal = savingsPieIsDemo
    ? DEMO_INVESTMENT_DATA.reduce((s, d) => s + d.value, 0)
    : totalSavings;

  // Investments pie — brokerage / retirement / crypto accounts (Robinhood,
  // Fidelity, Coinbase, 401k, etc.), labeled by institution.
  const realInvestmentPie = investmentAccounts
    .filter((a) => (a.currentBalance ?? 0) > 0)
    .map((a, i) => ({
      name: shortInstitution(a.plaidItem?.institutionName, a.name || a.subtype || "Account"),
      value: a.currentBalance ?? 0,
      color: INVESTMENT_COLORS[i % INVESTMENT_COLORS.length],
    }));
  const investmentPie = realInvestmentPie.length > 0 ? realInvestmentPie : DEMO_INVESTMENT_DATA;
  const investmentPieIsDemo = realInvestmentPie.length === 0;
  const displayedInvestmentTotal = investmentPieIsDemo
    ? DEMO_INVESTMENT_DATA.reduce((s, d) => s + d.value, 0)
    : totalInvestments;

  // Debt bars — credit cards and loans, sorted descending by balance. For
  // credit accounts we have an `availableBalance` so we can compute a limit
  // (balance + available) and a utilization %. Loans typically don't expose
  // an available balance, so we just show the balance.
  // Debts tile — shows credit cards only (loans like mortgage / auto are
  // tracked separately on /debts and roll into Net Worth via Total Values).
  const creditCardBars = debtAccounts
    .filter((a) => a.type === "credit")
    .filter((a) => (a.currentBalance ?? 0) > 0)
    .map((a, i) => {
      const institution = shortInstitution(a.plaidItem?.institutionName, a.name || a.subtype || "Account");
      const balance = a.currentBalance ?? 0;
      const available = a.availableBalance ?? 0;
      // Plaid often returns null / unreliable availableBalance for Amex charge
      // cards (no preset hard limit). Fall back to a $50,000 spending limit
      // for Amex so utilization renders meaningfully.
      const isAmex = institution === "Amex";
      const computedLimit = available > 0 ? balance + available : null;
      const limit = computedLimit ?? (isAmex ? 50000 : null);
      const utilization = limit && limit > 0 ? (balance / limit) * 100 : null;
      return {
        name: a.mask ? `${institution} ····${a.mask}` : institution,
        balance,
        limit,
        utilization,
        isCredit: true,
        color: INVESTMENT_COLORS[i % INVESTMENT_COLORS.length],
      };
    })
    .sort((a, b) => b.balance - a.balance);

  const totalCreditCardBalance = creditCardBars.reduce(
    (s, d) => s + d.balance,
    0
  );

  // Kept for the Total Values panel (covers all debt = credit + loan).
  const debtBars = creditCardBars;

  // Budget data — real if budgets exist; otherwise show demo data so the
  // variable-radius donut effect is visible during preview.
  const realBudgetData = (insights?.budgetInsights ?? [])
    .filter((b) => b.limit > 0)
    .map((b, i) => ({
      name: b.categoryName,
      spent: b.spent,
      limit: b.limit,
      color: INVESTMENT_COLORS[i % INVESTMENT_COLORS.length],
    }));
  const budgetIsDemo = realBudgetData.length === 0;
  const budgetData = budgetIsDemo ? DEMO_BUDGET_DATA : realBudgetData;
  const displayedBudgetSpent = budgetIsDemo ? DEMO_BUDGET_TOTAL : totalBudgetSpent;
  const displayedBudgetLimit = budgetIsDemo
    ? DEMO_BUDGET_DATA.reduce((s, d) => s + d.limit, 0)
    : totalBudgetLimit;
  const displayedBudgetUsedPct = budgetIsDemo
    ? Math.round((DEMO_BUDGET_TOTAL / DEMO_BUDGET_DATA.reduce((s, d) => s + d.limit, 0)) * 100)
    : budgetUsedPct;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-card border border-border/60 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground/90">
            Personal Finance Dashboard
          </h1>
        </div>
        <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-2 min-w-0">
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "personal" | "household")}
          >
            <TabsList>
              <TabsTrigger value="personal" className="gap-1.5">
                👤 Personal
              </TabsTrigger>
              <TabsTrigger value="household" className="gap-1.5">
                🏠 Household
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            Today: {format(now, "d MMM yyyy")}
          </p>
        </div>
      </div>

      {/* Month pills */}
      <div className="rounded-2xl bg-card border border-border/60 px-3 py-3 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max justify-center">
          {MONTH_NAMES_SHORT.map((m, i) => {
            const isActive = month === i + 1;
            const isFuture =
              year === now.getFullYear() && i + 1 > now.getMonth() + 1;
            return (
              <button
                key={m}
                onClick={() => !isFuture && setMonth(i + 1)}
                disabled={isFuture}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide border transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-md shadow-orange-500/30"
                    : isFuture
                      ? "border-border/50 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 1: Income (trend + ratio) merged + Debts */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Merged Income tile — line chart on the left, ratio donut on the right */}
        <Link href="/income" className="lg:col-span-9 min-w-0 block group">
        <Card className="h-full min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
          <CardHeader className="pb-2 pt-4 px-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold">
                Income vs Expenses ({year})
              </CardTitle>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="inline-block w-3 h-0.5 rounded"
                    style={{ background: PALETTE.orange }}
                  />
                  Income
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="inline-block w-3 h-0.5 rounded"
                    style={{ background: PALETTE.purple }}
                  />
                  Expenses
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3 items-center">
              {/* Line chart */}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={yearlyTrend}
                  margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border/50"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v) || 0), ""]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke={PALETTE.orange}
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, stroke: PALETTE.orange, strokeWidth: 2, fill: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke={PALETTE.purple}
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, stroke: PALETTE.purple, strokeWidth: 2, fill: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Ratio Income donut — vertical separator + chart on the right */}
              <div className="sm:border-l sm:border-border/60 sm:pl-3">
                <p className="text-[11px] text-center font-medium text-muted-foreground mb-1">
                  Ratio Income · {MONTH_NAMES_SHORT[month - 1]}
                </p>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Income", value: totalIncome, color: PALETTE.orange },
                          { name: "Expenses", value: totalExpenses, color: PALETTE.purple },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill={PALETTE.orange} />
                        <Cell fill={PALETTE.purple} />
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [formatCurrency(Number(v) || 0), String(n)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Income
                    </p>
                    <p className="text-xl font-bold text-foreground">{incomeRatio}%</p>
                  </div>
                </div>
                <p className="text-center text-sm font-bold mt-1 tabular-nums">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </Link>

        {/* Debts tile — credit cards only (loans live on /debts) */}
        <Link href="/debts" className="lg:col-span-3 min-w-0 block group">
        <Card className="h-full min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
          <InfoTooltipProvider delayDuration={200}>
          <CardHeader className="pb-1 pt-4 px-5 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Credit Cards</CardTitle>
            <InfoTooltip>
              <InfoTooltipTrigger asChild>
                <span className="text-sm font-bold tabular-nums cursor-help">
                  {formatCurrency(totalCreditCardBalance)}
                </span>
              </InfoTooltipTrigger>
              <InfoTooltipContent side="left" className="max-w-[220px] text-xs">
                Sum of current balances across all your credit cards — what you owe today (mortgage and auto loans are excluded; see /debts for the full picture).
              </InfoTooltipContent>
            </InfoTooltip>
          </CardHeader>          <CardContent className="px-4 pb-3">
            {creditCardBars.length > 0 ? (
              <div className="space-y-1.5">
                {creditCardBars.map((d) => {
                  // Bar fill ratio:
                  //   - credit card with known limit: utilization (balance/limit)
                  //   - otherwise: balance relative to the largest debt
                  const ratio =
                    d.utilization != null
                      ? Math.min(d.utilization, 100)
                      : (d.balance / creditCardBars[0].balance) * 100;
                  return (
                    <div key={d.name} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="flex items-center gap-1 min-w-0 flex-1 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: d.color }}
                          />
                          <span className="truncate text-muted-foreground">{d.name}</span>
                        </span>
                        <span className="tabular-nums font-medium shrink-0">
                          {formatCurrency(d.balance)}
                          {d.limit != null && (
                            <span className="text-muted-foreground font-normal">
                              {" / "}{formatCurrency(d.limit)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${ratio}%`, background: d.color }}
                          title={
                            d.utilization != null
                              ? `${d.utilization.toFixed(0)}% utilization`
                              : formatCurrency(d.balance)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[90px] flex items-center justify-center">
                <p className="text-[11px] text-muted-foreground">
                  No credit cards
                </p>
              </div>
            )}
            {creditCards.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-center">
                <InfoTooltip>
                  <InfoTooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                        Cards · {MONTH_NAMES_SHORT[month - 1]}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-orange-600 dark:text-orange-400 leading-tight">
                        {formatCurrency(insights?.creditCardSpend ?? 0)}
                      </p>
                    </div>
                  </InfoTooltipTrigger>
                  <InfoTooltipContent side="bottom" className="max-w-[220px] text-xs">
                    Total spent on credit cards in {MONTH_NAMES_SHORT[month - 1]} so far (sum of all credit-card transactions this month, excluding payments and refunds).
                  </InfoTooltipContent>
                </InfoTooltip>
                <InfoTooltip>
                  <InfoTooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">
                        Last · {MONTH_NAMES_SHORT[(month - 2 + 12) % 12]}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-muted-foreground leading-tight">
                        {formatCurrency(insights?.prevCreditCardSpend ?? 0)}
                      </p>
                    </div>
                  </InfoTooltipTrigger>
                  <InfoTooltipContent side="bottom" className="max-w-[220px] text-xs">
                    Total spent on credit cards in {MONTH_NAMES_SHORT[(month - 2 + 12) % 12]} (last month). Shown for quick month-over-month comparison.
                  </InfoTooltipContent>
                </InfoTooltip>
              </div>
            )}
          </CardContent>
          </InfoTooltipProvider>
        </Card>
        </Link>
      </div>

      {/* Row 2: Three columns — [Budget+Investments stack], [Goals+Savings stack], Total Values */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Stacked: Budget Plan on top, Investments below */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-w-0">
          <Link href="/budgets" className="block group">
          <Card className="min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20 lg:min-h-[260px]">
            <CardHeader className="pb-0 pt-2 px-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Budget Plan
                {budgetIsDemo && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1 py-0.5 rounded">
                    demo
                  </span>
                )}
              </CardTitle>
              <p className="text-sm font-bold tabular-nums mt-0.5">
                {formatCurrency(displayedBudgetSpent)}
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  / {formatCurrency(displayedBudgetLimit)}
                </span>
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <BudgetPlanDonut
                data={budgetData}
                usedPct={displayedBudgetUsedPct}
                width={280}
                height={180}
                innerRadius={38}
                baseRadius={72}
                overshootRadius={22}
              />
            </CardContent>
          </Card>
          </Link>

          <Link href="/investments" className="block group flex-1">
          <Card className="min-w-0 h-full overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
            <CardHeader className="pb-0 pt-2 px-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Investments
                {investmentPieIsDemo && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1 py-0.5 rounded">
                    demo
                  </span>
                )}
              </CardTitle>
              <span className="text-sm font-bold tabular-nums">
                {formatCurrency(displayedInvestmentTotal)}
              </span>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <InvestmentFan
                data={investmentPie}
                height={130}
                innerRadius={36}
                outerRadius={115}
                maxStripes={5}
              />
            </CardContent>
          </Card>
          </Link>
        </div>

        {/* Stacked: Financial Goals on top, Savings below */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-w-0">
          {/* Financial Goals — concentric radial (compact) */}
          <Link href="/goals" className="block group">
          <Card className="min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20 lg:min-h-[260px]">
            <CardHeader className="pb-0 pt-2 px-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Financial Goals
                {goalsAreDemo && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1 py-0.5 rounded">
                    demo
                  </span>
                )}
              </CardTitle>
              <p className="text-sm font-bold tabular-nums mt-0.5">
                {formatCurrency(displayedGoalsPending)}
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  pending
                </span>
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="relative">
                <ResponsiveContainer width="100%" height={192}>
                  <RadialBarChart
                    innerRadius="35%"
                    outerRadius="100%"
                    data={goalData}
                    startAngle={225}
                    endAngle={-45}
                    barSize={7}
                  >
                    {/* Lock the scale so each ring's fill reflects its real
                        percentage (0–100), not its rank vs. the others. */}
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />
                    <RadialBar
                      background={{ fill: "var(--muted)", opacity: 0.4 }}
                      dataKey="value"
                      cornerRadius={7}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as {
                          name: string;
                          value: number;
                          fill: string;
                          target?: number;
                          current?: number;
                          remaining?: number;
                        };
                        return (
                          <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: d.fill }}
                              />
                              <span className="text-xs font-semibold">{d.name}</span>
                            </div>
                            <p className="text-sm font-bold tabular-nums">
                              {Math.round(d.value)}%
                            </p>
                            {!goalsAreDemo && d.target ? (
                              <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                                <p>
                                  {formatCurrency(d.current ?? 0)} of{" "}
                                  {formatCurrency(d.target)}
                                </p>
                                <p>
                                  {formatCurrency(d.remaining ?? 0)} remaining
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-base font-bold leading-tight">{goalsPct}%</p>
                </div>
              </div>
              {displayedGoalsTotal > 0 && (
                <p className="text-center text-[10px] text-muted-foreground tabular-nums">
                  {formatCurrency(displayedGoalsTotal)} saved
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-1">
                {goalData.map((g, idx) => (
                  <span
                    key={`${g.name}-${idx}`}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"
                  >
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: g.fill }}
                    />
                    {g.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
          </Link>

          {/* Savings — depository accounts only (compact) */}
          <Link href="/investments" className="block group flex-1">
          <Card className="min-w-0 h-full overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
            <CardHeader className="pb-0 pt-2 px-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Savings
                {savingsPieIsDemo && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1 py-0.5 rounded">
                    demo
                  </span>
                )}
              </CardTitle>
              <span className="text-sm font-bold tabular-nums">
                {formatCurrency(displayedSavingsTotal)}
              </span>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <InvestmentFan
                data={savingsPie}
                height={130}
                innerRadius={36}
                outerRadius={115}
                maxStripes={5}
              />
            </CardContent>
          </Card>
          </Link>
        </div>

        {/* Right column — Total Values (sized to match Financial Goals tile) + two compact tiles below */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-w-0">
          {/* Total Values panel — explicit min height matches the Financial
              Goals tile (header + 170px chart + saved text + legend). */}
          <Card className="min-w-0 overflow-hidden" style={{ minHeight: 320 }}>
            <CardHeader className="pb-1 pt-3 px-4 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Total Values</CardTitle>
              <span className="text-[11px] text-muted-foreground">Balance</span>
            </CardHeader>
            <CardContent className="px-3 pb-3 flex flex-col justify-around h-[calc(100%-2.5rem)]">
              <SummaryRow
                href="/budgets"
                icon={<Wallet className="h-3 w-3" />}
                tint="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
                label="Budgeting"
                value={formatCurrency(totalBudgetSpent)}
              />
              <SummaryRow
                href="/income"
                icon={<TrendingUp className="h-3 w-3" />}
                tint="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300"
                label="Income"
                value={formatCurrency(totalIncome)}
              />
              <SummaryRow
                href="/expenses"
                icon={<TrendingDown className="h-3 w-3" />}
                tint="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
                label="Expenses"
                value={formatCurrency(totalExpenses)}
              />
              <SummaryRow
                href="/investments"
                icon={<PiggyBank className="h-3 w-3" />}
                tint="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
                label="Savings"
                value={formatCurrency(totalSavings)}
              />
              <SummaryRow
                href="/investments"
                icon={<Landmark className="h-3 w-3" />}
                tint="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                label="Investments"
                value={formatCurrency(totalInvestments)}
              />
              <SummaryRow
                href="/debts"
                icon={<CreditCard className="h-3 w-3" />}
                tint="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                label="Debts"
                value={formatCurrency(totalDebts)}
              />
              <SummaryRow
                href="/goals"
                icon={<Target className="h-3 w-3" />}
                tint="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                label="Net Cashflow"
                value={formatCurrency(Math.max(0, insights?.netSavings ?? 0))}
              />
            </CardContent>
          </Card>

          {/* Stacked: Checking on top, Household Expenses below — fills
              the remainder of the right column to match the bottom-tile
              heights in the other columns. */}
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <Link href="/accounts" className="block group min-w-0">
              <Card className="min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
                <CardHeader className="pb-0 pt-2 px-3">
                  <CardTitle className="text-sm font-semibold">Checking</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5">
                  <p className="text-base font-bold tabular-nums leading-tight">
                    {formatCurrency(totalChecking)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {checkingAccounts.length} account
                    {checkingAccounts.length !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/expenses" className="block group min-w-0 flex-1">
              <Card className="min-w-0 h-full overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
                <CardHeader className="pb-0 pt-2 px-3">
                  <CardTitle className="text-sm font-semibold">Household</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5">
                  <p className="text-base font-bold tabular-nums leading-tight">
                    {formatCurrency(householdInsights?.totalSpending ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Shared expenses
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent transactions + Spending Activity heatmap */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Link href="/transactions" className="block group lg:col-span-4 min-w-0">
        <Card className="h-full min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
          <CardHeader className="pb-1 pt-3 px-5 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </CardHeader>
          <CardContent className="px-5 pb-3">
            {transactions.length > 0 ? (
              <div className="divide-y">
                {transactions.slice(0, 8).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-2.5 py-1.5 first:pt-0 last:pb-0"
                  >
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-sm shrink-0"
                      style={{
                        backgroundColor: (tx.category?.color ?? PALETTE.gray) + "22",
                        color: tx.category?.color ?? PALETTE.gray,
                      }}
                    >
                      {tx.category?.emoji ?? "📝"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight">
                        {tx.merchantName ?? tx.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {format(new Date(tx.date), "MMM d")}
                        {viewMode === "household" && tx.user && (
                          <span className="ml-1">· {tx.user.firstName}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums shrink-0 ${
                        tx.amount < 0 ? "text-emerald-600" : "text-foreground"
                      }`}
                    >
                      {tx.amount < 0 ? "+" : "-"}
                      {formatCurrencyDetail(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No recent transactions
              </p>
            )}
          </CardContent>
        </Card>
        </Link>

        <Link href="/insights" className="block group lg:col-span-8 min-w-0">
        <Card className="h-full min-w-0 overflow-hidden transition group-hover:shadow-md group-hover:border-foreground/20">
          <CardHeader className="pb-1 pt-3 px-5 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Insights</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </CardHeader>
          <CardContent className="px-5 pb-3 space-y-3">
            {/* Heatmap section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Spending Activity · 12mo
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>Low</span>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`w-2 h-2 rounded-sm ${HEATMAP_CELL_COLORS[i]}`} />
                  ))}
                  <span>High</span>
                </div>
              </div>
              <div
                className="overflow-x-auto scrollbar-hover"
                ref={(el) => { if (el) el.scrollLeft = el.scrollWidth; }}
              >
                <SpendingHeatmap data={heatmapData} />
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* Spending vs last month */}
            {(() => {
              const change = insights?.totalChangePercent ?? 0;
              return (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Spending vs last month</span>
                  <span
                    className={`font-semibold tabular-nums ml-auto ${
                      change > 0 ? "text-rose-600" : change < 0 ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {change > 0 ? "↑" : change < 0 ? "↓" : "—"} {Math.abs(change)}%
                  </span>
                </div>
              );
            })()}

            {/* Top categories */}
            {(insights?.topCategories ?? []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Top Categories
                </p>
                <div className="divide-y">
                  {(insights?.topCategories ?? []).slice(0, 3).map((c) => (
                    <div key={c.categoryId} className="flex items-center gap-2 py-1 first:pt-0 last:pb-0">
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded-md text-xs shrink-0"
                        style={{
                          backgroundColor: (c.color || PALETTE.gray) + "22",
                          color: c.color || PALETTE.gray,
                        }}
                      >
                        {c.emoji}
                      </span>
                      <span className="flex-1 text-xs truncate">{c.categoryName}</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {formatCurrency(c.amount)}
                      </span>
                      {c.changePercent !== 0 && (
                        <span
                          className={`text-[10px] font-medium tabular-nums shrink-0 ${
                            c.changePercent > 0 ? "text-rose-500" : "text-emerald-600"
                          }`}
                        >
                          {c.changePercent > 0 ? "↑" : "↓"}{Math.abs(c.changePercent)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Over budget alert */}
            {(() => {
              const over = (insights?.budgetInsights ?? []).filter((b) => b.status === "over");
              if (over.length === 0) return null;
              return (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
                  <span className="text-sm">⚠️</span>
                  <span className="text-[11px] text-red-700 dark:text-red-300 flex-1">
                    {over.length} {over.length === 1 ? "budget is" : "budgets are"} over limit
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({
  href,
  icon,
  tint,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 -mx-1 px-1 py-0.5 rounded-md hover:bg-muted/60 transition"
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-md shrink-0 ${tint}`}
      >
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-medium truncate">{label}</span>
      <span className="text-[13px] font-bold tabular-nums">{value}</span>
    </Link>
  );
}

// Suppress unused import warnings for icons used only in this file context.
void PiggyBank;

// Heatmap palette — blue scale matching the reference design (low → high spend).
const HEATMAP_CELL_COLORS = [
  "bg-muted/50",
  "bg-blue-100 dark:bg-blue-950",
  "bg-blue-200 dark:bg-blue-800",
  "bg-blue-300 dark:bg-blue-600",
  "bg-blue-400 dark:bg-blue-500",
  "bg-blue-600 dark:bg-blue-400",
];

function heatmapCellIndex(amount: number, max: number): number {
  if (amount === 0 || max === 0) return 0;
  return Math.min(5, Math.ceil((amount / max) * 5));
}

function SpendingHeatmap({ data }: { data: Map<string, number> }) {
  // Build last 53 weeks ending today, starting on Sunday for clean column alignment.
  const today = new Date();
  const end = new Date(today);
  // Walk back to the start of the current week (Sunday)
  const dayOfWeek = end.getDay();
  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (6 - dayOfWeek)); // Saturday of current week
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - 7 * 53 + 1); // ~53 weeks back, Sunday

  const days: { date: Date; key: string; future: boolean }[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const dt = new Date(d);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    days.push({ date: dt, key, future: dt > today });
  }

  // Group into weeks (columns)
  const weeks: { date: Date; key: string; future: boolean }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Month label appears above the first week containing day 1–7
  const monthLabels = weeks.map((w) => {
    const first = w.find((d) => !d.future);
    if (!first) return null;
    if (first.date.getDate() <= 7) {
      return first.date.toLocaleString("en-US", { month: "short" });
    }
    return null;
  });

  const max = Math.max(0, ...Array.from(data.values()));

  const [hover, setHover] = useState<{ key: string; amount: number; x: number; y: number } | null>(null);

  return (
    <div className="relative select-none">
      {/* Month labels row */}
      <div className="flex gap-px mb-1">
        {weeks.map((_, i) => (
          <div key={i} className="w-3 shrink-0 text-[9px] text-muted-foreground leading-none">
            {monthLabels[i] ?? ""}
          </div>
        ))}
      </div>

      {/* Week columns */}
      <div className="flex gap-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-px">
            {week.map((day, di) => {
              if (day.future) {
                return <div key={di} className="w-3 h-3" />;
              }
              const amount = data.get(day.key) ?? 0;
              const idx = heatmapCellIndex(amount, max);
              return (
                <div
                  key={di}
                  className={`w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-150 hover:z-10 hover:ring-1 hover:ring-blue-400 ${HEATMAP_CELL_COLORS[idx]}`}
                  onMouseEnter={(e) => {
                    if (amount === 0) { setHover(null); return; }
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHover({ key: day.key, amount, x: r.left + r.width / 2, y: r.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {hover && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg px-2.5 py-1.5 pointer-events-none"
          style={{
            left: Math.max(8, hover.x - 70),
            top: hover.y > 80 ? hover.y - 50 : hover.y + 20,
          }}
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {new Date(hover.key + "T00:00:00").toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-sm font-bold tabular-nums">{formatCurrencyDetail(hover.amount)}</p>
        </div>
      )}
    </div>
  );
}
