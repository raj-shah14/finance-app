"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Wallet, PiggyBank, ArrowDownLeft } from "lucide-react";

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

interface PersonSpending {
  userId: string;
  name: string;
  amount: number;
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
  perPerson: PersonSpending[];
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

function formatCurrency(amount: number): string {
  return "$" + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function DashboardPage() {
  const now = new Date();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchData = useCallback((mode: string, m: number, y: number) => {
    setLoading(true);
    // Use UTC bounds so transactions stored at UTC midnight (Plaid format)
    // are correctly attributed to the selected month regardless of the
    // browser's timezone.
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();

    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}&viewMode=${mode}`).then((r) => r.json()),
      fetch(`/api/transactions?limit=8&viewMode=${mode}&startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
    ])
      .then(([insightsData, txData]) => {
        setInsights(insightsData.error ? null : insightsData);
        setTransactions(txData.transactions || []);
      })
      .catch(() => { setInsights(null); setTransactions([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(viewMode, month, year); }, [viewMode, month, year, fetchData]);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const spendingChange = insights?.totalChangePercent ?? 0;
  const spendingUp = spendingChange > 0;
  const topBudgets = (insights?.budgetInsights ?? []).slice(0, 5);

  const pieData = (insights?.allCategories ?? [])
    .map((cat) => ({ ...cat, absAmount: Math.abs(cat.amount) }));
  // Spending denominator: only positive amounts (charges) drive % share so
  // refund-net categories don't dilute the spending breakdown.
  const spendingTotal = pieData.reduce((s, c) => s + (c.amount > 0 ? c.amount : 0), 0);
  // Center total: net of spending and refunds (refund-net categories reduce
  // the displayed total, since they offset what was spent that month).
  const netTotal = pieData.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight">
              {MONTH_NAMES[month - 1]}{year !== now.getFullYear() ? ` ${year}` : ""}
            </h1>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewMode === "household" ? "Shared household expenses" : "Your personal finances"}
          </p>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
          <TabsList>
            <TabsTrigger value="personal" className="gap-1.5">👤 Personal</TabsTrigger>
            <TabsTrigger value="household" className="gap-1.5">🏠 Household</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 border border-rose-100 dark:border-rose-900/40 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Spending</p>
            <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-300 mt-0.5 tabular-nums">
              {insights ? formatCurrency(insights.totalSpending) : "$0.00"}
            </p>
            {spendingChange !== 0 && (
              <p className={`text-[11px] mt-0.5 flex items-center gap-0.5 font-medium ${spendingUp ? "text-rose-500" : "text-emerald-600"}`}>
                {spendingUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(spendingChange)}% vs last month
              </p>
            )}
          </div>
          <div className="rounded-xl bg-rose-100 dark:bg-rose-900/50 p-2.5 shrink-0">
            <Wallet className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/40 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Income</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-0.5 tabular-nums">
              {insights?.totalIncome != null ? formatCurrency(insights.totalIncome) : "🔒"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {insights?.totalIncome != null ? "This month" : "Private"}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-2.5 shrink-0">
            <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-100 dark:border-indigo-900/40 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Net Savings</p>
            {insights?.netSavings != null ? (
              <>
                <p className={`text-xl sm:text-2xl font-bold mt-0.5 tabular-nums ${insights.netSavings >= 0 ? "text-indigo-600 dark:text-indigo-300" : "text-rose-600 dark:text-rose-400"}`}>
                  {insights.netSavings < 0 ? "-" : ""}{formatCurrency(insights.netSavings)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Income minus spending</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-0.5">🔒</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Private</p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/50 p-2.5 shrink-0">
            <PiggyBank className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Per-Person — Household only */}
      {viewMode === "household" && insights?.perPerson && insights.perPerson.length > 1 && (
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Spent by Member</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {insights.perPerson.map((person) => {
                const pct = insights.totalSpending > 0
                  ? Math.round((person.amount / insights.totalSpending) * 100) : 0;
                return (
                  <div key={person.userId} className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          {person.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{person.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold">{formatCurrency(person.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Spending Donut + Legend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {pieData.length > 0 ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData.filter((c) => c.amount > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        minAngle={8}
                        dataKey="absAmount"
                        nameKey="categoryName"
                      >
                        {pieData.filter((c) => c.amount > 0).map((cat, i) => (
                          <Cell key={i} fill={cat.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(Number(value) || 0), String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(netTotal)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {pieData.map((cat, i) => {
                    const isRefund = cat.amount < 0;
                    const pct = spendingTotal > 0 ? ((cat.absAmount / spendingTotal) * 100).toFixed(0) : "0";
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="truncate text-xs">{cat.emoji} {cat.categoryName}</span>
                        </div>
                        <span
                          className={`text-xs tabular-nums shrink-0 ml-2 ${
                            isRefund ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {isRefund ? "+" : ""}{formatCurrency(cat.absAmount)}
                          {!isRefund && ` · ${pct}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">No spending data</p>
            )}
          </CardContent>
        </Card>

        {/* Right column: Transactions + Budgets */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Recent Transactions */}
          <Card className="flex-1">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {transactions.length > 0 ? (
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0"
                        style={{
                          backgroundColor: (tx.category?.color ?? "#9ca3af") + "22",
                          color: tx.category?.color ?? "#9ca3af",
                        }}
                      >
                        {tx.category?.emoji ?? "📝"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">
                          {tx.merchantName ?? tx.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(tx.date), "MMM d")}
                          {viewMode === "household" && tx.user && (
                            <span className="ml-1.5">· {tx.user.firstName}</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums shrink-0 ${tx.amount < 0 ? "text-emerald-600" : "text-foreground"}`}>
                        {tx.amount < 0 ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">No recent transactions</p>
              )}
            </CardContent>
          </Card>

          {/* Budget Progress */}
          {topBudgets.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">Budget Progress</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-3">
                  {topBudgets.map((budget) => (
                    <div key={budget.categoryName}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{budget.emoji} {budget.categoryName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            budget.status === "over"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : budget.status === "warning"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          }`}>
                            {budget.percentage}%
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={Math.min(budget.percentage, 100)}
                        className={`h-1.5 ${
                          budget.status === "over"
                            ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                            : budget.status === "warning"
                              ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                              : "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
