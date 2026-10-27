import { useStore } from "./store";
import { scaleItem, todayISO } from "./dates";
import { BUCKET_TIMES, FoodItem, MEAL_BUCKETS, MealBucket, ParsedFood } from "./types";
import type { RecordedAudio } from "./useRecorder";

export type ParseMode = "meal" | "cook" | "plan" | "auto";

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

export interface CorrectionBlock { bucket: MealBucket; items: FoodItem[] }
export interface CorrectionContext { blocks: CorrectionBlock[]; date?: string; name?: string; cookedWeightG?: number | null; servings?: number | null }

interface Correction {
  transcript?: string;
  update: { block: number; index: number; item: FoodItem }[];
  remove: { block: number; index: number }[];
  add: { block: number | null; target_bucket: MealBucket | null; item: FoodItem }[];
  set_bucket: { block: number; target_bucket: MealBucket }[];
  target_date: string | null;
  name: string | null;
  cooked_weight_g: number | null;
  servings: number | null;
}

export interface CorrectionResult extends CorrectionContext { transcript?: string }

/**
 * Re-speak: sends the CURRENT table plus the new recording, and applies only the spoken changes to it.
 * Rows the user did not mention are left exactly as they were.
 */
export async function correctInput(audio: RecordedAudio, ctx: CorrectionContext, target: "meal" | "plan" | "cook"): Promise<CorrectionResult> {
  const current = {
    target,
    date: ctx.date,
    name: ctx.name,
    cooked_weight_g: ctx.cookedWeightG,
    servings: ctx.servings,
    blocks: ctx.blocks.map((b, block) => ({ block, bucket: target === "meal" ? b.bucket : undefined, items: b.items.map((i, index) => ({ index, name: i.name, quantity: i.quantity, calories: Math.round(i.calories) })) })),
  };
  let res: Response;
  try {
    res = await fetch("/api/parse-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio, mode: "correct", current, hour: new Date().getHours(), today: todayISO() }),
    });
  } catch {
    throw new Error("You appear to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Could not parse that.");
  const c = data as Correction;

  const rm = new Set(c.remove.map((r) => `${r.block}:${r.index}`));
  const up = new Map(c.update.map((u) => [`${u.block}:${u.index}`, u.item]));
  let blocks: CorrectionBlock[] = ctx.blocks.map((b, bi) => ({
    ...b,
    items: b.items.flatMap((it, ii) => (rm.has(`${bi}:${ii}`) ? [] : [up.has(`${bi}:${ii}`) ? { ...it, ...up.get(`${bi}:${ii}`)! } : it])),
  }));
  for (const s of c.set_bucket) if (blocks[s.block]) blocks[s.block] = { ...blocks[s.block], bucket: s.target_bucket };
  for (const a of c.add) {
    let bi = a.block != null && a.block < blocks.length ? a.block : -1;
    if (bi < 0 && target !== "meal") bi = 0; // plans and batches have a single table
    if (bi < 0) {
      const want = a.target_bucket ?? guessBucket();
      bi = blocks.findIndex((b) => b.bucket === want);
      if (bi < 0) { blocks = [...blocks, { bucket: want, items: [] }]; bi = blocks.length - 1; }
    }
    blocks[bi] = { ...blocks[bi], items: [...blocks[bi].items, a.item] };
  }
  blocks = blocks.filter((b) => b.items.length > 0);
  return {
    blocks,
    transcript: c.transcript,
    date: c.target_date ?? ctx.date,
    name: c.name ?? ctx.name,
    cookedWeightG: c.cooked_weight_g ?? ctx.cookedWeightG,
    servings: c.servings ?? ctx.servings,
  };
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
