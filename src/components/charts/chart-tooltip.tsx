"use client";

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string | number, entry?: TooltipEntry) => string;
  // Bar charts that color individual bars via <Cell> (e.g. highlighting the
  // current month, or flagging above-average months) don't reliably report
  // that per-bar fill back through recharts' tooltip payload — it falls
  // back to an unset/white dot. Pass either a fixed series color, or a
  // function replicating the same per-bar logic the <Cell>s use, to force
  // the dot instead of trusting entry.color/entry.fill.
  dotColor?: string | ((entry: TooltipEntry) => string);
}

// Shared recharts tooltip content — replaces the library's default white
// box (which ignores dark mode and renders raw "dataKey : value" labels)
// with a theme-aware card: a small header, a colored dot per series, and
// the value run through the same formatter used elsewhere on the page.
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
  labelFormatter,
  dotColor,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const displayLabel = labelFormatter ? labelFormatter(label ?? "", payload[0]) : label;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      {displayLabel !== undefined && displayLabel !== "" && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {displayLabel}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const resolvedDotColor = typeof dotColor === "function" ? dotColor(entry) : dotColor;
          return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: resolvedDotColor || entry.color || entry.fill || "var(--muted-foreground)" }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-popover-foreground">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : entry.value}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
