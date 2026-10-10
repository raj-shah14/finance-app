"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXCLUDED_FROM_SPENDING, INCOME_CATEGORIES, CC_BILL_CATEGORIES } from "@/lib/categories";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CashFlowSankey } from "@/components/charts/cash-flow-sankey";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { Flame } from "lucide-react";
import { formatCurrency as formatWholeDollars, formatCurrencyDetail as formatCurrency, PALETTE } from "@/lib/format";
import { HeroCard, ChipRow } from "@/components/dashboard/hero-card";

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

export default function InsightsPage() {
  // Heatmap
  const [heatmapData, setHeatmapData] = useState<Map<string, DayData>>(new Map());
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  // Money in per "YYYY-MM", from the same 12-month fetch as the heatmap.
  const [incomeByMonth, setIncomeByMonth] = useState<Map<string, number>>(new Map());
  // Same deposits, grouped by income category (Income, Savings & Investments)
  // — the left side of the cash flow Sankey.
  const [incomeByCategory, setIncomeByCategory] = useState<Map<string, number>>(new Map());
  // Purchases per linked credit card over the same 12 months.
  // Per "YYYY-MM": purchases made on the cards, and CC Bill payments made
  // toward them (from checking). Close to equal over time; the payments lag.
  const [cardPurchasesByMonth, setCardPurchasesByMonth] = useState<Map<string, number>>(new Map());
  const [cardPaidByMonth, setCardPaidByMonth] = useState<Map<string, number>>(new Map());
  const [cardSpend, setCardSpend] = useState<{ key: string; name: string; mask: string | null; amount: number; count: number }[]>([]);
  const [topTransactions, setTopTransactions] = useState<{ id: string; name: string; amount: number; date: string; emoji: string; categoryName: string; color: string }[]>([]);

  useEffect(() => {
    setHeatmapLoading(true);
    const end = format(new Date(), "yyyy-MM-dd");
    const start = format(subYears(new Date(), 1), "yyyy-MM-dd");
    fetch(`/api/transactions?startDate=${start}&endDate=${end}&limit=5000&viewMode=personal`)
      .then((r) => r.json())
      .then((d) => {
        const map = new Map<string, DayData>();
        const income = new Map<string, number>();
        const incomeCats = new Map<string, number>();
        const cardPurchases = new Map<string, number>();
        const cardPaid = new Map<string, number>();
        const cards = new Map<string, { key: string; name: string; mask: string | null; amount: number; count: number }>();
        const rawTxns: { id: string; name: string; merchantName: string | null; amount: number; date: string; category: { name: string; emoji: string; color: string } | null }[] = [];
        (d.transactions ?? []).forEach((t: { id: string; name: string; merchantName: string | null; amount: number; date: string; category: { name: string; emoji: string; color: string } | null; account?: { name: string; mask?: string | null; type: string } }) => {
          // Deposits in income categories feed the cash flow chart; everything
          // below this line only deals with spending (amount > 0).
          if (t.amount < 0 && t.category && INCOME_CATEGORIES.includes(t.category.name)) {
            const monthKey = t.date.slice(0, 7);
            income.set(monthKey, (income.get(monthKey) ?? 0) - t.amount);
            incomeCats.set(t.category.name, (incomeCats.get(t.category.name) ?? 0) - t.amount);
          }
          // CC Bill payments out of checking (excluded from spending below,
          // but worth showing next to card purchases as "paid to cards").
          if (t.amount > 0 && t.account?.type !== "credit" && t.category && CC_BILL_CATEGORIES.includes(t.category.name)) {
            const monthKey = t.date.slice(0, 7);
            cardPaid.set(monthKey, (cardPaid.get(monthKey) ?? 0) + t.amount);
          }
          if (t.amount <= 0) return;
          if (t.category && EXCLUDED_FROM_SPENDING.includes(t.category.name)) return;
          rawTxns.push(t);
          // Spending across every linked card is the purchases made ON the
          // cards. The payments from checking that settle them are excluded
          // above (transfers), so nothing is counted twice.
          if (t.account?.type === "credit") {
            const key = `${t.account.name}|${t.account.mask ?? ""}`;
            const card = cards.get(key) ?? { key, name: t.account.name, mask: t.account.mask ?? null, amount: 0, count: 0 };
            card.amount += t.amount;
            card.count += 1;
            cards.set(key, card);
            const monthKey = t.date.slice(0, 7);
            cardPurchases.set(monthKey, (cardPurchases.get(monthKey) ?? 0) + t.amount);
          }
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
        setIncomeByMonth(income);
        setIncomeByCategory(incomeCats);
        setCardPurchasesByMonth(cardPurchases);
        setCardPaidByMonth(cardPaid);
        setCardSpend([...cards.values()].sort((a, b) => b.amount - a.amount));
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
  }, []);

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
  const cashFlow = monthlySpending.map((m) => {
    const income = incomeByMonth.get(m.key) ?? 0;
    return { label: m.label, fullLabel: m.fullLabel, income, expenses: m.amount, net: income - m.amount };
  });
  const cashFlowTotals = cashFlow.reduce(
    (t, m) => ({ income: t.income + m.income, expenses: t.expenses + m.expenses }),
    { income: 0, expenses: 0 }
  );
  const cardSpendTotal = cardSpend.reduce((t, c) => t + c.amount, 0);
  const cardMonthly = monthlySpending.map((m) => ({
    label: m.label,
    fullLabel: m.fullLabel,
    purchases: cardPurchasesByMonth.get(m.key) ?? 0,
    paid: cardPaidByMonth.get(m.key) ?? 0,
  }));
  const cardPaidTotal = cardMonthly.reduce((t, m) => t + m.paid, 0);
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

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">💡 Spending Insights</h1>
      </div>

      {/* Hero: trailing 12-month spend */}
      {!heatmapLoading && yearTotal > 0 && (
        <>
          <HeroCard
            eyebrow="Spend · last 12 months"
            value={`$${yearTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            subline={`$${avgPerDay.toLocaleString("en-US", { maximumFractionDigits: 0 })} avg/day · ${heatmapDays.length} active days`}
            pill={
              peakDay ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-xs font-semibold">
                  <Flame className="h-3.5 w-3.5" />
                  Peak ${peakDay.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} · {format(parseISO(peakDay.date), "MMM d")}
                </span>
              ) : undefined
            }
          />

          <ChipRow
            title="Where it went"
            chips={yearCategories.slice(0, 3).map((c) => ({
              key: c.categoryName,
              label: `${c.emoji} ${c.categoryName}`,
              // Whole dollars: cents on a 12-month category total are noise, and
              // they're what pushed the value past the tile on a phone.
              value: formatWholeDollars(c.amount),
            }))}
          />
        </>
      )}

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
                      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                      content={
                        <ChartTooltip
                          valueFormatter={formatCurrency}
                          labelFormatter={(_label, entry) => {
                            const p = entry?.payload as { fullLabel?: string } | undefined;
                            return p?.fullLabel ?? "";
                          }}
                          dotColor={(entry) => {
                            const p = entry.payload as { amount?: number } | undefined;
                            const amount = p?.amount ?? 0;
                            return amount > monthlyAvg * 1.15 ? "#ef4444" : amount > 0 ? "#6366f1" : "#e5e7eb";
                          }}
                        />
                      }
                    />
                    <Bar dataKey="amount" name="Spent" radius={[6, 6, 0, 0]}>
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

      {/* Cash flow Sankey: where money came from and where it went */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Cash Flow — Last 12 Months</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          {heatmapLoading ? (
            <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">Loading…</div>
          ) : yearCategories.length === 0 && incomeByCategory.size === 0 ? (
            <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">No data</div>
          ) : (
            <CashFlowSankey
              incomeSources={[...incomeByCategory.entries()].map(([name, amount]) => ({ name, amount }))}
              spending={yearCategories.map((c) => ({ name: c.categoryName, amount: c.amount, color: c.color }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Monthly trend: income vs. expenses, with net */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Income vs Expenses by Month</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {heatmapLoading ? (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">Loading…</div>
          ) : cashFlow.every((m) => m.income === 0 && m.expenses === 0) ? (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={cashFlow} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={4} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1000 ? `${v < 0 ? "-" : ""}$${Math.round(Math.abs(v) / 1000)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={
                      <ChartTooltip
                        valueFormatter={formatCurrency}
                        labelFormatter={(_label, entry) => {
                          const p = entry?.payload as { fullLabel?: string } | undefined;
                          return p?.fullLabel ?? "";
                        }}
                      />
                    }
                  />
                  <Bar dataKey="income" name="Income" fill={PALETTE.emerald} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={PALETTE.orange} radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net"
                    stroke={PALETTE.purple}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: PALETTE.emerald }} />Income</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: PALETTE.orange }} />Expenses</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ background: PALETTE.purple }} />Net</span>
                </span>
                <span className="tabular-nums">
                  12-mo net{" "}
                  <span className={`font-medium ${cashFlowTotals.income - cashFlowTotals.expenses >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {cashFlowTotals.income - cashFlowTotals.expenses >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(cashFlowTotals.income - cashFlowTotals.expenses))}
                  </span>
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Spending across all linked credit cards */}
      {!heatmapLoading && cardSpend.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Credit Card Spending — Last 12 Months</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(cardSpendTotal)}</p>
            <p className="text-[11px] text-muted-foreground mb-4">
              across {cardSpend.length} card{cardSpend.length === 1 ? "" : "s"} · ${Math.round(cardSpendTotal / 12).toLocaleString("en-US")}/mo avg · card payments excluded, so nothing is counted twice
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cardMonthly} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={4} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`)}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={
                    <ChartTooltip
                      valueFormatter={formatCurrency}
                      labelFormatter={(_label, entry) => {
                        const p = entry?.payload as { fullLabel?: string } | undefined;
                        return p?.fullLabel ?? "";
                      }}
                    />
                  }
                />
                <Bar dataKey="purchases" name="Card purchases" fill={PALETTE.purple} radius={[4, 4, 0, 0]} />
                {cardPaidTotal > 0 && (
                  <Bar dataKey="paid" name="Paid to cards (CC Bill)" fill={PALETTE.purpleSoft} radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: PALETTE.purple }} />Card purchases</span>
              {cardPaidTotal > 0 && (
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: PALETTE.purpleSoft }} />Paid to cards (CC Bill) · {formatCurrency(cardPaidTotal)}</span>
              )}
            </div>
            <div className="space-y-3">
              {cardSpend.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {c.name}
                      {c.mask ? <span className="ml-1 text-xs text-muted-foreground">••{c.mask}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.amount / cardSpend[0].amount) * 100}%`, background: PALETTE.purple }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {Math.round((c.amount / cardSpendTotal) * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.count} transaction{c.count === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
