"use client";

import { useMemo, useState } from "react";
import { Trash2, TrendingDown, TrendingUp, Minus, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { energyTrend, kgToLb, lbToKg, round, weightPace } from "@/lib/calc";
import { todayISO } from "@/lib/dates";
import { Gran, buildSeries, windowFor } from "@/lib/period";
import { toTitleCase } from "@/lib/text";
import { Empty, PageHeader, PeriodControls, fmt } from "./ui";
import { ChartCard } from "./charts";

// One tone and icon per trend direction, shared by every pace row.
const toneOf = (status: string) => (status.startsWith("Gaining") ? "text-bad" : status.startsWith("Losing") ? "text-good" : status === "Maintaining" ? "text-mid" : "text-subtle");
const iconOf = (status: string) => (status.startsWith("Gaining") ? TrendingUp : status.startsWith("Losing") ? TrendingDown : Minus);

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
  const tgt = profile.targetWeightKg != null ? conv(profile.targetWeightKg) : null;
  const wByDate = useMemo(() => new Map(sorted.map((w) => [w.date, w.weightKg])), [sorted]);
  const [gran, setGran] = useState<Gran>("month");
  const [anchor, setAnchor] = useState(todayISO());
  const series = useMemo(() => buildSeries(windowFor(gran, anchor, 30), (d) => { const k = wByDate.get(d); return k == null ? null : conv(k); }), [gran, anchor, wByDate, imperial]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = sorted[sorted.length - 1];
  const num = Number(val);
  const valid = val !== "" && num > 0 && num < 1000;

  let eta: string | null = null;
  if (latest && tgt != null && pace.kgPerWeek) {
    const remaining = profile.targetWeightKg! - latest.weightKg;
    const weeks = remaining / pace.kgPerWeek;
    if (weeks > 0 && weeks < 520) eta = `At this pace you'd reach your target in about ${Math.ceil(weeks)} week(s).`;
    else if (Math.abs(remaining) > 0.1) eta = "Current trend is moving away from your target.";
  }

  // The two estimates side by side: regression over logged weights, and the energy balance from submitted days.
  const perWeek = (k: number | null) => (k == null ? "—" : `${k > 0 ? "+" : ""}${round(conv(k), 2)} ${unit}/week`);
  const paceRows = [
    {
      id: "weight", method: "Weight logs", status: pace.status, kgPerWeek: pace.kgPerWeek,
      basis: `Regression line through ${sorted.length} weigh-in${sorted.length === 1 ? "" : "s"}`,
      note: pace.kgPerWeek == null ? "Log at least two weights on different dates." : null,
    },
    {
      id: "energy", method: "Energy balance", status: trend.status, kgPerWeek: kgw,
      basis: `Intake minus maintenance (${trend.tdee} kcal) and workouts, over ${trend.days} submitted day(s)`,
      note: trend.status === "Not enough data" ? `Submit at least 3 days of meals to see a trend.` : `Average ${trend.avgNet! > 0 ? "+" : ""}${Math.round(trend.avgNet!)} kcal/day. About 7,700 kcal ≈ 1 kg.`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Weight Tracking" subtitle="Logging weight updates BMI, BMR and calorie targets instantly." />
      <div className="grid gap-4 md:grid-cols-2">
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); if (!valid) return; addWeight(date, round(imperial ? lbToKg(num) : num, 2)); setVal(""); }}>
          <h3 className="font-semibold">{toTitleCase("Log weight")}</h3>
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
          <h3 className="font-semibold">{toTitleCase("Goal")}</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className="label" htmlFor="tw">Target weight ({unit})</label><input id="tw" type="number" step="0.1" min="0" className="input" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            <button className="btn-primary" onClick={() => { const n = Number(target); setProfile({ targetWeightKg: target !== "" && n > 0 ? round(imperial ? lbToKg(n) : n, 2) : null }); }}>Set</button>
          </div>
          {eta && <p className="text-sm text-subtle">{eta}</p>}
          {latest && <p className="text-sm">Current: <b>{fmt(conv(latest.weightKg), 1)} {unit}</b>{tgt != null && <> · To goal: <b>{fmt(Math.abs(tgt - conv(latest.weightKg)), 1)} {unit}</b></>}</p>}
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <h3 className="font-semibold">{toTitleCase("Pace comparison")}</h3>
          <p className="text-xs text-subtle">Two independent estimates of how fast your weight is moving.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-subtle">
              <tr><th className="pb-2 font-medium">Method</th><th className="pb-2 font-medium">Trend</th><th className="pb-2 text-right font-medium">Pace</th><th className="pb-2 font-medium">Basis</th></tr>
            </thead>
            <tbody>
              {paceRows.map((r) => {
                const Icon = iconOf(r.status);
                return (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3 font-semibold">{r.method}</td>
                    <td className={`py-2 pr-3 ${toneOf(r.status)}`}><span className="flex items-center gap-1.5"><Icon size={16} />{toTitleCase(r.status)}</span></td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">{perWeek(r.kgPerWeek)}</td>
                    <td className="py-2 text-xs text-subtle">{r.basis}{r.note && <span className="block">{r.note}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface/90 p-3"><PeriodControls gran={gran} anchor={anchor} setGran={setGran} setAnchor={setAnchor} trail={30} /></div>
      <ChartCard title="Weight" subtitle={`${unit} · ${gran === "year" ? "monthly averages" : "logged weigh-ins"}`} icon={<Scale size={18} />} color="rgb(var(--brand))" unit={unit} decimals={1} autoRange data={series} goal={tgt != null ? round(tgt, 1) : null} goalLabel="Target" />

      <div className="card">
        <h3 className="mb-2 font-semibold">{toTitleCase("History")}</h3>
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
