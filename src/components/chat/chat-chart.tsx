"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORICAL_COLORS, formatCurrencyDetail } from "@/lib/format";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { ChartSpec } from "@/lib/chat/tools";

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(v));

/** Renders a chart the assistant asked for via its render_chart tool. */
export function ChatChart({ spec }: { spec: ChartSpec }) {
  const money = spec.unit !== "number";
  const fmt = (v: number) => (money ? formatCurrencyDetail(v) : v.toLocaleString("en-US"));
  const data = spec.labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    spec.series.forEach((s) => (row[s.name] = s.values[i]));
    return row;
  });
  const multi = spec.series.length > 1;

  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="px-1 pb-2 text-sm font-semibold">{spec.title}</p>
      <ResponsiveContainer width="100%" height={240}>
        {spec.type === "pie" ? (
          <PieChart>
            <Pie
              data={spec.labels.map((name, i) => ({ name, value: spec.series[0].values[i] }))}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              stroke="none"
            >
              {spec.labels.map((_, i) => (
                <Cell key={i} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={fmt} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : spec.type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (money ? `$${compact(v)}` : compact(v))} />
            <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip valueFormatter={fmt} />} />
            {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {spec.series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} strokeWidth={2.5} dot={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (money ? `$${compact(v)}` : compact(v))} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<ChartTooltip valueFormatter={fmt} />} />
            {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {spec.series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

