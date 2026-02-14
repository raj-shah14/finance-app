"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CategoryInsight {
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

interface PersonBreakdown {
  userId: string;
  name: string;
  amount: number;
}

interface Highlight {
  categoryName: string;
  emoji: string;
  amount: number;
  limit?: number;
}

interface InsightsData {
  totalSpending: number;
  totalIncome: number;
  netSavings: number;
  totalChangePercent: number;
  topCategories: CategoryInsight[];
  allCategories: CategoryInsight[];
  budgetInsights: BudgetInsight[];
  dailySpending: DailySpending[];
  perPerson: PersonBreakdown[];
  highlights: {
    wellDone: Highlight[];
    watchOut: Highlight[];
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

const PIE_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

export default function InsightsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState<"household" | "individual">("household");
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
    });
    if (view === "individual") {
      params.set("userId", "me");
    }

    fetch(`/api/insights?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d.error ? null : d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month, year, view]);

  function goToPreviousMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  const dailyData = (data?.dailySpending ?? []).map((d) => ({
    day: format(new Date(d.date), "MMM d"),
    amount: d.amount,
  }));

  const topCategoriesData = (data?.topCategories ?? []).slice(0, 5).map((c) => ({
    name: `${c.emoji} ${c.categoryName}`,
    current: c.amount,
    previous: c.previousAmount,
  }));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">💡 Spending Insights</h1>

        <div className="flex items-center gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Household / Individual Toggle */}
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "household" | "individual")}
          >
            <TabsList>
              <TabsTrigger value="household">🏠 Household</TabsTrigger>
              <TabsTrigger value="individual">👤 Individual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {!data ? (
        <div className="flex h-[40vh] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No insights available for {MONTH_NAMES[month - 1]} {year}.
          </p>
        </div>
      ) : (
        <>
          {/* Highlights */}
          {(data.highlights.wellDone.length > 0 ||
            data.highlights.watchOut.length > 0) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Highlights</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.highlights.wellDone.map((h) => (
                  <Card
                    key={h.categoryName}
                    className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            Well Done!
                          </p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            {h.emoji} {h.categoryName}
                          </p>
                          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                            {formatCurrency((h.limit ?? 0) - h.amount)} under budget
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {data.highlights.watchOut.map((h) => (
                  <Card
                    key={h.categoryName}
                    className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                            Watch Out!
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {h.emoji} {h.categoryName}
                          </p>
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {formatCurrency(h.amount - (h.limit ?? 0))} over budget
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Spending Categories - Horizontal Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Spending Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {topCategoriesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCategoriesData} layout="vertical">
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={130}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Bar
                        dataKey="current"
                        name="This Month"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                      <Bar
                        dataKey="previous"
                        name="Last Month"
                        fill="#d1d5db"
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground py-12 text-center text-sm">
                    No category data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend - Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyData}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
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
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground py-12 text-center text-sm">
                    No daily spending data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-Person Breakdown (Household view only) */}
          {view === "household" &&
            data.perPerson &&
            data.perPerson.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Per-Person Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.perPerson}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="amount"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {data.perPerson.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Category Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {data.allCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 font-medium">Category</th>
                        <th className="pb-3 font-medium text-right">
                          This Month
                        </th>
                        <th className="pb-3 font-medium text-right">
                          Last Month
                        </th>
                        <th className="pb-3 font-medium text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allCategories.map((cat) => {
                        const up = cat.changePercent > 0;
                        const neutral = cat.changePercent === 0;
                        return (
                          <tr
                            key={cat.categoryName}
                            className="border-b last:border-0"
                          >
                            <td className="py-3">
                              <span className="mr-2">{cat.emoji}</span>
                              {cat.categoryName}
                            </td>
                            <td className="py-3 text-right font-medium">
                              {formatCurrency(cat.amount)}
                            </td>
                            <td className="py-3 text-right text-muted-foreground">
                              {formatCurrency(cat.previousAmount)}
                            </td>
                            <td className="py-3 text-right">
                              {neutral ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 ${
                                    up
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  {up ? (
                                    <TrendingUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <TrendingDown className="h-3.5 w-3.5" />
                                  )}
                                  {up ? "↑" : "↓"}{" "}
                                  {Math.abs(cat.changePercent)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No categories to display
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
