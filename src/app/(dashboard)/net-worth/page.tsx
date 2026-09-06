"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, PALETTE } from "@/lib/format";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

interface Snapshot {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export default function NetWorthPage() {
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/net-worth")
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.current ?? null);
        setHistory(d.history ?? []);
      })
      .catch(() => { setCurrent(null); setHistory([]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const chartData = history.map((s) => ({
    date: format(new Date(s.date), "MMM d"),
    netWorth: s.netWorth,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Net Worth</h1>
          <p className="text-xs text-muted-foreground">Tracked daily from today onward</p>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Net worth</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatCurrency(current?.netWorth ?? 0)}</p>
        <p className="mt-3 text-sm opacity-80">
          {formatCurrency(current?.assets ?? 0)} assets − {formatCurrency(current?.liabilities ?? 0)} liabilities
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-base font-bold tabular-nums">{formatCurrency(current?.assets ?? 0)}</p>
          <p className="text-xs text-muted-foreground">Assets</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-base font-bold tabular-nums">{formatCurrency(current?.liabilities ?? 0)}</p>
          <p className="text-xs text-muted-foreground">Liabilities</p>
        </div>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-semibold">Trend</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip valueFormatter={formatCurrency} />} />
                <Line type="monotone" dataKey="netWorth" name="Net worth" stroke={PALETTE.emerald} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: "#fff", stroke: PALETTE.emerald, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-center px-6">
              <p className="text-sm text-muted-foreground">
                Come back tomorrow to start seeing your net worth trend — today&apos;s snapshot has been recorded.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
