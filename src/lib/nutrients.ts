import { calcAge, calcTDEE, DEFAULT_CALORIE_TARGET } from "./calc";
import type { FoodItem, Profile } from "./types";

export type NutrientGroup = "Macros" | "Fats" | "Vitamins" | "Minerals" | "Other";

export interface NutrientDef {
  key: string;
  label: string;
  unit: string;
  group: NutrientGroup;
  /** true => limit nutrient (exceeding is bad). */
  limit?: boolean;
  /** Where Gemini reports it. */
  macro?: boolean;
  /** Short suggestion shown when intake is low. */
  tip?: string;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: "protein_g", label: "Protein", unit: "g", group: "Macros", macro: true, tip: "eggs, fish, legumes, paneer or lean meat" },
  { key: "carbs_g", label: "Carbohydrates", unit: "g", group: "Macros", macro: true, tip: "whole grains, fruit and starchy vegetables" },
  { key: "sugar_g", label: "Sugar", unit: "g", group: "Macros", macro: true, limit: true },
  { key: "fiber_g", label: "Dietary Fiber", unit: "g", group: "Macros", macro: true, tip: "whole grains, vegetables, fruit and pulses" },
  { key: "fat_g", label: "Total Fat", unit: "g", group: "Fats", macro: true },
  { key: "sat_fat_g", label: "Saturated Fat", unit: "g", group: "Fats", macro: true, limit: true },
  { key: "mono_fat_g", label: "Monounsaturated Fat", unit: "g", group: "Fats", macro: true, tip: "olive oil, nuts and avocado" },
  { key: "poly_fat_g", label: "Polyunsaturated Fat", unit: "g", group: "Fats", macro: true, tip: "seeds, walnuts and fatty fish" },
  { key: "trans_fat_g", label: "Trans Fat", unit: "g", group: "Fats", macro: true, limit: true },
  { key: "omega3_g", label: "Omega-3", unit: "g", group: "Fats", macro: true, tip: "flax, chia, walnuts or fatty fish" },
  { key: "omega6_g", label: "Omega-6", unit: "g", group: "Fats", macro: true },
  { key: "cholesterol_mg", label: "Cholesterol", unit: "mg", group: "Fats", limit: true },
  { key: "vitamin_a_mcg", label: "Vitamin A", unit: "mcg", group: "Vitamins", tip: "carrots, sweet potato and leafy greens" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg", group: "Vitamins", tip: "citrus, peppers or berries" },
  { key: "vitamin_d_mcg", label: "Vitamin D", unit: "mcg", group: "Vitamins", tip: "sunlight, fortified foods and fatty fish" },
  { key: "vitamin_e_mg", label: "Vitamin E", unit: "mg", group: "Vitamins", tip: "nuts, seeds and plant oils" },
  { key: "vitamin_k_mcg", label: "Vitamin K", unit: "mcg", group: "Vitamins", tip: "leafy greens and broccoli" },
  { key: "vitamin_b1_mg", label: "B1 (Thiamin)", unit: "mg", group: "Vitamins", tip: "whole grains and legumes" },
  { key: "vitamin_b2_mg", label: "B2 (Riboflavin)", unit: "mg", group: "Vitamins", tip: "dairy, eggs and almonds" },
  { key: "vitamin_b3_mg", label: "B3 (Niacin)", unit: "mg", group: "Vitamins", tip: "peanuts, mushrooms and poultry" },
  { key: "vitamin_b5_mg", label: "B5 (Pantothenic)", unit: "mg", group: "Vitamins" },
  { key: "vitamin_b6_mg", label: "B6", unit: "mg", group: "Vitamins", tip: "chickpeas, banana and potatoes" },
  { key: "vitamin_b7_mcg", label: "B7 (Biotin)", unit: "mcg", group: "Vitamins" },
  { key: "vitamin_b9_mcg", label: "B9 (Folate)", unit: "mcg", group: "Vitamins", tip: "lentils, spinach and beans" },
  { key: "vitamin_b12_mcg", label: "B12", unit: "mcg", group: "Vitamins", tip: "dairy, eggs, fish or a B12 supplement" },
  { key: "choline_mg", label: "Choline", unit: "mg", group: "Vitamins", tip: "eggs, soy and legumes" },
  { key: "calcium_mg", label: "Calcium", unit: "mg", group: "Minerals", tip: "dairy, tofu, ragi or leafy greens" },
  { key: "iron_mg", label: "Iron", unit: "mg", group: "Minerals", tip: "lentils, spinach, or meat with vitamin C" },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg", group: "Minerals", tip: "nuts, seeds and whole grains" },
  { key: "phosphorus_mg", label: "Phosphorus", unit: "mg", group: "Minerals" },
  { key: "potassium_mg", label: "Potassium", unit: "mg", group: "Minerals", tip: "bananas, potatoes and beans" },
  { key: "sodium_mg", label: "Sodium", unit: "mg", group: "Minerals", limit: true },
  { key: "zinc_mg", label: "Zinc", unit: "mg", group: "Minerals", tip: "pumpkin seeds, legumes or lean meat" },
  { key: "copper_mg", label: "Copper", unit: "mg", group: "Minerals" },
  { key: "manganese_mg", label: "Manganese", unit: "mg", group: "Minerals" },
  { key: "selenium_mcg", label: "Selenium", unit: "mcg", group: "Minerals", tip: "Brazil nuts, eggs and seafood" },
  { key: "iodine_mcg", label: "Iodine", unit: "mcg", group: "Minerals", tip: "iodised salt, dairy and seafood" },
];

export interface NutrientSource { name: string; value: number; share: number }

/** Top foods contributing to one nutrient; same-named items are merged. `share` is 0-1 of the total from all foods. */
export function topSources(items: FoodItem[], key: string, n = 5): { sources: NutrientSource[]; total: number } {
  const by = new Map<string, { name: string; value: number }>();
  let total = 0;
  for (const i of items) {
    const v = ((i.macros as Record<string, number>)[key] ?? (i.micros as Record<string, number>)[key]) || 0;
    if (v <= 0) continue;
    total += v;
    const k = i.name.trim().toLowerCase();
    const cur = by.get(k);
    if (cur) cur.value += v; else by.set(k, { name: i.name.trim(), value: v });
  }
  const sources = [...by.values()].sort((a, b) => b.value - a.value).slice(0, n).map((s) => ({ ...s, share: total > 0 ? s.value / total : 0 }));
  return { sources, total };
}

export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);
export const MACRO_KEYS = NUTRIENTS.filter((n) => n.macro).map((n) => n.key);
export const MICRO_KEYS = NUTRIENTS.filter((n) => !n.macro).map((n) => n.key);

/** Limit nutrients shown in the "keep these low" drop-down. Sugar stays in its Macros group. */
export const isUnwanted = (n: NutrientDef) => !!n.limit && n.group !== "Macros";

const PROTEIN_PER_KG = { sedentary: 0.8, light: 1.0, moderate: 1.2, active: 1.4, very_active: 1.6 } as const;

/**
 * Daily targets personalised from age, gender, weight, height (via TDEE) and activity.
 * Based on US DRI/RDA/AI values, WHO sugar guidance and AMDR macro ranges.
 * For "other" gender the male/female values are averaged.
 */
export function rdaFor(p: Profile): Record<string, number> {
  const age = calcAge(p.dob) ?? 30;
  const cal = calcTDEE(p) ?? DEFAULT_CALORIE_TARGET;
  const kg = p.weightKg || 70;
  const pick = (m: number, f: number) => (p.gender === "male" ? m : p.gender === "female" ? f : (m + f) / 2);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    protein_g: Math.round(Math.max(kg * PROTEIN_PER_KG[p.activity], pick(56, 46) * 0.8)),
    carbs_g: Math.round((cal * 0.5) / 4),
    sugar_g: 50, // WHO upper guidance for free sugars
    fiber_g: Math.round((cal / 1000) * 14),
    fat_g: Math.round((cal * 0.3) / 9),
    sat_fat_g: Math.round((cal * 0.1) / 9),
    mono_fat_g: Math.round((cal * 0.15) / 9),
    poly_fat_g: Math.round((cal * 0.07) / 9),
    trans_fat_g: r1((cal * 0.01) / 9),
    omega3_g: pick(1.6, 1.1),
    omega6_g: age > 50 ? pick(14, 11) : pick(17, 12),
    cholesterol_mg: 300,
    vitamin_a_mcg: pick(900, 700),
    vitamin_c_mg: pick(90, 75),
    vitamin_d_mcg: age > 70 ? 20 : 15,
    vitamin_e_mg: 15,
    vitamin_k_mcg: pick(120, 90),
    vitamin_b1_mg: pick(1.2, 1.1),
    vitamin_b2_mg: pick(1.3, 1.1),
    vitamin_b3_mg: pick(16, 14),
    vitamin_b5_mg: 5,
    vitamin_b6_mg: age > 50 ? pick(1.7, 1.5) : 1.3,
    vitamin_b7_mcg: 30,
    vitamin_b9_mcg: 400,
    vitamin_b12_mcg: 2.4,
    choline_mg: pick(550, 425),
    calcium_mg: age > 70 || (p.gender !== "male" && age > 50) ? 1200 : 1000,
    iron_mg: p.gender === "male" ? 8 : p.gender === "female" ? (age > 50 ? 8 : 18) : age > 50 ? 8 : 13,
    magnesium_mg: age <= 30 ? pick(400, 310) : pick(420, 320),
    phosphorus_mg: 700,
    potassium_mg: pick(3400, 2600),
    sodium_mg: 2300,
    zinc_mg: pick(11, 8),
    copper_mg: 0.9,
    manganese_mg: pick(2.3, 1.8),
    selenium_mcg: 55,
    iodine_mcg: 150,
  };
}
