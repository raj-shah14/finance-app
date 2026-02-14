"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

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

interface DailySpending {
  date: string;
  amount: number;
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
  dailySpending: DailySpending[];
  perPerson: PersonSpending[];
}

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: {
    name: string;
    emoji: string;
    color: string;
  };
  user?: {
    firstName: string;
    lastName: string;
  };
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
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"personal" | "household">("household");

  const fetchData = useCallback((mode: string) => {
    setLoading(true);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    Promise.all([
      fetch(`/api/insights?month=${month}&year=${year}&viewMode=${mode}`).then((r) => r.json()),
      fetch(`/api/transactions?limit=8&viewMode=${mode}`).then((r) => r.json()),
    ])
      .then(([insightsData, txData]) => {
        setInsights(insightsData.error ? null : insightsData);
        setTransactions(txData.transactions || []);
      })
      .catch(() => {
        setInsights(null);
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData(viewMode);
  }, [viewMode, fetchData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading...</p>
      </div>
    );
  }

  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  const spendingChange = insights?.totalChangePercent ?? 0;
  const spendingUp = spendingChange > 0;

  const dailyData = (insights?.dailySpending ?? []).map((d) => ({
    day: format(new Date(d.date), "d"),
    amount: d.amount,
  }));

  const topBudgets = (insights?.budgetInsights ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {currentMonth} Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === "household"
              ? "🏠 Shared household expenses"
              : "👤 Your personal finances"}
          </p>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="personal" className="gap-1.5">
              👤 Personal
            </TabsTrigger>
            <TabsTrigger value="household" className="gap-1.5">
              🏠 Household
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Spending */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              💸 Total Spending
            </CardTitle>
            {insights && spendingChange !== 0 && (
              <Badge
                variant={spendingUp ? "destructive" : "secondary"}
                className={
                  spendingUp
                    ? ""
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }
              >
                {spendingUp ? "↑" : "↓"} {Math.abs(spendingChange)}%
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {insights ? formatCurrency(insights.totalSpending) : "$0.00"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {spendingUp ? "More" : "Less"} than last month
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              💵 Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {insights?.totalIncome != null
                ? formatCurrency(insights.totalIncome)
                : "🔒"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {insights?.totalIncome != null ? "This month" : "Private"}
            </p>
          </CardContent>
        </Card>

        {/* Net Savings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              💰 Net Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights?.netSavings != null ? (
              <>
                <p
                  className={`text-2xl font-bold ${
                    insights.netSavings >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {`${insights.netSavings < 0 ? "-" : ""}${formatCurrency(insights.netSavings)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Income minus spending
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">🔒</p>
                <p className="text-xs text-muted-foreground mt-1">Private</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Person Breakdown — Household mode only */}
      {viewMode === "household" && insights?.perPerson && insights.perPerson.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              👥 Spent by Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {insights.perPerson.map((person) => {
                const pct = insights.totalSpending > 0
                  ? Math.round((person.amount / insights.totalSpending) * 100)
                  : 0;
                return (
                  <div key={person.userId} className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                          {person.name.charAt(0)}
                        </div>
                        <span className="font-medium">{person.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{formatCurrency(person.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending by Category Donut */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {insights && insights.allCategories.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={insights.allCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="categoryName"
                      label={(props: any) =>
                        `${props.emoji} ${props.categoryName}`
                      }
                    >
                      {insights.allCategories.map((cat, i) => (
                        <Cell key={i} fill={cat.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No spending data this month
              </p>
            )}
          </CardContent>
        </Card>

        {/* Daily Spending Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Spent",
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No spending data this month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {tx.category?.emoji ?? "📝"}
                      </span>
                      <div>
                        <p className="text-sm font-medium leading-none">
                          {tx.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(tx.date), "MMM d, yyyy")}
                          {viewMode === "household" && tx.user && (
                            <span className="ml-1.5">· {tx.user.firstName}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount < 0 ? "text-emerald-600" : "text-foreground"
                      }`}
                    >
                      {tx.amount < 0 ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No recent transactions
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {topBudgets.length > 0 ? (
              <div className="space-y-5">
                {topBudgets.map((budget) => {
                  const barColor =
                    budget.status === "over"
                      ? "bg-red-500"
                      : budget.status === "warning"
                        ? "bg-yellow-500"
                        : "bg-emerald-500";

                  return (
                    <div key={budget.categoryName} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {budget.emoji} {budget.categoryName}
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(budget.spent)} /{" "}
                          {formatCurrency(budget.limit)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(budget.percentage, 100)}
                        className={`h-2.5 ${
                          budget.status === "over"
                            ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                            : budget.status === "warning"
                              ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                              : "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                        }`}
                      />
                      <div className="flex justify-end">
                        <Badge
                          variant={
                            budget.status === "over"
                              ? "destructive"
                              : "secondary"
                          }
                          className={`text-xs ${
                            budget.status === "good"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : budget.status === "warning"
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                                : ""
                          }`}
                        >
                          {budget.percentage}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No budgets set for this month
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
