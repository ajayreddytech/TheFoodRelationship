import { useStore } from "./store";
import { scaleItem, todayISO } from "./dates";
import { BUCKET_TIMES, FoodItem, MEAL_BUCKETS, MealBucket, ParsedFood } from "./types";
import type { RecordedAudio } from "./useRecorder";

export type ParseMode = "meal" | "cook" | "plan";

export interface CookDraft {
  name: string;
  cookedWeightG: number | null;
  servings: number | null;
  items: FoodItem[];
  transcript?: string;
  /** Set when editing an existing batch. */
  batchId?: string;
}

export type ParseResult =
  | { kind: "meal"; parsed: ParsedFood }
  | { kind: "meals"; meals: ParsedFood[]; transcript?: string }
  | { kind: "plan"; date: string; meals: ParsedFood[]; transcript?: string }
  | { kind: "cook"; draft: CookDraft };

export function guessBucket(d = new Date()): MealBucket {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m < 510) return "Pre 8:30 a.m.";
  if (m < 570) return "Breakfast";
  if (m < 720) return "Morning Snack";
  if (m < 930) return "Lunch";
  if (m < 1050) return "Evening Snack";
  if (m < 1110) return "Dinner";
  return "Post 6:30 p.m.";
}

export { BUCKET_TIMES, MEAL_BUCKETS };

export function portionItem(batchId: string, fraction: number): { item: FoodItem; name: string } | null {
  const b = useStore.getState().batches.find((x) => x.id === batchId);
  if (!b) return null;
  const grams = b.cookedWeightG ? ` ≈ ${Math.round(b.cookedWeightG * fraction)}g` : "";
  return { name: b.name, item: scaleItem(b.total, fraction, `${b.name} (portion)`, `${Math.round(fraction * 100)}% of batch${grams}`) };
}

export async function parseInput(input: { text?: string; audio?: RecordedAudio; mode: ParseMode }): Promise<ParseResult> {
  const batches = useStore.getState().batches.map((b) => ({ id: b.id, name: b.name, cooked_weight_g: b.cookedWeightG, remaining: b.remaining, ingredients: b.ingredients.map((i) => i.name) }));
  let res: Response;
  try {
    res = await fetch("/api/parse-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, hour: new Date().getHours(), today: todayISO(), batches }),
    });
  } catch {
    throw new Error("You appear to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Could not parse that.");

  if (data.kind === "cook_update") {
    const b = useStore.getState().batches.find((x) => x.id === data.batch_id);
    if (!b) throw new Error("That cooked batch no longer exists.");
    const drop = (data.remove as string[]).map((r) => r.toLowerCase());
    const kept = b.ingredients.filter((i) => !drop.some((r) => i.name.toLowerCase().includes(r) || r.includes(i.name.toLowerCase())));
    return { kind: "cook", draft: { name: b.name, cookedWeightG: b.cookedWeightG, servings: b.servings, items: [...kept, ...data.add], transcript: data.transcript, batchId: b.id } };
  }
  if (data.kind === "cook") {
    return { kind: "cook", draft: { name: data.name, cookedWeightG: data.cooked_weight_g, servings: data.servings, items: data.items, transcript: data.transcript } };
  }
  const toBlocks = (): ParsedFood[] =>
    (data.meals as { target_bucket: MealBucket | null; items: FoodItem[] }[]).map((m) => ({ target_bucket: m.target_bucket ?? guessBucket(), items: m.items, transcript: data.transcript }));
  if (data.kind === "plan") return { kind: "plan", date: data.target_date, meals: toBlocks(), transcript: data.transcript };
  if (data.kind === "meals") return { kind: "meals", meals: toBlocks(), transcript: data.transcript };
  const bucket: MealBucket = data.target_bucket ?? guessBucket();
  if (data.kind === "portion") {
    const p = portionItem(data.batch_id, data.fraction);
    if (!p) throw new Error("That cooked batch no longer exists.");
    return { kind: "meal", parsed: { target_bucket: bucket, items: [p.item], batch: { id: data.batch_id, fraction: data.fraction }, transcript: data.transcript } };
  }
  return { kind: "meal", parsed: { target_bucket: bucket, items: data.items, transcript: data.transcript } };
}
