import { DEFAULT_CALORIE_TARGET, KCAL_PER_KG, calcTDEE, dayIntake } from "./calc";
import type { DailyLog, Profile, WeightLog } from "./types";
import { addDays } from "./dates";

export interface GoalDay {
  date: string;
  /** Intake minus (maintenance + workouts). Negative = burned more than eaten. */
  net: number;
  /** kcal moved toward the goal this day (positive = good, negative = away from goal). */
  effect: number;
  /** kcal still to go after this day. */
  remainingAfter: number;
}

export interface GoalSnapshot {
  /** Target and current weight, both in kg. */
  target: number;
  current: number;
  /** Signed kcal from current to target (negative = need to lose). */
  gapKcal: number;
  mode: "lose" | "gain" | "hold";
  /** kcal to go at the anchor point (before any counted day). */
  baseKcal: number;
  /** Sum of counted day effects. */
  progressKcal: number;
  /** baseKcal - progressKcal. Zero or below means the goal is reached. */
  remainingKcal: number;
  reached: boolean;
  /** Progress is moving away from the goal. */
  wrong: boolean;
  /** First day counted in the running sum. */
  countingFrom: string;
  /** Latest weigh-in date, if any. The sum restarts after it. */
  lastWeighIn: string | null;
  /** Counted days, oldest first. */
  days: GoalDay[];
  /** Today, shown live in the daily log. Not part of progress until the day is over. */
  liveDay: GoalDay | null;
}

/**
 * Distance from current weight to target, in kcal, minus the energy progress made since the anchor.
 * The anchor is the later of the goal being set and the latest weigh-in, because a fresh weigh-in
 * already reflects everything before it. Only submitted days count, matching energyTrend.
 */
export function computeGoal(
  logs: Record<string, DailyLog>,
  weights: WeightLog[],
  profile: Profile,
  goalSince: string | null,
  today: string,
): GoalSnapshot | null {
  if (profile.targetWeightKg == null) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const current = latest?.weightKg ?? profile.weightKg;
  const target = profile.targetWeightKg;
  const since = goalSince ?? today;
  const lastWeighIn = latest?.date ?? "";
  const tdee = Math.round(calcTDEE(profile) ?? DEFAULT_CALORIE_TARGET);

  const gapKcal = (target - current) * KCAL_PER_KG;
  const mode = Math.abs(gapKcal) < 1 ? "hold" : gapKcal < 0 ? "lose" : "gain";
  const baseKcal = Math.abs(gapKcal);

  // Counting restarts at the anchor (goal start or latest weigh-in) and begins the day before it, so the
  // day before a goal or weigh-in is included. Only finished days count: today is still being filled in.
  const anchor = lastWeighIn > since ? lastWeighIn : since;
  const countFrom = addDays(anchor, -1);
  const counted = Object.values(logs)
    .filter((l) => l.date >= countFrom && l.date < today && (l.submitted || dayIntake(l) > 0 || (l.expenditure || 0) > 0))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Losing: a deficit helps. Gaining: a surplus helps. Holding: any drift hurts.
  const effectOf = (l: DailyLog) => {
    const net = dayIntake(l) - (tdee + (l.expenditure || 0));
    const effect = mode === "lose" ? -net : mode === "gain" ? net : -Math.abs(net);
    return { net, effect };
  };

  let progress = 0;
  const days: GoalDay[] = counted.map((l) => {
    const { net, effect } = effectOf(l);
    progress += effect;
    return { date: l.date, net, effect, remainingAfter: baseKcal - progress };
  });

  // Today is shown live in the daily log but is not counted in the bubble until it is over.
  const todayLog = logs[today];
  let liveDay: GoalDay | null = null;
  if (todayLog && (todayLog.submitted || dayIntake(todayLog) > 0 || (todayLog.expenditure || 0) > 0)) {
    const { net, effect } = effectOf(todayLog);
    liveDay = { date: today, net, effect, remainingAfter: baseKcal - progress - effect };
  }

  const remainingKcal = baseKcal - progress;
  // Reached means the weigh-in has hit the goal weight, as you described it.
  const weighReached = mode === "lose" ? current <= target : mode === "gain" ? current >= target : true;
  return {
    target,
    current,
    gapKcal,
    mode,
    baseKcal,
    progressKcal: progress,
    remainingKcal,
    reached: weighReached,
    wrong: progress < 0,
    countingFrom: countFrom,
    lastWeighIn: lastWeighIn || null,
    days,
    liveDay,
  };
}
