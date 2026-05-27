"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

/**
 * A single budget category for the Budget Plan donut. Outer radius of the
 * rendered wedge scales by `spent/limit`:
 *   - At 100% spent → wedge reaches the reference ring (`baseRadius`)
 *   - Under budget → wedge falls short of the reference ring
 *   - Over budget → wedge extends past the reference ring
 */
export interface BudgetDatum {
  name: string;
  spent: number;
  limit: number;
  color: string;
}

/**
 * Temporary demo dataset matching the reference screenshot — a mix of
 * over- and under-budget categories so the variable-radius effect is visible.
 */
export const DEMO_BUDGET_DATA: BudgetDatum[] = [
  { name: "Housing", spent: 1200, limit: 1000, color: "#f97316" },             // 120% — over budget (orange)
  { name: "Groceries", spent: 800, limit: 800, color: "#fde68a" },             // 100% — on target (cream)
  { name: "Car", spent: 415, limit: 500, color: "#7c3aed" },                   // 83%  — close to limit (purple)
  { name: "Travel", spent: 1000, limit: 1500, color: "#c4b5fd" },              // 67%  — under budget (light purple)
  { name: "Gas & Transport", spent: 16, limit: 80, color: "#14b8a6" },         // 20%  — very low fill (teal)
  { name: "Dining", spent: 240, limit: 400, color: "#ef4444" },                // 60%  — moderate (red)
  { name: "Healthcare", spent: 75, limit: 200, color: "#3b82f6" },             // 38%  — edge-of-threshold (blue)
];

/** Demo total displayed in the footer when running on `DEMO_BUDGET_DATA`. */
export const DEMO_BUDGET_TOTAL = 3746;

interface Props {
  data: BudgetDatum[];
  /** Overall spent ÷ limit %, shown in the center. Computed if omitted. */
  usedPct?: number;
  width?: number;
  height?: number;
  /** Innermost radius (gap inside the donut). */
  innerRadius?: number;
  /** Reference ring radius — categories at 100% spent land here. */
  baseRadius?: number;
  /** Maximum extra outer radius for over-budget categories. */
  overshootRadius?: number;
  /** How far each wedge's outer edge curves inward, in px. 0 = flat arc. */
  concaveBulge?: number;
  /** How far each wedge's inner edge curves outward, in px. 0 = flat arc. */
  innerBulge?: number;
  /** Show category legend below the chart. */
  showLegend?: boolean;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/**
 * Build an SVG path for JUST the concave outer edge curve of a wedge — used
 * as a stroked overlay to mark the 100% budget line so it follows the same
 * curve as the wedge's outer boundary.
 */
function concaveEdgePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  bulge: number
): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  if (bulge <= 0) {
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }
  const midAngle = (startAngle + endAngle) / 2;
  const controlR = Math.max(2, r - bulge);
  const ctrl = polar(cx, cy, controlR, midAngle);
  return `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`;
}

/**
 * Build an SVG path for an annular sector. When `outerConcaveBulge` > 0 the
 * outer edge is drawn as a quadratic Bezier curved inward toward the chart
 * center. When `innerConcaveBulge` > 0 the inner edge is curved outward
 * (away from the chart center) — together they make each wedge look like a
 * thin lens / scooped band.
 */
function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  outerConcaveBulge = 0,
  innerConcaveBulge = 0
): string {
  const outerStart = polar(cx, cy, outerR, startAngle);
  const outerEnd = polar(cx, cy, outerR, endAngle);
  const innerEnd = polar(cx, cy, innerR, endAngle);
  const innerStart = polar(cx, cy, innerR, startAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const midAngle = (startAngle + endAngle) / 2;

  let outerSegment: string;
  // Scale the bulge down for thin bands so partial fills still curve in the
  // same direction as the track — keeping inner/outer edges parallel.
  const oBulge = Math.abs(outerConcaveBulge);
  const maxBulge = Math.max(0, (outerR - innerR) / 2 - 1);
  const effOBulge = Math.min(oBulge, maxBulge);
  if (effOBulge > 0) {
    const controlR =
      outerConcaveBulge > 0 ? outerR - effOBulge : outerR + effOBulge;
    const ctrl = polar(cx, cy, controlR, midAngle);
    outerSegment = `Q ${ctrl.x} ${ctrl.y} ${outerEnd.x} ${outerEnd.y}`;
  } else {
    outerSegment = `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`;
  }

  let innerSegment: string;
  const iBulge = Math.abs(innerConcaveBulge);
  const effIBulge = Math.min(iBulge, maxBulge);
  if (effIBulge > 0) {
    const controlR =
      innerConcaveBulge > 0
        ? innerR + effIBulge
        : Math.max(2, innerR - effIBulge);
    const ctrl = polar(cx, cy, controlR, midAngle);
    innerSegment = `Q ${ctrl.x} ${ctrl.y} ${innerStart.x} ${innerStart.y}`;
  } else {
    innerSegment = `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`;
  }

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    outerSegment,
    `L ${innerEnd.x} ${innerEnd.y}`,
    innerSegment,
    "Z",
  ].join(" ");
}

export function BudgetPlanDonut({
  data,
  usedPct,
  width = 220,
  height = 220,
  innerRadius = 50,
  baseRadius = 78,
  overshootRadius = 18,
  concaveBulge = 8,
  innerBulge = 0,
  showLegend = true,
}: Props) {
  // Hover tooltip state — viewport coords + the wedge being hovered. Declared
  // before any early returns to satisfy React hooks ordering rules.
  const [hover, setHover] = useState<{
    wedge: { name: string; spent: number; limit: number; color: string; pct: number };
    x: number;
    y: number;
  } | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground">No budgets</p>
      </div>
    );
  }

  const totalSpent = data.reduce((s, d) => s + d.spent, 0);
  const totalLimit = data.reduce((s, d) => s + d.limit, 0);
  const overallPct =
    usedPct ?? (totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0);

  // Layout
  const cx = width / 2;
  const cy = height / 2;
  const ANGULAR_GAP = 3; // degrees between adjacent wedges
  const usableSweep = 360 - ANGULAR_GAP * data.length;
  // Equal angular share per category — each category's RADIAL extent (not
  // angular size) communicates its spent/limit ratio.
  const wedgeAngle = usableSweep / data.length;

  // Compute angular positions immutably via reduce so each wedge knows where
  // the previous one ended without mutating a captured variable.
  const wedges = data.reduce<
    Array<{ name: string; spent: number; limit: number; color: string; startAngle: number; endAngle: number; pct: number }>
  >((acc, d) => {
    const prevEnd = acc.length === 0 ? 90 : acc[acc.length - 1].endAngle - ANGULAR_GAP;
    const startAngle = prevEnd;
    const endAngle = prevEnd - wedgeAngle;
    const pct = d.limit > 0 ? d.spent / d.limit : 0;
    acc.push({ ...d, startAngle, endAngle, pct });
    return acc;
  }, []);

  function handleEnter(
    e: React.MouseEvent<SVGElement>,
    wedge: { name: string; spent: number; limit: number; color: string; pct: number }
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ wedge, x: r.left + r.width / 2, y: r.top });
  }
  function handleLeave() {
    setHover(null);
  }

  return (
    <div className="relative">
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ height }}
    >
      <defs>
        <filter id="bpShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.15" />
        </filter>
      </defs>

      {wedges.map((w, idx) => {
        // Width of the radial "progress bar" track for this wedge.
        const trackOuter = baseRadius;
        // How much of the radial space is filled by the colored bar.
        const fillRatio = Math.min(w.pct, 1);
        // Fill is anchored at the INNER edge and grows OUTWARD as the budget
        // is used up. So an empty category shows just gray track; 100% spent
        // fills the entire track up to the budget line.
        const fillEnd = innerRadius + (trackOuter - innerRadius) * fillRatio;
        // Over-budget protrusion. Use a minimum visible size + scaled extra
        // so any over-budget shows up clearly, with bigger overages bulging
        // out further (capped).
        const overshoot =
          w.pct > 1
            ? Math.min(overshootRadius, 8 + (w.pct - 1) * overshootRadius * 1.5)
            : 0;

        return (
          <g
            key={`${w.name}-${idx}`}
            onMouseEnter={(e) => handleEnter(e, w)}
            onMouseMove={(e) => handleEnter(e, w)}
            onMouseLeave={handleLeave}
            style={{ cursor: "pointer" }}
          >
            {/* 1. Gray track — full radial space for this wedge. Inner edge
                curves toward the center BY THE SAME AMOUNT as the outer
                edge, so both edges are parallel arcs (constant-thickness
                scooped band). */}
            <path
              d={annularSectorPath(cx, cy, innerRadius, trackOuter, w.startAngle, w.endAngle, concaveBulge, -concaveBulge)}
              fill="var(--muted)"
              fillOpacity={0.55}
            />

            {/* 2. Colored fill anchored at the INNER edge, growing outward
                proportional to spent/limit. Both edges parallel-concave so
                the fill keeps the same scooped band thickness as the track. */}
            {fillRatio > 0 && (
              <path
                d={annularSectorPath(cx, cy, innerRadius, fillEnd, w.startAngle, w.endAngle, concaveBulge, -concaveBulge)}
                fill={w.color}
                filter="url(#bpShadow)"
              />
            )}

            {/* 3. Budget line — a stroked curve that follows the wedge's
                concave outer edge, marking the 100% boundary. */}
            <path
              d={concaveEdgePath(cx, cy, trackOuter, w.startAngle, w.endAngle, concaveBulge)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeOpacity={0.55}
              strokeLinecap="round"
              className="text-foreground"
            />

            {/* 4. Overshoot segment — sits on top of the track's concave
                outer edge. Its inner edge curves TOWARD the center (negative
                bulge) to match the track's outer dip; its outer edge curves
                the same way so the whole protrusion reads as a lens-shaped
                "bump" beyond the budget line. */}
            {overshoot > 0 && (
              <path
                d={annularSectorPath(
                  cx,
                  cy,
                  trackOuter + 2,
                  trackOuter + 2 + overshoot,
                  w.startAngle,
                  w.endAngle,
                  concaveBulge,
                  -concaveBulge
                )}
                fill={w.color}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth={0.8}
                filter="url(#bpShadow)"
              />
            )}
          </g>
        );
      })}

      {/* Center text */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-muted-foreground pointer-events-none"
        style={{ fontSize: 10 }}
      >
        Used Budget
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-foreground pointer-events-none"
        style={{ fontSize: 14, fontWeight: 700 }}
      >
        {overallPct}%
      </text>
    </svg>

    {/* Legend below the donut */}
    {showLegend && wedges.length > 0 && (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-2">
        {wedges.map((w, idx) => (
          <span
            key={`${w.name}-${idx}`}
            className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"
          >
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: w.color }}
            />
            {w.name}
          </span>
        ))}
      </div>
    )}

    {/* Custom hover tooltip — fixed-positioned so it escapes any overflow
        context and follows the cursor across wedge layers. */}
    {hover && (
      <div
        className="fixed z-50 pointer-events-none rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg"
        style={{
          left: Math.max(8, hover.x - 80),
          top: hover.y > 80 ? hover.y - 64 : hover.y + 16,
          minWidth: 140,
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ background: hover.wedge.color }}
          />
          <span className="text-xs font-semibold">{hover.wedge.name}</span>
        </div>
        <p className="text-[15px] font-bold tabular-nums leading-tight">
          {Math.round(hover.wedge.pct * 100)}%
          {hover.wedge.pct > 1 && (
            <span className="text-[10px] font-medium text-rose-500 ml-1">
              over
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {formatCurrency(hover.wedge.spent)} of {formatCurrency(hover.wedge.limit)}
        </p>
      </div>
    )}
    </div>
  );
}
