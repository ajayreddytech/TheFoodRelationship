import type { ActivityLevel, DailyLog, Gender, Profile, WeightLog } from "./types";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (i: number) => i * CM_PER_IN;
export const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function calcAge(dob: string | null, today = new Date()): number | null {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00");
  if (isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

export function calcBMI(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export interface BmiClass { label: string; min: number; max: number | null; range: string; tone: "bad" | "mid" | "good" }
/** WHO BMI classification including thinness grades and obesity classes. */
export const BMI_CLASSES: BmiClass[] = [
  { label: "Severe thinness", min: 0, max: 16, range: "< 16", tone: "bad" },
  { label: "Moderate thinness", min: 16, max: 17, range: "16 – 16.9", tone: "bad" },
  { label: "Mild thinness", min: 17, max: 18.5, range: "17 – 18.4", tone: "mid" },
  { label: "Normal weight", min: 18.5, max: 25, range: "18.5 – 24.9", tone: "good" },
  { label: "Overweight (pre-obese)", min: 25, max: 30, range: "25 – 29.9", tone: "mid" },
  { label: "Obese Class I", min: 30, max: 35, range: "30 – 34.9", tone: "bad" },
  { label: "Obese Class II", min: 35, max: 40, range: "35 – 39.9", tone: "bad" },
  { label: "Obese Class III", min: 40, max: null, range: "≥ 40", tone: "bad" },
];

export function bmiClass(bmi: number | null): BmiClass | null {
  if (bmi == null) return null;
  return BMI_CLASSES.find((c) => bmi >= c.min && (c.max == null || bmi < c.max)) ?? null;
}

export const bmiCategory = (bmi: number | null) => bmiClass(bmi)?.label ?? "—";

/** Mifflin-St Jeor. "other" uses the average of the male/female constants. */
export function calcBMR(p: Pick<Profile, "weightKg" | "heightCm" | "gender" | "dob">): number | null {
  const age = calcAge(p.dob);
  if (age == null || !p.weightKg || !p.heightCm) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  const adj: Record<Gender, number> = { male: 5, female: -161, other: -78 };
  return base + adj[p.gender];
}

export function calcTDEE(p: Profile): number | null {
  const bmr = calcBMR(p);
  return bmr == null ? null : bmr * ACTIVITY_FACTORS[p.activity];
}

export const DEFAULT_CALORIE_TARGET = 2000;

export const dayIntake = (log?: DailyLog) =>
  log ? log.meals.reduce((s, m) => s + m.items.reduce((a, i) => a + (i.calories || 0), 0), 0) : 0;

/** Eating window and fasting hours from first/last meal timestamps. */
export function fastingStats(first: string | null, last: string | null) {
  if (!first || !last) return { eatingH: null, fastingH: null };
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (isNaN(ms) || ms < 0) return { eatingH: null, fastingH: null };
  const eatingH = ms / 36e5;
  return { eatingH, fastingH: Math.max(0, 24 - eatingH) };
}

/** Fasting hours for a day: 24 for a full fast, otherwise from clock in/off. */
export function dayFastingHours(log?: DailyLog): number | null {
  if (!log) return null;
  if (log.fasted) return 24;
  return fastingStats(log.firstMealAt, log.lastMealAt).fastingH;
}

export const KCAL_PER_KG = 7700;

export interface EnergyTrend {
  status: "Gaining weight" | "Losing weight" | "Maintaining" | "Not enough data";
  days: number;
  avgNet: number | null;
  kgPerWeek: number | null;
  tdee: number;
  usedDefaultTdee: boolean;
}

/**
 * Running estimate of weight change from submitted days up to `end` (trailing window).
 * Net = intake - (maintenance TDEE + logged workout expenditure).
 */
export function energyTrend(logs: Record<string, DailyLog>, profile: Profile, end: string, windowDays = 30): EnergyTrend {
  const tdeeRaw = calcTDEE(profile);
  const tdee = Math.round(tdeeRaw ?? DEFAULT_CALORIE_TARGET);
  const endD = new Date(end + "T00:00:00").getTime();
  const nets: number[] = [];
  for (const l of Object.values(logs)) {
    if (!l.submitted) continue;
    const age = (endD - new Date(l.date + "T00:00:00").getTime()) / 864e5;
    if (age < 0 || age >= windowDays) continue;
    nets.push(dayIntake(l) - (tdee + (l.expenditure || 0)));
  }
  if (nets.length < 3) return { status: "Not enough data", days: nets.length, avgNet: null, kgPerWeek: null, tdee, usedDefaultTdee: tdeeRaw == null };
  const avgNet = nets.reduce((a, b) => a + b, 0) / nets.length;
  const status = avgNet > 50 ? "Gaining weight" : avgNet < -50 ? "Losing weight" : "Maintaining";
  return { status, days: nets.length, avgNet, kgPerWeek: (avgNet * 7) / KCAL_PER_KG, tdee, usedDefaultTdee: tdeeRaw == null };
}

export type WeightTrend = "Gaining Weight" | "Losing Weight" | "Maintaining" | "Not enough data";

/** Pace in kg/week from first to latest log (or least-squares slope when >2 points). */
export function weightPace(logs: WeightLog[]): { kgPerWeek: number | null; status: WeightTrend } {
  const s = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return { kgPerWeek: null, status: "Not enough data" };
  const t0 = new Date(s[0].date).getTime();
  const xs = s.map((l) => (new Date(l.date).getTime() - t0) / (7 * 864e5));
  const ys = s.map((l) => l.weightKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return { kgPerWeek: null, status: "Not enough data" };
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den;
  const status: WeightTrend = slope > 0.1 ? "Gaining Weight" : slope < -0.1 ? "Losing Weight" : "Maintaining";
  return { kgPerWeek: slope, status };
}
