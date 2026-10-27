"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SeriesPoint } from "@/lib/period";
import { Section } from "./ui";
import { ReactNode } from "react";

/** Fixed-size curvy line chart card; every chart in the app uses this so they line up. */
export function ChartCard({ title, subtitle, icon, color, data, unit, goal, goalLabel, decimals = 0, right, autoRange = false }: {
  title: string; subtitle?: string; icon: ReactNode; color: string; data: SeriesPoint[]; unit?: string; goal?: number | null; goalLabel?: string; decimals?: number; right?: ReactNode; autoRange?: boolean;
}) {
  const has = data.some((d) => d.value != null);
  const rows = data.map((d) => ({ label: d.label, v: d.value == null ? null : +d.value.toFixed(decimals + 1) }));
  const dense = rows.length > 15;
  const vals = [...rows.map((r) => r.v).filter((v): v is number => v != null), ...(goal != null ? [goal] : [])];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, hi === lo ? Math.max(1, Math.abs(hi) * 0.1) : 0);
  const step = (v: number) => (decimals > 0 || hi - lo < 10 ? +v.toFixed(1) : Math.round(v));
  const domain: [number, number] = vals.length ? [step(lo >= 0 ? Math.max(0, lo - pad) : lo - pad), step(hi + pad)] : [0, 1];
  return (
    <Section title={title} subtitle={subtitle} icon={icon} right={right} className="w-full">
      <div className="h-72 w-full">
        {has ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--subtle))" }} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
              <YAxis tick={{ fontSize: 11, fill: "rgb(var(--subtle))" }} width={46} domain={domain} />
              <Tooltip
                contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12 }}
                labelStyle={{ color: "rgb(var(--fg))" }} itemStyle={{ color: "rgb(var(--fg))" }}
                formatter={(v: number) => [`${v}${unit ? ` ${unit}` : ""}`, title]}
              />
              {goal != null && <ReferenceLine y={goal} stroke={color} strokeDasharray="6 4" strokeOpacity={0.7} label={{ value: goalLabel ?? "Goal", fill: "rgb(var(--subtle))", fontSize: 11, position: "insideTopRight" }} />}
              <Line type="natural" dataKey="v" stroke={color} strokeWidth={3} dot={{ r: dense ? 2 : 4, fill: color }} activeDot={{ r: 6 }} connectNulls isAnimationActive />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-subtle">No data in this period yet</div>
        )}
      </div>
    </Section>
  );
}
