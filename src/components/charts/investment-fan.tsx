"use client";

import { useState } from "react";
import { formatCurrency, CATEGORICAL_COLORS } from "@/lib/format";

/**
 * One investment "category" (e.g., Securities, Real Estate) shown as a fan
 * of stacked half-arcs. Larger categories extend into more concentric stripes.
 */
export interface FanDatum {
  name: string;
  value: number;
  color: string;
}

/**
 * Temporary demo dataset used until real investment accounts are linked.
 * Mirrors the reference design (Business / Securities / Gold / Real estate
 * / Cryptocurrency, $89,000 total).
 */
export const DEMO_INVESTMENT_DATA: FanDatum[] = [
  { name: "Business", value: 32000, color: "#7c3aed" },     // purple
  { name: "Securities", value: 24000, color: "#a855f7" },   // violet
  { name: "Gold", value: 17000, color: "#fbbf24" },         // yellow
  { name: "Real estate", value: 11000, color: "#c4b5fd" },  // light purple
  { name: "Cryptocurrency", value: 5000, color: "#ef4444" },// red
];

interface FanProps {
  data: FanDatum[];
  /** Outer chart height in px. */
  height?: number;
  /** Outer chart width in px (or auto-fit). */
  width?: number;
  /** Inner radius of the innermost stripe. */
  innerRadius?: number;
  /** Outer radius of the outermost stripe. */
  outerRadius?: number;
  /** Maximum stripes a single category can extend into. */
  maxStripes?: number;
  /** Show legend below the chart. */
  showLegend?: boolean;
}

/**
 * Compute how many stripes a category extends into. Scales relative to the
 * LARGEST category in the dataset so the biggest investment gets the full
 * `max` stripes and smaller ones scale down — matching the reference fan
 * design where dominant categories have many concentric arcs and tiny ones
 * have a single thin wedge.
 */
function stripesForCategory(value: number, maxValue: number, max: number): number {
  if (maxValue <= 0 || value <= 0) return 0;
  return Math.max(1, Math.min(max, Math.ceil((value / maxValue) * max)));
}

/** Convert a polar coordinate to an SVG x/y point (y is inverted). */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/**
 * Build an SVG path for an annular sector (a thick arc segment) bounded by
 * two radii and two angles. Angles are in degrees, measured CCW from the
 * positive x-axis (3 o'clock = 0, 12 o'clock = 90, 9 o'clock = 180).
 */
function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polar(cx, cy, outerR, startAngle);
  const outerEnd = polar(cx, cy, outerR, endAngle);
  const innerEnd = polar(cx, cy, innerR, endAngle);
  const innerStart = polar(cx, cy, innerR, startAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  // sweepFlag=0 sweeps clockwise in SVG screen coords; we draw from startAngle
  // (larger) to endAngle (smaller) along the top of the half-circle, which is
  // a clockwise sweep on screen since y is inverted.
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export function InvestmentFan({
  data,
  height = 160,
  width = 320,
  innerRadius = 30,
  outerRadius,
  maxStripes = 5,
  showLegend = true,
}: FanProps) {
  // Hover tooltip state — declared before any early returns to satisfy React
  // hooks ordering rules.
  const [hover, setHover] = useState<{
    wedge: { name: string; value: number; color: string };
    x: number;
    y: number;
  } | null>(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  const maxValue = data.reduce((m, d) => Math.max(m, d.value), 0);
  if (total === 0 || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground">No data</p>
      </div>
    );
  }

  // Auto-size outer radius based on chart height if not given.
  const actualOuter = outerRadius ?? height - 20;

  // Layout — center the half-donut at bottom-middle so the half arc opens upward.
  const cx = width / 2;
  const cy = height - 4;

  // Angular wedge per category: total 180° spanning from 180° to 0°.
  // We leave a small angular gap between wedges for visual separation.
  const ANGULAR_GAP = 2; // degrees between adjacent category wedges
  const usableSweep = 180 - ANGULAR_GAP * (data.length - 1);

  // Stripe sizing — each category gets up to `maxStripes` thin arcs.
  const STRIPE_GAP = 2; // px between stripes within a category
  const stripeBand = (actualOuter - innerRadius) / maxStripes; // band height per stripe slot

  // Compute angular positions immutably via reduce so each wedge knows where
  // the previous one ended without mutating a captured variable.
  const wedges = data.reduce<
    Array<{ name: string; value: number; color: string; stripes: number; startAngle: number; endAngle: number }>
  >((acc, d, i) => {
    const prevEnd = acc.length === 0 ? 180 : acc[acc.length - 1].endAngle - ANGULAR_GAP;
    const share = d.value / total;
    const angularWidth = share * usableSweep;
    const stripes = stripesForCategory(d.value, maxValue, maxStripes);
    acc.push({
      ...d,
      color: d.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
      stripes,
      startAngle: prevEnd,
      endAngle: prevEnd - angularWidth,
    });
    return acc;
  }, []);

  function handleEnter(
    e: React.MouseEvent<SVGElement>,
    wedge: { name: string; value: number; color: string }
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ wedge, x: r.left + r.width / 2, y: r.top });
  }

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ height }}
      >
        {wedges.map((w) => (
          <g
            key={w.name}
            onMouseEnter={(e) => handleEnter(e, w)}
            onMouseMove={(e) => handleEnter(e, w)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            {Array.from({ length: w.stripes }).map((_, stripeIdx) => {
              // stripeIdx 0 = innermost stripe, w.stripes-1 = outermost.
              const r1 = innerRadius + stripeIdx * stripeBand + STRIPE_GAP / 2;
              const r2 = innerRadius + (stripeIdx + 1) * stripeBand - STRIPE_GAP / 2;
              // Outer stripes more saturated for the "fan lifts" effect.
              const opacity = 0.4 + (stripeIdx / Math.max(w.stripes - 1, 1)) * 0.55;
              return (
                <path
                  key={stripeIdx}
                  d={annularSectorPath(cx, cy, r1, r2, w.startAngle, w.endAngle)}
                  fill={w.color}
                  fillOpacity={opacity}
                />
              );
            })}
          </g>
        ))}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1">
          {wedges.map((d) => (
            <span
              key={d.name}
              className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize"
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: d.color }}
              />
              {d.name.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Custom hover tooltip — fixed-positioned so it escapes any overflow
          context and floats above the hovered wedge. */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg"
          style={{
            left: Math.max(8, hover.x - 80),
            top: hover.y > 80 ? hover.y - 60 : hover.y + 16,
            minWidth: 140,
          }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: hover.wedge.color }}
            />
            <span className="text-xs font-semibold capitalize">
              {hover.wedge.name.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm font-bold tabular-nums leading-tight">
            {formatCurrency(hover.wedge.value)}
          </p>
          {total > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round((hover.wedge.value / total) * 100)}% of portfolio
            </p>
          )}
        </div>
      )}
    </div>
  );
}
