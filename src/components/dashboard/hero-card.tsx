import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * The lime "hero" card repeated at the top of every main page (Dashboard,
 * Budgets, Expenses, Income, Investments, Savings, Debts, Goals, Accounts,
 * Net Worth, Insights, Transactions) — a big headline number with a small
 * eyebrow label and a subline, optionally paired with a trailing pill
 * (a trend badge, a "% saved" tag, etc.). Each page still owns its own
 * numbers/copy; this only centralizes the shared shell markup.
 */
export function HeroCard({
  eyebrow,
  value,
  subline,
  pill,
}: {
  eyebrow: string;
  value: string;
  subline: string;
  pill?: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{eyebrow}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm opacity-80">{subline}</p>
        {pill}
      </div>
    </div>
  );
}

/** Trailing pill for HeroCard showing a vs-last-period trend. */
export function TrendPill({
  changePercent,
  suffix = "vs last month",
  invert = false,
}: {
  changePercent: number;
  suffix?: string;
  /** Some pages (e.g. spending) treat a drop as good news, shown via a
   * down arrow either way — `invert` only flips which icon renders. */
  invert?: boolean;
}) {
  if (changePercent === 0) return null;
  const isDown = invert ? changePercent > 0 : changePercent < 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-xs font-semibold">
      {isDown ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
      {Math.round(Math.abs(changePercent))}% {suffix}
    </span>
  );
}

interface Chip {
  key: string;
  label: string;
  value: string;
}

/**
 * The 2-4 tile row shown under most hero cards ("Where it went", "Top
 * sources", "Balances", "Breakdown", ...) — first tile tinted with the
 * primary color, the rest neutral.
 */
export function ChipRow({ title, chips, columns = 3 }: { title: string; chips: Chip[]; columns?: 3 | 4 }) {
  if (chips.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted-foreground">{title}</p>
      <div className={`grid gap-3 ${columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {chips.map((c, i) => (
          <div key={c.key} className={`rounded-2xl p-4 ${i === 0 ? "bg-primary/15" : "bg-muted/60"}`}>
            <p className="text-xs text-muted-foreground truncate">{c.label}</p>
            <p className="mt-2 text-lg font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
