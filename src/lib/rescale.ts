import { useRef } from "react";
import type { FoodItem } from "./types";
import { scaleItem } from "./dates";

/** Splits a quantity such as "200 g" or "2 idlis" into its number and unit. Plurals match singulars ("cups" = "cup"). */
export function parseQuantity(q: string): { n: number; unit: string } | null {
  const m = q.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*([a-zA-Z%.]*)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? { n, unit: m[2].toLowerCase().replace(/s$/, "") } : null;
}

/**
 * Re-derives an item's calories, macros and micros from its base when the quantity changes.
 * Returns null when the two quantities can't be compared (unparseable, or different units); the caller keeps the old values.
 */
export function rescaleItem(base: FoodItem, quantity: string): FoodItem | null {
  const from = parseQuantity(base.quantity), to = parseQuantity(quantity);
  if (!from || !to) return null;
  if (to.unit && from.unit && to.unit !== from.unit) return null;
  return { ...scaleItem(base, to.n / from.n), quantity };
}

/**
 * Remembers each row's original nutrition so repeated quantity edits scale from the original, not from rounded results.
 * A calorie override starts a new base, because the user has then set the reference point themselves.
 */
export function useItemBase() {
  const bases = useRef(new WeakMap<FoodItem, FoodItem>());
  const base = (it: FoodItem) => bases.current.get(it) ?? it;
  /** Carries the base from an edited row to its replacement. */
  const carry = (from: FoodItem, to: FoodItem) => { bases.current.set(to, base(from)); return to; };
  return { base, carry };
}
