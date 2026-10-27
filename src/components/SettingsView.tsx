"use client";

import { useMemo, useState } from "react";
import { Activity, LogIn, LogOut, Moon, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { ACTIVITY_FACTORS, BMI_CLASSES, bmiClass, bmiCategory, calcAge, calcBMI, calcBMR, calcTDEE, cmToIn, inToCm, kgToLb, lbToKg, round } from "@/lib/calc";
import { signInWithGoogle, signOut, supabaseConfigured } from "@/lib/supabase";
import { todayISO } from "@/lib/dates";
import { ActivityLevel, Gender, Palette } from "@/lib/types";
import { PageHeader, fmt } from "./ui";
import { ChartCard } from "./charts";

function NumField({ id, label, value, onCommit, step = "any" }: { id: string; label: string; value: number; onCommit: (n: number) => void; step?: string }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="number" step={step} min="0" className="input" value={txt ?? String(value)}
        onChange={(e) => { setTxt(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && n > 0 && isFinite(n)) onCommit(n); }}
        onBlur={() => setTxt(null)} />
    </div>
  );
}

const PALETTES: { id: Palette; name: string; color: string }[] = [
  { id: "emerald", name: "Emerald", color: "#10b981" }, { id: "crimson", name: "Warm Crimson", color: "#e11d48" }, { id: "amber", name: "Amber", color: "#d97706" },
];
const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little exercise)", light: "Light (1-3 days/wk)", moderate: "Moderate (3-5 days/wk)", active: "Active (6-7 days/wk)", very_active: "Very active (physical job + training)",
};

export function SettingsView() {
  const s = useStore();
  const p = s.profile;
  const imperial = p.unitSystem === "imperial";
  const [authErr, setAuthErr] = useState<string | null>(null);
  const age = calcAge(p.dob);
  const bmi = calcBMI(p.weightKg, p.heightCm);
  const bmr = calcBMR(p);
  const tdee = calcTDEE(p);
  const bmiSeries = useMemo(() => [...s.weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ key: w.date, label: w.date.slice(5), value: calcBMI(w.weightKg, p.heightCm) })), [s.weights, p.heightCm]);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Your profile drives every target in the app." />

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Account</h2>
          <p className="text-sm text-subtle">{s.userEmail ? `Signed in as ${s.userEmail}. Data syncs to the cloud.` : supabaseConfigured ? "Guest mode — data is stored on this device." : "Guest mode — cloud sync unavailable (Supabase not configured)."}</p>
          {authErr && <p role="alert" className="mt-1 text-sm text-bad">{authErr}</p>}
        </div>
        {s.userEmail
          ? <button className="btn-ghost" onClick={() => signOut()}><LogOut size={16} />Sign out</button>
          : <button className="btn-primary" disabled={!supabaseConfigured} onClick={() => signInWithGoogle().catch((e) => setAuthErr(e.message))}><LogIn size={16} />Sign in with Google</button>}
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Health profile</h2>
        <div><label className="label" htmlFor="dob">Date of birth</label>
          <input id="dob" type="date" max={todayISO()} className="input" value={p.dob ?? ""} onChange={(e) => s.setProfile({ dob: e.target.value || null })} /></div>
        <div><label className="label" htmlFor="gender">Gender</label>
          <select id="gender" className="input" value={p.gender} onChange={(e) => s.setProfile({ gender: e.target.value as Gender })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
        <NumField key={"h" + p.unitSystem} id="height" label={`Height (${imperial ? "in" : "cm"})`} value={round(imperial ? cmToIn(p.heightCm) : p.heightCm, 1)} onCommit={(n) => s.setProfile({ heightCm: imperial ? inToCm(n) : n })} />
        <NumField key={"w" + p.unitSystem} id="weight" label={`Current weight (${imperial ? "lbs" : "kg"})`} value={round(imperial ? kgToLb(p.weightKg) : p.weightKg, 1)} onCommit={(n) => s.addWeight(todayISO(), round(imperial ? lbToKg(n) : n, 2))} />
        <div><label className="label" htmlFor="act">Activity level</label>
          <select id="act" className="input" value={p.activity} onChange={(e) => s.setProfile({ activity: e.target.value as ActivityLevel })}>
            {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}</select></div>
        <div><label className="label" htmlFor="units">Units</label>
          <select id="units" className="input" value={p.unitSystem} onChange={(e) => s.setProfile({ unitSystem: e.target.value as "metric" | "imperial" })}><option value="metric">Metric (cm, kg)</option><option value="imperial">Imperial (in, lbs)</option></select></div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["BMI", bmi == null ? "—" : `${fmt(bmi, 1)} · ${bmiCategory(bmi)}`], ["BMR", bmr == null ? "—" : `${fmt(bmr)} kcal`], ["Maintenance (TDEE)", tdee == null ? "Set DOB" : `${fmt(tdee)} kcal`], ["Age", age == null ? "—" : `${age}`]].map(([k, v]) => (
          <div key={k} className="card"><div className="text-xs text-subtle">{k}</div><div className="text-lg font-bold">{v}</div></div>))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">BMI classification</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BMI_CLASSES.map((c) => {
            const on = bmiClass(bmi)?.label === c.label;
            return (
              <div key={c.label} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${on ? "border-brand bg-brand/15 font-semibold" : "border-line"}`}>
                <span>{c.label}{on && " ← you"}</span><span className="tabular-nums text-subtle">{c.range}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-subtle">Your daily calorie goal equals your maintenance calories (TDEE){tdee != null ? `: ${fmt(tdee)} kcal` : ""}.</p>
      </section>

      <ChartCard title="BMI progress" subtitle="Calculated from every weight you have logged and your current height" icon={<Activity size={18} />} color="rgb(16 185 129)" data={bmiSeries} unit="BMI" decimals={1} goal={24.9} goalLabel="Healthy max 24.9" />

      <section className="card grid gap-3 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">Daily goals</h2>
        <NumField id="eg" label="Expenditure goal (kcal)" value={p.expenditureGoal} onCommit={(n) => s.setProfile({ expenditureGoal: n })} />
        <NumField id="hg" label="Hydration goal (L)" value={p.hydrationGoalL} step="0.1" onCommit={(n) => s.setProfile({ hydrationGoalL: n })} />
        <NumField id="fg" label="Fasting goal (hours)" value={p.fastingGoalH} onCommit={(n) => s.setProfile({ fastingGoalH: Math.min(24, n) })} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Appearance</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost" onClick={() => s.setTheme(s.theme === "dark" ? "light" : "dark")}>{s.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}{s.theme === "dark" ? "Light mode" : "Dark mode"}</button>
          {PALETTES.map((x) => (
            <button key={x.id} aria-pressed={s.palette === x.id} onClick={() => s.setPalette(x.id)} className={`btn-ghost ${s.palette === x.id ? "ring-2 ring-fg" : ""}`}>
              <span className="h-4 w-4 rounded-full" style={{ background: x.color }} />{x.name}</button>))}
        </div>
      </section>
    </div>
  );
}
