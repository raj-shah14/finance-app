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
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color || entry.fill || "var(--muted-foreground)" }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-popover-foreground">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
