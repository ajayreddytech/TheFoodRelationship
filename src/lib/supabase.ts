import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  CookedBatch, CookedBatchRow, DailyLog, DailyLogRow, MealEntry, MealEntryRow, Profile, UsersProfileRow, WeightLog, WeightLogRow,
} from "./types";
import { dayFastingHours, dayIntake } from "./calc";
import { logNutrients } from "./dates";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, key!) : null;

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function pushProfile(uid: string, p: Profile) {
  if (!supabase) return;
  const row: UsersProfileRow = {
    user_id: uid, dob: p.dob, gender: p.gender, height_cm: p.heightCm, weight_kg: p.weightKg,
    activity_level: p.activity, unit_system: p.unitSystem, expenditure_goal: p.expenditureGoal,
    hydration_goal_l: p.hydrationGoalL, fasting_goal_h: p.fastingGoalH, target_weight_kg: p.targetWeightKg,
  };
  const { error } = await supabase.from("users_profile").upsert(row);
  if (error) throw error;
}

export async function pushLog(uid: string, log: DailyLog) {
  if (!supabase) return;
  const fastingH = dayFastingHours(log);
  const { data, error } = await supabase
    .from("daily_logs")
    .upsert(
      {
        user_id: uid, log_date: log.date, intake: dayIntake(log), expenditure: log.expenditure,
        hydration_l: log.hydrationL, gyr: log.gyr, nibbles: log.nibbles,
        first_meal_at: log.firstMealAt, last_meal_at: log.lastMealAt, fasting_hours: fastingH, fasted: log.fasted,
        nutrients: logNutrients(log), updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,log_date" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const logId = data.id as string;
  const del = await supabase.from("meal_entries").delete().eq("log_id", logId);
  if (del.error) throw del.error;
  if (log.meals.length) {
    const ins = await supabase.from("meal_entries").insert(
      log.meals.map((m) => ({ log_id: logId, user_id: uid, bucket: m.bucket, items: m.items })),
    );
    if (ins.error) throw ins.error;
  }
}

export async function deleteRemoteLog(uid: string, date: string) {
  if (!supabase) return;
  const { error } = await supabase.from("daily_logs").delete().eq("user_id", uid).eq("log_date", date);
  if (error) throw error;
}

export async function pushWeight(uid: string, w: WeightLog) {
  if (!supabase) return;
  const { error } = await supabase
    .from("weight_logs")
    .upsert({ user_id: uid, log_date: w.date, weight_kg: w.weightKg }, { onConflict: "user_id,log_date" });
  if (error) throw error;
}

export async function deleteRemoteWeight(uid: string, date: string) {
  if (!supabase) return;
  const { error } = await supabase.from("weight_logs").delete().eq("user_id", uid).eq("log_date", date);
  if (error) throw error;
}

export async function pushBatch(uid: string, b: CookedBatch) {
  if (!supabase) return;
  const { error } = await supabase.from("cooked_batches").upsert({ id: b.id, user_id: uid, data: b, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteRemoteBatch(uid: string, id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("cooked_batches").delete().eq("user_id", uid).eq("id", id);
  if (error) throw error;
}

export interface ContentRow { plans: unknown; recipes: unknown; guide: unknown; faqs: unknown }

export async function pushContent(uid: string, c: ContentRow) {
  if (!supabase) return;
  const { error } = await supabase.from("user_content").upsert({ user_id: uid, ...c, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function pullContent(uid: string): Promise<ContentRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("user_content").select("plans,recipes,guide,faqs").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return (data as ContentRow | null) ?? null;
}
export interface RemoteData {
  profile: UsersProfileRow | null;
  logs: DailyLog[];
  weights: WeightLog[];
  batches: CookedBatch[];
}

export async function pullAll(uid: string): Promise<RemoteData> {
  if (!supabase) return { profile: null, logs: [], weights: [], batches: [] };
  const [p, l, m, w, b] = await Promise.all([
    supabase.from("users_profile").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("daily_logs").select("*").eq("user_id", uid),
    supabase.from("meal_entries").select("*").eq("user_id", uid),
    supabase.from("weight_logs").select("*").eq("user_id", uid),
    supabase.from("cooked_batches").select("*").eq("user_id", uid),
  ]);
  for (const r of [p, l, m, w, b]) if (r.error) throw r.error;
  const meals = (m.data ?? []) as MealEntryRow[];
  const logs = ((l.data ?? []) as DailyLogRow[]).map<DailyLog>((r) => ({
    date: r.log_date,
    meals: meals.filter((x) => x.log_id === r.id).map<MealEntry>((x) => ({ id: x.id, bucket: x.bucket, items: x.items })),
    expenditure: Number(r.expenditure) || 0,
    hydrationL: Number(r.hydration_l) || 0,
    gyr: r.gyr,
    nibbles: r.nibbles,
    firstMealAt: r.first_meal_at,
    lastMealAt: r.last_meal_at,
    fasted: Boolean(r.fasted),
    submitted: true,
  }));
  const weights = ((w.data ?? []) as WeightLogRow[]).map((r) => ({ date: r.log_date, weightKg: Number(r.weight_kg) }));
  const batches = ((b.data ?? []) as CookedBatchRow[]).map((r) => r.data);
  return { profile: (p.data as UsersProfileRow | null) ?? null, logs, weights, batches };
}
