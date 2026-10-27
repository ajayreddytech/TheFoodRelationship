"use client";

import { useMemo, useState } from "react";
import { Trash2, TrendingDown, TrendingUp, Minus, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { energyTrend, kgToLb, lbToKg, round, weightPace } from "@/lib/calc";
import { todayISO } from "@/lib/dates";
import { Gran, buildSeries, windowFor } from "@/lib/period";
import { Empty, PageHeader, PeriodControls, fmt } from "./ui";
import { ChartCard } from "./charts";

export function WeightView() {
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const { addWeight, removeWeight, setProfile } = useStore.getState();
  const imperial = profile.unitSystem === "imperial";
  const unit = imperial ? "lbs" : "kg";
  const conv = (kg: number) => (imperial ? kgToLb(kg) : kg);
  const [date, setDate] = useState(todayISO());
  const [val, setVal] = useState("");
  const [target, setTarget] = useState(profile.targetWeightKg != null ? String(round(conv(profile.targetWeightKg), 1)) : "");

  const sorted = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)), [weights]);
  const logs = useStore((s) => s.logs);
  const pace = weightPace(sorted);
  const trend = useMemo(() => energyTrend(logs, profile, todayISO()), [logs, profile]);
  const kgw = trend.kgPerWeek;
  const TrendIcon = trend.status === "Gaining weight" ? TrendingUp : trend.status === "Losing weight" ? TrendingDown : Minus;
  const trendCls = trend.status === "Gaining weight" ? "text-bad" : trend.status === "Losing weight" ? "text-good" : trend.status === "Maintaining" ? "text-mid" : "text-subtle";
  const tgt = profile.targetWeightKg != null ? conv(profile.targetWeightKg) : null;
  const wByDate = useMemo(() => new Map(sorted.map((w) => [w.date, w.weightKg])), [sorted]);
  const [gran, setGran] = useState<Gran>("month");
  const [anchor, setAnchor] = useState(todayISO());
  const series = useMemo(() => buildSeries(windowFor(gran, anchor, 30), (d) => { const k = wByDate.get(d); return k == null ? null : conv(k); }), [gran, anchor, wByDate, imperial]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = sorted[sorted.length - 1];
  const num = Number(val);
  const valid = val !== "" && num > 0 && num < 1000;
  const Icon = pace.status === "Gaining Weight" ? TrendingUp : pace.status === "Losing Weight" ? TrendingDown : Minus;

  let eta: string | null = null;
  if (latest && tgt != null && pace.kgPerWeek) {
    const remaining = profile.targetWeightKg! - latest.weightKg;
    const weeks = remaining / pace.kgPerWeek;
    if (weeks > 0 && weeks < 520) eta = `At this pace you'd reach your target in about ${Math.ceil(weeks)} week(s).`;
    else if (Math.abs(remaining) > 0.1) eta = "Current trend is moving away from your target.";
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Weight Tracking" subtitle="Logging weight updates BMI, BMR and calorie targets instantly." />
      <div className="grid gap-4 md:grid-cols-2">
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); if (!valid) return; addWeight(date, round(imperial ? lbToKg(num) : num, 2)); setVal(""); }}>
          <h3 className="font-semibold">Log weight</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="wd">Date</label><input id="wd" type="date" max={todayISO()} className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
            <div><label className="label" htmlFor="wv">Weight ({unit})</label><input id="wv" type="number" step="0.1" min="0" className="input" value={val} onChange={(e) => setVal(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={!valid}>Add</button>
            <div className="ml-auto flex rounded-xl bg-muted p-1 text-sm">
              {(["metric", "imperial"] as const).map((u) => (
                <button type="button" key={u} onClick={() => { setProfile({ unitSystem: u }); setTarget(profile.targetWeightKg != null ? String(round(u === "imperial" ? kgToLb(profile.targetWeightKg) : profile.targetWeightKg, 1)) : ""); }}
                  className={`rounded-lg px-3 py-1 ${profile.unitSystem === u ? "bg-brand text-white" : "text-subtle"}`}>{u === "metric" ? "kg" : "lbs"}</button>))}
            </div>
          </div>
        </form>
        <div className="card space-y-3">
          <h3 className="font-semibold">Goal</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className="label" htmlFor="tw">Target weight ({unit})</label><input id="tw" type="number" step="0.1" min="0" className="input" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            <button className="btn-primary" onClick={() => { const n = Number(target); setProfile({ targetWeightKg: target !== "" && n > 0 ? round(imperial ? lbToKg(n) : n, 2) : null }); }}>Set</button>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <Icon className="text-brand" />
            <div>
              <div className="font-semibold">{pace.status}</div>
              <div className="text-sm text-subtle">{pace.kgPerWeek == null ? "Log at least two weights on different dates." : `${pace.kgPerWeek > 0 ? "+" : ""}${round(conv(pace.kgPerWeek), 2)} ${unit}/week`}</div>
            </div>
          </div>
          {eta && <p className="text-sm text-subtle">{eta}</p>}
          {latest && <p className="text-sm">Current: <b>{fmt(conv(latest.weightKg), 1)} {unit}</b>{tgt != null && <> · To goal: <b>{fmt(Math.abs(tgt - conv(latest.weightKg)), 1)} {unit}</b></>}</p>}
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-4">
        <TrendIcon className={trendCls} size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-subtle">Pace from your calories (intake − maintenance − workouts)</div>
          <div className={`text-xl font-bold ${trendCls}`}>
            {trend.status}
            {kgw != null && trend.status !== "Maintaining" && <span className="ml-2 text-base font-semibold text-fg">{Math.abs(round(conv(kgw), 2))} {unit}/week</span>}
          </div>
          <p className="text-sm text-subtle">
            {trend.status === "Not enough data" ? `Submit at least 3 days of meals to see a trend (${trend.days} so far).` : `Average of ${trend.days} submitted day(s): ${trend.avgNet! > 0 ? "+" : ""}${Math.round(trend.avgNet!)} kcal/day vs maintenance ${trend.tdee} kcal plus workouts. About 7,700 kcal ≈ 1 kg.`}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface/90 p-3"><PeriodControls gran={gran} anchor={anchor} setGran={setGran} setAnchor={setAnchor} trail={30} /></div>
      <ChartCard title="Weight" subtitle={`${unit} · ${gran === "year" ? "monthly averages" : "logged weigh-ins"}`} icon={<Scale size={18} />} color="rgb(var(--brand))" unit={unit} decimals={1} autoRange data={series} goal={tgt != null ? round(tgt, 1) : null} goalLabel="Target" />

      <div className="card">
        <h3 className="mb-2 font-semibold">History</h3>
        {sorted.length === 0 && <Empty>No weights logged yet.</Empty>}
        {sorted.length > 0 && (
          <ul className="mt-3 max-h-48 divide-y divide-line overflow-auto text-sm">
            {[...sorted].reverse().map((w) => (
              <li key={w.date} className="flex items-center justify-between py-1.5"><span>{w.date}</span><span className="flex items-center gap-3">{fmt(conv(w.weightKg), 1)} {unit}
                <button aria-label={`Delete ${w.date}`} className="text-subtle hover:text-bad" onClick={() => removeWeight(w.date)}><Trash2 size={14} /></button></span></li>))}
          </ul>
        )}
      </div>
    </div>
  );
}
