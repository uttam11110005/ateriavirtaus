"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtDate, fmtShort } from "@/lib/dates";

const C = {
  forecast: "var(--color-series-forecast)",
  served: "var(--color-series-served)",
  surplus: "var(--color-series-surplus)",
  grid: "#ebe8e2",
  axis: "#8a857d",
};

const axisProps = {
  tick: { fill: C.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

function Tip({ active, payload, label, unit = "meals" }: Partial<TooltipContentProps<number, string>> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-[0_12px_28px_-14px_rgba(28,27,25,0.35)]">
      <div className="mb-1 font-medium text-ink">{typeof label === "string" && label.length === 10 ? fmtDate(label) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.name}
          </span>
          <span className="num font-medium text-ink">
            {typeof p.value === "number" ? p.value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : p.value}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dashed ? "4 3" : undefined} strokeLinecap="round" />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ForecastServedChart({
  data,
  height = 260,
}: {
  data: { date: string; forecast: number; served: number }[];
  height?: number;
}) {
  const min = Math.min(...data.flatMap((d) => [d.forecast, d.served]));
  const max = Math.max(...data.flatMap((d) => [d.forecast, d.served]));
  const pad = Math.max(2, Math.round((max - min) * 0.15));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="date" tickFormatter={fmtShort} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} domain={[Math.max(0, min - pad), max + pad]} width={48} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} />
        <Line
          name="Forecast"
          type="monotone"
          dataKey="forecast"
          stroke={C.forecast}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }}
          isAnimationActive={false}
        />
        <Line
          name="Served"
          type="monotone"
          dataKey="served"
          stroke={C.served}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DailyBars({
  data,
  dataKey,
  name,
  unit = "meals",
  highlightKey,
  height = 200,
}: {
  data: Record<string, number | string>[];
  dataKey: string;
  name: string;
  unit?: string;
  highlightKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="date" tickFormatter={fmtShort} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={48} allowDecimals={false} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "rgba(28,27,25,0.04)" }} />
        <Bar name={name} dataKey={dataKey} fill={C.surplus} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {highlightKey &&
            data.map((d, i) => <Cell key={i} fill={C.surplus} fillOpacity={Number(d[highlightKey]) > 0 ? 1 : 0.55} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars with direct labels — used for ranked categories. */
export function RankBars({
  rows,
  format = (n) => String(n),
  tone = "surplus",
}: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  tone?: "surplus" | "forecast" | "served";
}) {
  const max = Math.max(1e-9, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{r.label}</span>
            <span className="num shrink-0 font-medium text-ink">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 font-normal text-ink-3">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-sunken">
            <div
              className="h-2 rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: C[tone] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
