"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, Target, TrendingUp } from "lucide-react";
import {
  formatCurrency,
  PALETTE,
  MONTH_NAMES_SHORT,
} from "@/lib/format";

interface InsightsData {
  totalIncome: number | null;
  totalSpending: number;
  netSavings: number | null;
}

const GOAL_TARGETS = [
  { name: "Starter", rate: 10, color: PALETTE.purple, description: "Build the savings habit" },
  { name: "Steady", rate: 20, color: PALETTE.purpleLight, description: "Healthy household baseline" },
  { name: "Strong", rate: 35, color: PALETTE.orange, description: "Above-average saver" },
  { name: "FIRE", rate: 50, color: PALETTE.red, description: "Aggressive wealth building" },
];

export default function GoalsPage() {
  const now = new Date();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [yearly, setYearly] = useState<{ month: string; savingsRate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [year, setYear] = useState(now.getFullYear());

  const month = now.getMonth() + 1;

  const fetchData = useCallback((mode: string, m: number, y: number) => {
    fetch(`/api/insights?month=${m}&year=${y}&viewMode=${mode}`)
      .then((r) => r.json())
      .then((ins) => setInsights(ins.error ? null : ins))
      .catch(() => setInsights(null))
      .finally(() => setLoading(false));
  }, []);

  const fetchYearly = useCallback((mode: string, y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}&viewMode=${mode}`).then((r) => r.json()).catch(() => null)
      )
    ).then((results) => {
      setYearly(results.map((d, i) => {
        const income = d?.totalIncome ?? 0;
        const savings = d?.netSavings ?? 0;
        return {
          month: MONTH_NAMES_SHORT[i],
          savingsRate: income > 0 ? Math.round((savings / income) * 100) : 0,
        };
      }));
    });
  }, []);

  useEffect(() => { fetchData(viewMode, month, year); }, [viewMode, month, year, fetchData]);
  useEffect(() => { fetchYearly(viewMode, year); }, [viewMode, year, fetchYearly]);

  const income = insights?.totalIncome ?? 0;
  const savings = Math.max(0, insights?.netSavings ?? 0);
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const savingsRateRounded = Math.round(savingsRate);

  const goalsCompleted = GOAL_TARGETS.filter((g) => savingsRate >= g.rate).length;
  const nextGoal = GOAL_TARGETS.find((g) => savingsRate < g.rate);
  const radialData = GOAL_TARGETS.map((g) => ({
    name: g.name,
    value: Math.min((savingsRate / g.rate) * 100, 100),
    fill: g.color,
  }));

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial Goals</h1>
            <p className="text-xs text-muted-foreground">Savings-rate milestones · {viewMode === "household" ? "Household" : "Personal"}</p>
          </div>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
          <TabsList>
            <TabsTrigger value="personal">👤 Personal</TabsTrigger>
            <TabsTrigger value="household">🏠 Household</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/40 px-3 py-2">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Current Savings Rate</p>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300 tabular-nums">{savingsRateRounded}%</p>
          <p className="text-[11px] text-muted-foreground">{formatCurrency(savings)} of {formatCurrency(income)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Goals Met</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">{goalsCompleted} / {GOAL_TARGETS.length}</p>
          <p className="text-[11px] text-muted-foreground">This month</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Next Goal</p>
          {nextGoal ? (
            <>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">{nextGoal.name}</p>
              <p className="text-[11px] text-muted-foreground">{nextGoal.rate - savingsRateRounded}% to go</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-300 mt-0.5">All met! 🎉</p>
            </>
          )}
        </div>
      </div>

      {/* Goals breakdown */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Progress</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart innerRadius="30%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270} barSize={10}>
                  <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={6} />
                  <Tooltip formatter={(v, _n, p) => [`${Math.round(Number(v) || 0)}%`, p.payload?.name]} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Savings</p>
                <p className="text-2xl font-bold">{savingsRateRounded}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4 space-y-4">
            {GOAL_TARGETS.map((g) => {
              const pct = Math.min((savingsRate / g.rate) * 100, 100);
              const reached = savingsRate >= g.rate;
              return (
                <div key={g.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: g.color + "22", color: g.color }}>
                        <Target className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{g.name} · {g.rate}%</p>
                        <p className="text-[11px] text-muted-foreground">{g.description}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${reached ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {reached ? "✓ Reached" : `${Math.round(pct)}%`}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className={`h-1.5 [&>[data-slot=progress-indicator]]:transition-all`}
                    style={{ ["--progress-color" as string]: g.color } as React.CSSProperties}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Savings rate trend */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Savings Rate · {year}
          </CardTitle>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${Number(v) || 0}%`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              <Line type="monotone" dataKey="savingsRate" stroke={PALETTE.purple} strokeWidth={3} dot={{ r: 3, fill: PALETTE.purple }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Goals are derived from your savings rate. A custom-goals feature (specific dollar targets, deadlines) can be added with a new <code>Goal</code> Prisma model.
      </p>
    </div>
  );
}
