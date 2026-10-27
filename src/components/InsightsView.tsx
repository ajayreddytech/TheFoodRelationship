"use client";

import { useMemo, useState } from "react";
import { BarChart3, Check, Cookie, Hand, Salad, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Gran, buildSeries, windowFor } from "@/lib/period";
import { addDays, datesBetween, parseISODate, todayISO } from "@/lib/dates";
import { dayPoints, extraInsights, summarize, calorieTarget, DayPoint } from "@/lib/analytics";
import { fmt, PageHeader, PeriodControls, Section } from "./ui";
import { ChartCard } from "./charts";
import { GYR_STYLE, METRICS, MetricKind, MetricIcon } from "./icons";

type Cell = { date: string; point?: DayPoint; future: boolean };

function Heatmap({ kind, gran, from, to, points }: { kind: "gyr" | "nibbles"; gran: Gran; from: string; to: string; points: DayPoint[] }) {
  const map = new Map(points.map((p) => [p.date, p]));
  const today = todayISO();
  const mk = (date: string): Cell => ({ date, point: map.get(date), future: date > today });
  const big = gran !== "year";
  const style = (c: Cell) => {
    const p = c.point;
    if (c.future || !p?.logged) return "bg-muted/60";
    if (kind === "gyr") return p.gyr ? GYR_STYLE[p.gyr].solid : "bg-muted";
    return p.nibbles == null ? "bg-muted" : p.nibbles ? "bg-bad" : "bg-good";
  };
  const icon = (c: Cell, size: number) => {
    const p = c.point;
    if (!p?.logged || c.future) return null;
    if (kind === "gyr") return p.gyr ? <Salad size={size} className="text-white" /> : null;
    if (p.nibbles == null) return null;
    return (
      <span className="relative text-white">{p.nibbles ? <Cookie size={size} /> : <Hand size={size} />}{p.nibbles ? <X size={size * 0.7} strokeWidth={3} className="absolute -bottom-1 -right-1 rounded-full bg-bad" /> : <Check size={size * 0.7} strokeWidth={3} className="absolute -bottom-1 -right-1 rounded-full bg-good" />}</span>
    );
  };
  const title = (c: Cell) => {
    const p = c.point;
    const v = !p?.logged ? "no data" : kind === "gyr" ? (p.gyr ? GYR_STYLE[p.gyr].hint : "not set") : p.nibbles == null ? "not set" : p.nibbles ? "Had nibbles" : "No nibbles";
    return `${c.date}: ${v}`;
  };

  if (gran === "year") {
    const start = addDays(from, -parseISODate(from).getDay());
    const all = datesBetween(start, to);
    const cols = Math.ceil(all.length / 7);
    return (
      <div className="grid w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: "repeat(7, 1fr)", gridAutoFlow: "column", aspectRatio: `${cols} / 7`, maxHeight: "16rem" }}>
        {all.map((d) => { const c = mk(d); return <div key={d} className={`group relative rounded-[3px] hover:z-20 ${d < from ? "pointer-events-none opacity-0" : style(c)}`}><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-fg shadow-lg group-hover:block">{title(c)}</span></div>; })}
      </div>
    );
  }
  if (gran === "month") {
    const lead = parseISODate(from).getDay();
    const days = datesBetween(from, to);
    return (
      <div className="grid w-full grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {days.map((d) => { const c = mk(d); return (
          <div key={d} className={`group relative grid aspect-[3/2] place-items-center rounded-lg hover:z-20 ${style(c)}`}><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-fg shadow-lg group-hover:block">{title(c)}</span>
            <span className="absolute left-1 top-0.5 text-[9px] text-white/70 mix-blend-difference">{parseISODate(d).getDate()}</span>{icon(c, 14)}
          </div>); })}
      </div>
    );
  }
  const days = datesBetween(from, to);
  return (
    <div className="grid h-full w-full gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((d) => { const c = mk(d); return (
        <div key={d} className={`group relative flex min-h-[8rem] flex-col items-center justify-center gap-1 rounded-xl ${style(c)}`}>
          {icon(c, 24)}
          <span className="text-[11px] font-medium text-fg/80">{parseISODate(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
        </div>); })}
    </div>
  );
}

function Stat({ kind, label, value, sub }: { kind?: MetricKind; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs text-subtle">{kind && <MetricIcon kind={kind} />}{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-subtle">{sub}</div>}
    </div>
  );
}

export function InsightsView() {
  const { logs, profile } = useStore();
  const [gran, setGran] = useState<Gran>("week");
  const [anchor, setAnchor] = useState(todayISO());
  const w = windowFor(gran, anchor, 7);
  const hw = windowFor(gran, anchor, 1);
  const today = todayISO();

  const points = useMemo(() => dayPoints(logs, w.from, w.to), [logs, w.from, w.to]);
  const sum = useMemo(() => summarize(points.filter((p) => p.date <= today)), [points, today]);
  const tiles = useMemo(() => extraInsights(points.filter((p) => p.date <= today), profile), [points, profile, today]);
  const byDate = useMemo(() => new Map(points.map((p) => [p.date, p])), [points]);
  const series = (pick: (p: DayPoint) => number | null) => buildSeries(w, (d) => { const p = byDate.get(d); return p ? pick(p) : null; });
  const goalFor = (g: number) => g;

  const pctOf = (n: number, t: number) => (t ? `${Math.round((n / t) * 100)}%` : "—");
  const days = (n: number | null, d = 0, u = "") => (n == null ? "—" : `${fmt(n, d)}${u}`);

  return (
    <div className="space-y-5 pb-28">
      <PageHeader title="Insights & Graphs" subtitle="Running averages over the days you've logged" />
      <div className="sticky top-0 z-20 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur"><PeriodControls gran={gran} anchor={anchor} setGran={setGran} setAnchor={setAnchor} /></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat kind="intake" label="Avg intake" value={days(sum.avgIntake, 0, " kcal")} sub={`Goal ${calorieTarget(profile)}`} />
        <Stat kind="expenditure" label="Avg expenditure" value={days(sum.avgExpenditure, 0, " kcal")} />
        <Stat kind="hydration" label="Avg hydration" value={days(sum.avgHydration, 1, " L")} />
        <Stat kind="fast" label="Avg fasting" value={days(sum.avgFasting, 1, " h")} />
        <Stat label="Avg Green (Satvik)" value={pctOf(sum.gyr.green, sum.gyrTotal)} sub={`${sum.gyr.green} days`} />
        <Stat label="Avg Yellow" value={pctOf(sum.gyr.yellow, sum.gyrTotal)} sub={`${sum.gyr.yellow} days`} />
        <Stat label="Avg Red (Tamasik)" value={pctOf(sum.gyr.red, sum.gyrTotal)} sub={`${sum.gyr.red} days`} />
        <Stat kind="nibbles" label="No-nibble score" value={pctOf(sum.nibblesNo, sum.nibblesTotal)} sub={`${sum.nibblesNo} no-nibble days · ${sum.nibblesYes} with nibbles`} />
      </div>
      <p className="-mt-3 text-xs text-subtle">Based on {sum.days} logged day(s) up to today in this period.</p>

      {tiles.length > 0 && (
        <Section title="More insights" icon={<BarChart3 size={18} />}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.id} className={`rounded-2xl border p-3 ${t.tone === "good" ? "border-good/40 bg-good/10" : t.tone === "warn" ? "border-mid/50 bg-mid/10" : t.tone === "bad" ? "border-bad/40 bg-bad/10" : "border-line bg-muted/40"}`}>
                <div className="text-xs text-subtle">{t.label}</div>
                <div className="font-bold">{t.value}</div>
                {t.hint && <div className="text-[11px] text-subtle">{t.hint}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <ChartCard title="Intake" subtitle="kcal per day" icon={<MetricIcon kind="intake" size={18} />} color={METRICS.intake.hex} unit="kcal" data={series((p) => p.intake)} goal={goalFor(calorieTarget(profile))} goalLabel="TDEE" />
      <ChartCard title="Expenditure" subtitle="kcal burned per day" icon={<MetricIcon kind="expenditure" size={18} />} color={METRICS.expenditure.hex} unit="kcal" data={series((p) => p.expenditure)} goal={profile.expenditureGoal} />
      <ChartCard title="Hydration" subtitle="litres per day" icon={<MetricIcon kind="hydration" size={18} />} color={METRICS.hydration.hex} unit="L" decimals={1} data={series((p) => p.hydration)} goal={profile.hydrationGoalL} />
      <ChartCard title="Fasting hours" subtitle="hours fasted per day" icon={<MetricIcon kind="fast" size={18} />} color={METRICS.fast.hex} unit="h" decimals={1} data={series((p) => p.fasting)} goal={profile.fastingGoalH} />

      <Section title="GYR heatmap" subtitle="Satvik · In between · Tamasik" icon={<MetricIcon kind="gyr" size={18} />} className="w-full">
        <div className="flex w-full items-center"><Heatmap kind="gyr" gran={gran} from={hw.from} to={hw.to} points={points} /></div>
      </Section>
      <Section title="Nibbles heatmap" subtitle="Green check = no nibbles · Red cross = nibbles" icon={<MetricIcon kind="nibbles" size={18} />} className="w-full">
        <div className="flex w-full items-center"><Heatmap kind="nibbles" gran={gran} from={hw.from} to={hw.to} points={points} /></div>
      </Section>
    </div>
  );
}
