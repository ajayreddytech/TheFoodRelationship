export const MEAL_BUCKETS = [
  "Pre 8:30 a.m.",
  "Detox Drink",
  "Breakfast",
  "Morning Snack",
  "Lunch",
  "Evening Snack",
  "Dinner",
  "Post 6:30 p.m.",
] as const;
export type MealBucket = (typeof MEAL_BUCKETS)[number];

export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type UnitSystem = "metric" | "imperial";
export type Gyr = "green" | "yellow" | "red";
export type Theme = "light" | "dark";
export type Palette = "emerald" | "crimson" | "amber";

/** Macro-type nutrients keyed e.g. protein_g. protein/carbs/fat/fiber are always present. */
export interface Macros {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  [key: string]: number;
}
/** Micros keyed by nutrient key, e.g. zinc_mg. */
export type Micros = Record<string, number>;

export const BUCKET_TIMES: Record<MealBucket, string> = {
  "Pre 8:30 a.m.": "Before 8:30 a.m.",
  "Detox Drink": "8:30 – 9:30 a.m.",
  Breakfast: "8:30 – 9:30 a.m.",
  "Morning Snack": "10:30 – 11:00 a.m.",
  Lunch: "1:00 – 1:30 p.m.",
  "Evening Snack": "3:50 – 4:10 p.m.",
  Dinner: "6:00 – 6:30 p.m.",
  "Post 6:30 p.m.": "After 6:30 p.m.",
};

export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  macros: Macros;
  micros: Micros;
  /** Set on items that are a share of a cooked batch, so they follow later edits to that batch. */
  batch?: { id: string; fraction: number };
}

export interface PlannedMeal { id: string; bucket: MealBucket; items: FoodItem[] }

export interface ParsedFood {
  target_bucket: MealBucket;
  items: FoodItem[];
  /** Set when the items are a portion of a cooked batch. */
  batch?: { id: string; fraction: number };
  transcript?: string;
  /** Set when editing an existing meal entry. */
  editId?: string;
}

/** A multi-ingredient preparation eaten over several meals. */
export interface CookedBatch {
  id: string;
  name: string;
  createdAt: string; // ISO
  cookedWeightG: number | null;
  servings: number | null;
  ingredients: FoodItem[];
  /** Whole-batch totals (sum of ingredients). */
  total: FoodItem;
  remaining: number; // 0..1
}

export interface MealEntry {
  id: string;
  bucket: MealBucket;
  items: FoodItem[];
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  meals: MealEntry[];
  expenditure: number;
  hydrationL: number;
  gyr: Gyr | null;
  nibbles: boolean | null;
  firstMealAt: string | null; // ISO
  lastMealAt: string | null;
  /** Full-day fast: 24h fasting, no intake. */
  fasted: boolean;
  submitted: boolean;
  /** Last local edit (ISO); used to sync unsubmitted drafts across devices. */
  updatedAt?: string;
}

export interface Profile {
  dob: string | null;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  unitSystem: UnitSystem;
  expenditureGoal: number;
  hydrationGoalL: number;
  fastingGoalH: number;
  targetWeightKg: number | null;
}

export interface WeightLog {
  date: string;
  weightKg: number;
}

export interface UsersProfileRow {
  prefs?: { theme?: string; palette?: string } | null;
  user_id: string;
  dob: string | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  unit_system: UnitSystem | null;
  expenditure_goal: number | null;
  hydration_goal_l: number | null;
  fasting_goal_h: number | null;
  target_weight_kg: number | null;
}
export interface DailyLogRow {
  id: string;
  user_id: string;
  log_date: string;
  intake: number;
  expenditure: number;
  hydration_l: number;
  gyr: Gyr | null;
  nibbles: boolean | null;
  first_meal_at: string | null;
  last_meal_at: string | null;
  fasting_hours: number | null;
  fasted: boolean | null;
  nutrients: Record<string, number>;
}
export interface CookedBatchRow {
  id: string;
  user_id: string;
  data: CookedBatch;
}
export interface MealEntryRow {
  id: string;
  log_id: string;
  user_id: string;
  bucket: MealBucket;
  items: FoodItem[];
}
export interface WeightLogRow {
  id: string;
  user_id: string;
  log_date: string;
  weight_kg: number;
}
