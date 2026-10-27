import { DailyLog, FoodItem } from "./types";
import { NUTRIENTS } from "./nutrients";

export const toISODate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const todayISO = () => toISODate(new Date());
export const parseISODate = (s: string) => new Date(s + "T00:00:00");
export const addDays = (s: string, n: number) => {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function emptyLog(date: string): DailyLog {
  return {
    date,
    meals: [],
    expenditure: 0,
    hydrationL: 0,
    gyr: null,
    nibbles: null,
    firstMealAt: null,
    lastMealAt: null,
    fasted: false,
    submitted: false,
  };
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : undefined);

export function itemNutrients(it: FoodItem): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of NUTRIENTS) {
    const v = num(it.macros?.[n.key]) ?? num(it.micros?.[n.key]);
    if (v !== undefined) out[n.key] = v;
  }
  return out;
}

export function logNutrients(log?: DailyLog): Record<string, number> {
  const out: Record<string, number> = {};
  if (!log) return out;
  for (const m of log.meals)
    for (const it of m.items)
      for (const [k, v] of Object.entries(itemNutrients(it))) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Sums several food items into one (used for whole-batch totals). */
export function sumItems(name: string, quantity: string, items: FoodItem[]): FoodItem {
  const macros: Record<string, number> = { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  const micros: Record<string, number> = {};
  let calories = 0;
  for (const it of items) {
    calories += it.calories || 0;
    for (const [k, v] of Object.entries(it.macros ?? {})) macros[k] = (macros[k] ?? 0) + (num(v) ?? 0);
    for (const [k, v] of Object.entries(it.micros ?? {})) micros[k] = (micros[k] ?? 0) + (num(v) ?? 0);
  }
  return { name, quantity, calories, macros: macros as FoodItem["macros"], micros };
}

/** Scales every number of a food item by a factor. */
export function scaleItem(it: FoodItem, f: number, name = it.name, quantity = it.quantity): FoodItem {
  const sc = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * f * 100) / 100]));
  return { name, quantity, calories: Math.round(it.calories * f), macros: sc(it.macros) as FoodItem["macros"], micros: sc(it.micros) };
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from, i = 0; d <= to && i < 4000; d = addDays(d, 1), i++) out.push(d);
  return out;
}
