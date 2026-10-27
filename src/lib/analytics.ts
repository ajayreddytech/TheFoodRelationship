import type { DailyLog, Profile } from "./types";
import { calcTDEE, DEFAULT_CALORIE_TARGET, dayFastingHours, dayIntake, fastingStats, KCAL_PER_KG } from "./calc";
import { datesBetween, logNutrients } from "./dates";
import { NUTRIENTS, rdaFor } from "./nutrients";

/** Daily calorie goal = maintenance calories (TDEE). */
export const calorieTarget = (p: Profile) => Math.round(calcTDEE(p) ?? DEFAULT_CALORIE_TARGET);

export interface DayPoint {
  date: string;
  intake: number | null;
  expenditure: number | null;
  hydration: number | null;
  fasting: number | null;
  eating: number | null;
  gyr: DailyLog["gyr"];
  nibbles: boolean | null;
  fasted: boolean;
  logged: boolean;
}

/** A day counts as "logged" only if it has something recorded. */
export const isLogged = (l?: DailyLog): l is DailyLog =>
  !!l && (l.submitted || l.fasted || l.meals.length > 0 || l.expenditure > 0 || l.hydrationL > 0 || l.gyr != null || l.nibbles != null);

export function dayPoints(logs: Record<string, DailyLog>, from: string, to: string): DayPoint[] {
  return datesBetween(from, to).map((date) => {
    const l = logs[date];
    if (!isLogged(l)) return { date, intake: null, expenditure: null, hydration: null, fasting: null, eating: null, gyr: null, nibbles: null, fasted: false, logged: false };
    const hasIntake = l.meals.length > 0 || l.fasted;
    return {
      date,
      intake: hasIntake ? dayIntake(l) : null,
      expenditure: l.expenditure,
      hydration: l.hydrationL,
      fasting: dayFastingHours(l),
      eating: l.fasted ? 0 : fastingStats(l.firstMealAt, l.lastMealAt).eatingH,
      gyr: l.gyr,
      nibbles: l.nibbles,
      fasted: l.fasted,
      logged: true,
    };
  });
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** All averages are running averages over days actually logged (up to today) in the window. */
export function summarize(points: DayPoint[]) {
  const logged = points.filter((p) => p.logged);
  const gyr = { green: 0, yellow: 0, red: 0 };
  for (const p of logged) if (p.gyr) gyr[p.gyr]++;
  const gyrTotal = gyr.green + gyr.yellow + gyr.red;
  const nib = logged.filter((p) => p.nibbles != null);
  const nibYes = nib.filter((p) => p.nibbles).length;
  return {
    days: logged.length,
    avgIntake: avg(logged.map((p) => p.intake)),
    avgExpenditure: avg(logged.map((p) => p.expenditure)),
    avgHydration: avg(logged.map((p) => p.hydration)),
    avgFasting: avg(logged.map((p) => p.fasting)),
    gyr,
    gyrTotal,
    nibblesYes: nib.length ? nibYes : 0,
    nibblesNo: nib.length - nibYes,
    nibblesTotal: nib.length,
  };
}

export interface InsightTile {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}

const longestRun = (points: DayPoint[], ok: (p: DayPoint) => boolean) => {
  let best = 0, cur = 0;
  for (const p of points) {
    cur = p.logged && ok(p) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
};

export function extraInsights(points: DayPoint[], p: Profile): InsightTile[] {
  const logged = points.filter((x) => x.logged);
  if (!logged.length) return [];
  const target = calorieTarget(p);
  const tiles: InsightTile[] = [];
  const withIntake = logged.filter((x) => x.intake != null);
  const net = withIntake.map((x) => (x.intake ?? 0) - (target + (x.expenditure ?? 0)));
  if (net.length >= 3) {
    const avgNet = net.reduce((a, b) => a + b, 0) / net.length;
    const kgw = (avgNet * 7) / KCAL_PER_KG;
    tiles.push({
      id: "balance",
      label: "Avg energy balance",
      value: `${avgNet > 0 ? "+" : ""}${Math.round(avgNet)} kcal/day`,
      hint: `≈ ${kgw > 0 ? "+" : ""}${kgw.toFixed(2)} kg/week (${(kgw * 2.20462).toFixed(2)} lb)`,
      tone: Math.abs(avgNet) <= 50 ? "good" : avgNet > 0 ? "warn" : "good",
    });
  }
  if (withIntake.length) {
    const within = withIntake.filter((x) => (x.intake ?? 0) <= target).length;
    tiles.push({ id: "calgoal", label: "Within calorie goal", value: `${within} / ${withIntake.length} days`, hint: `Goal ${target} kcal (TDEE)`, tone: within / withIntake.length >= 0.7 ? "good" : "warn" });
  }
  const hyd = logged.filter((x) => (x.hydration ?? 0) >= p.hydrationGoalL).length;
  tiles.push({ id: "hydgoal", label: "Hydration goal hit", value: `${hyd} / ${logged.length} days`, hint: `Goal ${p.hydrationGoalL} L`, tone: hyd / logged.length >= 0.7 ? "good" : "warn" });
  const ex = logged.filter((x) => (x.expenditure ?? 0) >= p.expenditureGoal).length;
  tiles.push({ id: "exgoal", label: "Workout goal hit", value: `${ex} / ${logged.length} days`, hint: `Goal ${p.expenditureGoal} kcal`, tone: ex / logged.length >= 0.5 ? "good" : "warn" });
  const fastGoal = logged.filter((x) => (x.fasting ?? 0) >= p.fastingGoalH).length;
  tiles.push({ id: "fastgoal", label: "Fasting goal hit", value: `${fastGoal} / ${logged.length} days`, hint: `Goal ${p.fastingGoalH} h` });
  const fullFasts = logged.filter((x) => x.fasted).length;
  if (fullFasts) tiles.push({ id: "fullfast", label: "Full fasting days", value: String(fullFasts), hint: "24h clean fasts" });
  // Each day is its own fast; a full-fast day counts as 24h and is never merged with neighbouring days.
  const longest = Math.max(0, ...logged.map((x) => (x.fasted ? 24 : x.fasting ?? 0)));
  if (longest > 0) tiles.push({ id: "longfast", label: "Longest fast", value: `${longest.toFixed(1)} h` });
  const eating = avg(logged.map((x) => x.eating));
  if (eating != null) tiles.push({ id: "eating", label: "Avg eating window", value: `${eating.toFixed(1)} h` });
  tiles.push({ id: "greenstreak", label: "Longest Satvik streak", value: `${longestRun(points, (x) => x.gyr === "green")} days`, tone: "good" });
  tiles.push({ id: "nibstreak", label: "Longest no-nibble streak", value: `${longestRun(points, (x) => x.nibbles === false)} days`, tone: "good" });
  const best = [...logged].filter((x) => x.gyr === "green" && x.intake).sort((a, b) => (b.hydration ?? 0) - (a.hydration ?? 0))[0];
  if (best) tiles.push({ id: "best", label: "Best day", value: best.date, hint: "Satvik + most hydrated" });
  return tiles;
}

export interface NutrientAgg {
  key: string;
  avg: number;
  rda: number;
  daysOver: number;
  days: number;
}

/** Running average of daily totals across logged days with meals (dates up to `to`). */
export function aggregateNutrients(logs: Record<string, DailyLog>, from: string, to: string, p: Profile): NutrientAgg[] {
  const rda = rdaFor(p);
  const days = datesBetween(from, to)
    .map((d) => logs[d])
    .filter((l) => l && l.meals.length)
    .map((l) => logNutrients(l));
  return NUTRIENTS.map((n) => {
    const vals = days.map((d) => d[n.key] ?? 0);
    return {
      key: n.key,
      rda: rda[n.key],
      avg: days.length ? vals.reduce((a, b) => a + b, 0) / days.length : 0,
      daysOver: vals.filter((v) => v > rda[n.key]).length,
      days: days.length,
    };
  });
}

export interface DietInsight {
  id: string;
  tone: "good" | "warn" | "bad";
  key: string;
  title: string;
  text: string;
  tip?: string;
}

/** Shared status for a nutrient's running average vs its personal target. */
export function nutrientStatus(limit: boolean | undefined, ratio: number): "good" | "warn" | "bad" {
  if (limit) return ratio <= 1 ? "good" : ratio <= 1.2 ? "warn" : "bad";
  return ratio >= 0.9 ? "good" : ratio >= 0.6 ? "warn" : "bad";
}

export function dietaryInsights(aggs: NutrientAgg[]): DietInsight[] {
  const out: DietInsight[] = [];
  for (const a of aggs) {
    if (!a.days || !a.rda) continue;
    const def = NUTRIENTS.find((n) => n.key === a.key)!;
    const ratio = a.avg / a.rda;
    const tone = nutrientStatus(def.limit, ratio);
    const pct = Math.round(ratio * 100);
    const base = { id: a.key, key: a.key, tone };
    if (def.limit) {
      if (tone === "good") out.push({ ...base, title: `${def.label} within limit`, text: `${pct}% of your daily limit.` });
      else if (tone === "warn") out.push({ ...base, title: `${def.label} slightly over`, text: `${pct}% of your limit${a.days > 1 ? `, exceeded on ${a.daysOver} of ${a.days} days` : ""}.`, tip: "Ease off processed and fried foods." });
      else out.push({ ...base, title: `${def.label} well over the limit`, text: `${pct}% of your limit${a.days > 1 ? `, exceeded on ${a.daysOver} of ${a.days} days` : ""}.`, tip: "Cut back on processed and fried foods." });
    } else if (tone === "good") {
      out.push({ ...base, title: `${def.label} on target`, text: `${pct}% of your daily need.` });
    } else {
      out.push({ ...base, title: tone === "bad" ? `${def.label} very low` : `${def.label} a bit low`, text: `${pct}% of your daily need.`, tip: def.tip ? `Try ${def.tip}.` : undefined });
    }
  }
  return out;
}