"use client";

import { ResponsiveContainer, Sankey } from "recharts";
import { PALETTE } from "@/lib/format";

export interface CashFlowItem {
  name: string;
  amount: number;
  color?: string;
}

const MAX_CATEGORIES = 6;
const MIDDLE = "Total in";
// Side margin reserved for node labels, and vertical gap between nodes (a
// two-line label needs ~26px). One place, so the two stay consistent.
const LABEL_GUTTER = 76;
const NODE_PADDING = 28;

const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;

const clip = (s: string, max = 13) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

interface NodeMeta {
  name: string;
  value: number;
  color: string;
}

/**
 * Income → total → spending Sankey. Income sources flow into one "Total in"
 * node, which fans out to the biggest spending categories (the rest folded
 * into "Other") plus "Left over" when you took in more than you spent. When
 * spending exceeded income, a "From savings" source balances the left side,
 * since a Sankey's inflow and outflow must match.
 */
export function CashFlowSankey({
  incomeSources,
  spending,
  height = 400,
}: {
  incomeSources: CashFlowItem[];
  spending: CashFlowItem[];
  height?: number;
}) {
  const sources = incomeSources.filter((s) => s.amount > 0);
  const sortedSpend = spending.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount);
  const income = sources.reduce((t, s) => t + s.amount, 0);
  const expenses = sortedSpend.reduce((t, s) => t + s.amount, 0);

  const head = sortedSpend.slice(0, MAX_CATEGORIES);
  const otherAmount = sortedSpend.slice(MAX_CATEGORIES).reduce((t, s) => t + s.amount, 0);

  const left: NodeMeta[] = sources.map((s) => ({ name: s.name, value: s.amount, color: PALETTE.emerald }));
  if (expenses > income) {
    left.push({ name: "From savings", value: expenses - income, color: PALETTE.red });
  }
  const right: NodeMeta[] = head.map((s) => ({
    name: s.name,
    value: s.amount,
    color: s.color ?? PALETTE.gray,
  }));
  if (otherAmount > 0) right.push({ name: "Other", value: otherAmount, color: PALETTE.gray });
  if (income > expenses) right.push({ name: "Left over", value: income - expenses, color: PALETTE.purple });

  if (left.length === 0 || right.length === 0) return null;

  const total = Math.max(income, expenses);
  const meta: NodeMeta[] = [...left, { name: MIDDLE, value: total, color: PALETTE.gray }, ...right];
  const middleIndex = left.length;
  const colorByName = new Map(meta.map((n) => [n.name, n.color]));

  const data = {
    nodes: meta.map((n) => ({ name: n.name })),
    links: [
      ...left.map((n, i) => ({ source: i, target: middleIndex, value: n.value })),
      ...right.map((n, i) => ({ source: middleIndex, target: middleIndex + 1 + i, value: n.value })),
    ],
  };

  const leftCount = left.length;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={NODE_PADDING}
        nodeWidth={10}
        // Labels live in the side margins, outside the flows, so they can
        // never sit on top of a link or a neighbouring node.
        margin={{ top: 24, right: LABEL_GUTTER, bottom: 24, left: LABEL_GUTTER }}
        link={(props) => {
          const { sourceX, targetX, sourceY, targetY, linkWidth, payload } = props;
          // Tint each flow by the non-middle end so colors read as
          // "this source" / "this category".
          const tint = payload.target.name === MIDDLE ? payload.source.name : payload.target.name;
          // Filled ribbon rather than a thick stroke: a wide stroke on a
          // steep curve pinches into cusps at the bend.
          const h = linkWidth / 2;
          const mx = (sourceX + targetX) / 2;
          return (
            <path
              d={`M${sourceX},${sourceY - h}C${mx},${sourceY - h} ${mx},${targetY - h} ${targetX},${targetY - h}L${targetX},${targetY + h}C${mx},${targetY + h} ${mx},${sourceY + h} ${sourceX},${sourceY + h}Z`}
              fill={colorByName.get(tint) ?? PALETTE.gray}
              fillOpacity={0.3}
            />
          );
        }}
        node={(props) => {
          const m = meta[props.index];
          if (!m) return <g />;
          const isMiddle = props.index === middleIndex;
          const isLeft = props.index < leftCount;
          const cy = props.y + props.height / 2;
          const label = isMiddle ? (
            <text x={props.x + props.width / 2} y={props.y - 8} textAnchor="middle" fontSize={11}>
              <tspan style={{ fill: "var(--foreground)" }}>{m.name} </tspan>
              <tspan style={{ fill: "var(--muted-foreground)" }}>{compact(m.value)}</tspan>
            </text>
          ) : (
            <text
              x={isLeft ? props.x - 6 : props.x + props.width + 6}
              y={cy}
              textAnchor={isLeft ? "end" : "start"}
              fontSize={10}
            >
              <tspan x={isLeft ? props.x - 6 : props.x + props.width + 6} dy="-0.2em" style={{ fill: "var(--foreground)" }}>
                {clip(m.name)}
              </tspan>
              <tspan
                x={isLeft ? props.x - 6 : props.x + props.width + 6}
                dy="1.25em"
                style={{ fill: "var(--muted-foreground)" }}
              >
                {compact(m.value)}
              </tspan>
            </text>
          );
          return (
            <g>
              <rect x={props.x} y={props.y} width={props.width} height={props.height} fill={m.color} rx={2} />
              {label}
            </g>
          );
        }}
      />
    </ResponsiveContainer>
  );
}
