import { DEFAULT_CALORIE_TARGET, KCAL_PER_KG, calcTDEE, dayIntake } from "./calc";
import type { DailyLog, Profile, WeightLog } from "./types";

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

  // Past days count once submitted. Today counts as you log it, so the circle moves live.
  const counted = Object.values(logs)
    .filter((l) => (l.submitted || l.date === today) && l.date >= since && l.date > lastWeighIn && l.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  let progress = 0;
  const days: GoalDay[] = counted.map((l) => {
    const net = dayIntake(l) - (tdee + (l.expenditure || 0));
    // Losing: a deficit helps. Gaining: a surplus helps. Holding: any drift hurts.
    const effect = mode === "lose" ? -net : mode === "gain" ? net : -Math.abs(net);
    progress += effect;
    return { date: l.date, net, effect, remainingAfter: baseKcal - progress };
  });

  const remainingKcal = baseKcal - progress;
  return {
    target,
    current,
    gapKcal,
    mode,
    baseKcal,
    progressKcal: progress,
    remainingKcal,
    reached: remainingKcal <= 0,
    wrong: progress < 0,
    countingFrom: lastWeighIn > since ? lastWeighIn : since,
    lastWeighIn: lastWeighIn || null,
    days,
  };
}
