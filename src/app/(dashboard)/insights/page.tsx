"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EXCLUDED_FROM_SPENDING } from "@/lib/categories";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  format,
  subYears,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isFuture,
  isToday,
  parseISO,
} from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Flame,
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

// ─── Heatmap ──────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  amount: number;
  count: number;
  categories: { name: string; emoji: string; amount: number; color: string }[];
}

const CELL = 18;

const CELL_COLORS = [
  "bg-muted/50",
  "bg-blue-200 dark:bg-blue-950",
  "bg-blue-300 dark:bg-blue-800",
  "bg-blue-400 dark:bg-blue-600",
  "bg-blue-500 dark:bg-blue-500",
  "bg-blue-600 dark:bg-blue-400",
];

function cellColorIndex(amount: number, max: number): number {
  if (amount === 0 || max === 0) return 0;
  return Math.min(5, Math.ceil((amount / max) * 5));
}

function SpendingHeatmap({
  data,
  maxAmount,
  avgAmount,
  onDayClick,
}: {
  data: Map<string, DayData>;
  maxAmount: number;
  avgAmount: number;
  onDayClick: (date: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{ day: DayData; vx: number; vy: number } | null>(null);

  const today = new Date();
  const gridEnd = endOfWeek(today, { weekStartsOn: 0 });
  const gridStart = startOfWeek(subYears(today, 1), { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = [];
  allDays.forEach((day) => {
    const future = isFuture(day) && !isToday(day);
    week.push(future ? null : format(day, "yyyy-MM-dd"));
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  const monthLabels = weeks.map((w) => {
    for (const d of w) {
      if (!d) continue;
      const parsed = parseISO(d);
      if (parsed.getDate() <= 7) return format(parsed, "MMM");
      break;
    }
    return null;
  });

  const DAY_LABELS = ["", "M", "", "W", "", "F", ""];
  const colW = CELL + 1;

  return (
    <div className="select-none">
      {/* Month labels */}
      <div className="flex pl-5 mb-1">
        {weeks.map((_, i) => (
          <div key={i} style={{ width: colW }} className="shrink-0 text-[9px] text-muted-foreground leading-none">
            {monthLabels[i] ?? ""}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-px mr-1">
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ height: CELL }} className="w-4 text-[9px] text-muted-foreground leading-none flex items-center">
              {label}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-px">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-px">
              {w.map((dateStr, di) => {
                if (!dateStr) return <div key={di} style={{ width: CELL, height: CELL }} />;
                const day = data.get(dateStr);
                const idx = cellColorIndex(day?.amount ?? 0, maxAmount);
                return (
                  <div
                    key={di}
                    style={{ width: CELL, height: CELL }}
                    className={`rounded-sm cursor-pointer transition-transform hover:scale-125 hover:ring-1 hover:ring-blue-400 ${CELL_COLORS[idx]}`}
                    onMouseEnter={(e) => {
                      if (!day || day.amount === 0) { setTooltip(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTooltip({ day, vx: rect.left + rect.width / 2, vy: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => onDayClick(dateStr)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip — fixed so it escapes any overflow context */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl p-3 w-52 pointer-events-none"
          style={{
            left: Math.min(Math.max(tooltip.vx - 104, 8), (typeof window !== "undefined" ? window.innerWidth : 800) - 218),
            top: tooltip.vy > 220 ? tooltip.vy - 178 : tooltip.vy + 22,
          }}
        >
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {format(parseISO(tooltip.day.date), "EEE, MMM d, yyyy")}
          </p>
          <p className="text-xl font-bold mt-0.5">
            ${tooltip.day.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 space-y-1">
            {tooltip.day.categories.slice(0, 3).map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{cat.emoji} {cat.name}</span>
                <span>${cat.amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
          {avgAmount > 0 && (
            <p className={`text-xs mt-2 font-semibold ${tooltip.day.amount > avgAmount ? "text-rose-500" : "text-emerald-500"}`}>
              vs daily avg: {tooltip.day.amount > avgAmount ? "+" : ""}
              {(((tooltip.day.amount - avgAmount) / avgAmount) * 100).toFixed(0)}%
            </p>
          )}
        </div>
      )}

      {/* Legend */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [view, setView] = useState<"household" | "individual">("individual");
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Heatmap
  const [heatmapData, setHeatmapData] = useState<Map<string, DayData>>(new Map());
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [topTransactions, setTopTransactions] = useState<{ id: string; name: string; amount: number; date: string; emoji: string; categoryName: string; color: string }[]>([]);
  const viewMode = view === "individual" ? "personal" : "household";

  useEffect(() => {
    setHeatmapLoading(true);
    const end = format(new Date(), "yyyy-MM-dd");
    const start = format(subYears(new Date(), 1), "yyyy-MM-dd");
    fetch(`/api/transactions?startDate=${start}&endDate=${end}&limit=5000&viewMode=${viewMode}`)
      .then((r) => r.json())
      .then((d) => {
        const map = new Map<string, DayData>();
        const rawTxns: { id: string; name: string; merchantName: string | null; amount: number; date: string; category: { name: string; emoji: string; color: string } | null }[] = [];
        (d.transactions ?? []).forEach((t: { id: string; name: string; merchantName: string | null; amount: number; date: string; category: { name: string; emoji: string; color: string } | null }) => {
          if (t.amount <= 0) return;
          if (t.category && EXCLUDED_FROM_SPENDING.includes(t.category.name)) return;
          rawTxns.push(t);
          // Plaid stores dates at UTC midnight; using `new Date(t.date)` and
          // formatting in local time shifts the day backward in TZs west of
          // UTC. Slice the YYYY-MM-DD portion directly so heatmap buckets
          // match the Plaid calendar date.
          const key = t.date.slice(0, 10);
          if (!map.has(key)) map.set(key, { date: key, amount: 0, count: 0, categories: [] });
          const day = map.get(key)!;
          day.amount += t.amount;
          day.count += 1;
          if (t.category) {
            const ex = day.categories.find((c) => c.name === t.category!.name);
            if (ex) ex.amount += t.amount;
            else day.categories.push({ name: t.category.name, emoji: t.category.emoji, amount: t.amount, color: t.category.color });
          }
        });
        map.forEach((day) => day.categories.sort((a, b) => b.amount - a.amount));
        setHeatmapData(map);
        const top = [...rawTxns]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8)
          .map((t) => ({
            id: t.id,
            name: t.merchantName ?? t.name,
            amount: t.amount,
            date: t.date,
            emoji: t.category?.emoji ?? "❓",
            categoryName: t.category?.name ?? "Uncategorized",
            color: t.category?.color ?? "#9ca3af",
          }));
        setTopTransactions(top);
      })
      .catch(() => {})
      .finally(() => setHeatmapLoading(false));
  }, [viewMode]);

  const heatmapDays = Array.from(heatmapData.values());
  const yearTotal = heatmapDays.reduce((s, d) => s + d.amount, 0);
  const avgPerDay = heatmapDays.length > 0 ? yearTotal / heatmapDays.length : 0;
  const peakDay = [...heatmapDays].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const heatmapMax = peakDay?.amount ?? 1;

  // Monthly rollup for the last 12 calendar months (oldest → newest), used by
  // the bar chart shown next to the heatmap.
  const monthlySpending = (() => {
    const buckets = new Map<string, number>();
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.set(format(d, "yyyy-MM"), 0);
    }
    heatmapDays.forEach((day) => {
      const key = day.date.slice(0, 7); // YYYY-MM
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + day.amount);
    });
    return Array.from(buckets.entries()).map(([key, amount]) => {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return {
        key,
        label: format(d, "MMM"),
        fullLabel: format(d, "MMM yyyy"),
        amount,
      };
    });
  })();
  const monthlyAvg = monthlySpending.reduce((s, m) => s + m.amount, 0) / Math.max(monthlySpending.length, 1);

  // Aggregate spending by category across all 12 months from heatmap data
  const yearCategories: { categoryName: string; emoji: string; color: string; amount: number }[] = (() => {
    const catMap = new Map<string, { categoryName: string; emoji: string; color: string; amount: number }>();
    heatmapDays.forEach((day) => {
      day.categories.forEach((cat) => {
        const existing = catMap.get(cat.name);
        if (existing) existing.amount += cat.amount;
        else catMap.set(cat.name, { categoryName: cat.name, emoji: cat.emoji, color: cat.color, amount: cat.amount });
      });
    });
    return [...catMap.values()].sort((a, b) => b.amount - a.amount);
  })();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
    });
    if (view === "individual") {
      params.set("viewMode", "personal");
    } else {
      params.set("viewMode", "household");
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
          {/* Personal / Household Toggle */}
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "household" | "individual")}
          >
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="individual" className="gap-1.5">
                👤 Personal
              </TabsTrigger>
              <TabsTrigger value="household" className="gap-1.5">
                🏠 Household
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Spending Heatmap */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Spending Activity — Last 12 Months</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Heatmap */}
            <div className="min-w-0">
              {heatmapLoading ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Loading…</div>
              ) : (
                <>
                  <div
                    className="overflow-x-auto scrollbar-hover"
                    ref={(el) => { if (el) el.scrollLeft = el.scrollWidth; }}
                  >
                    <SpendingHeatmap
                      data={heatmapData}
                      maxAmount={heatmapMax}
                      avgAmount={avgPerDay}
                      onDayClick={() => {}}
                    />
                  </div>
                  {/* Legend rendered outside the scroll container so it stays
                      visible even when the user scrolls the heatmap. */}
                  <div className="flex items-center gap-1 mt-3 justify-end">
                    <span className="text-[10px] text-muted-foreground mr-0.5">Low spend</span>
                    {CELL_COLORS.map((color, i) => (
                      <div key={i} style={{ width: 14, height: 14 }} className={`rounded-sm ${color}`} />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-0.5">High spend</span>
                  </div>
                </>
              )}
            </div>

            {/* Monthly spending chart */}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Monthly Spending
              </p>
              {heatmapLoading ? (
                <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">Loading…</div>
              ) : monthlySpending.every((m) => m.amount === 0) ? (
                <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlySpending} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(99,102,241,0.08)" }}
                      contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                      formatter={(value) =>
                        [formatCurrency(Number(value) || 0), "Spent"]}
                      labelFormatter={(_label, payload) => {
                        const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                        return p?.fullLabel ?? "";
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {monthlySpending.map((m, i) => (
                        <Cell
                          key={i}
                          fill={m.amount > monthlyAvg * 1.15 ? "#ef4444" : m.amount > 0 ? "#6366f1" : "#e5e7eb"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {monthlyAvg > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  Monthly avg: <span className="font-medium tabular-nums">${monthlyAvg.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  <span className="ml-2 inline-flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-rose-500" /> above avg
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Stat pills */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-indigo-700 dark:text-indigo-400">Total Spend (yr)</p>
                <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-300 tabular-nums break-all">
                  ${yearTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{heatmapDays.length} active days</p>
              </div>
              <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/50 p-2 shrink-0">
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Avg / Day</p>
                <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums break-all">
                  ${avgPerDay.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-muted-foreground">on spend days</p>
              </div>
              <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-2 shrink-0">
                <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-rose-700 dark:text-rose-400">Peak Day</p>
                <p className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-300 tabular-nums break-all">
                  {peakDay ? `$${peakDay.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {peakDay ? format(parseISO(peakDay.date), "MMM d, yyyy") : "No data"}
                </p>
              </div>
              <div className="rounded-xl bg-rose-100 dark:bg-rose-900/50 p-2 shrink-0">
                <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>

          {/* Category breakdown + Top Transactions */}
          <div className="mt-5 pt-5 border-t grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Spending by Category — left */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Spending by Category (Last 12 Months)
              </p>
              {yearCategories.length > 0 ? (() => {
                const maxAmt = Math.max(...yearCategories.map((c) => c.amount), 1);
                return (
                  <div className="space-y-3">
                    {yearCategories.map((cat) => {
                      const barPct = Math.round((cat.amount / maxAmt) * 100);
                      return (
                        <div key={cat.categoryName} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="flex items-center justify-center w-7 h-7 rounded-lg text-sm shrink-0"
                                style={{ backgroundColor: cat.color + "22", color: cat.color }}
                              >
                                {cat.emoji}
                              </span>
                              <span className="text-sm font-medium truncate">{cat.categoryName}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums w-24 text-right shrink-0 ml-2">
                              {formatCurrency(cat.amount)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${barPct}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {heatmapLoading ? "Loading…" : "No categories to display"}
                </p>
              )}
            </div>

            {/* Top Transactions — right */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Top Transactions (Last 12 Months)
              </p>
              {topTransactions.length > 0 ? (
                <div className="space-y-2.5">
                  {topTransactions.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0"
                        style={{ backgroundColor: t.color + "22", color: t.color }}
                      >
                        {t.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.categoryName} · {format(parseISO(t.date.slice(0, 10)), "MMM d, yyyy")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-red-500 shrink-0">
                        -{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {heatmapLoading ? "Loading…" : "No transactions"}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

        </>
      )}
    </div>
  );
}
