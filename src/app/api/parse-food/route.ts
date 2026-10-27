import { NextResponse } from "next/server";
import { BUCKET_TIMES, MEAL_BUCKETS } from "@/lib/types";
import { MACRO_KEYS, MICRO_KEYS } from "@/lib/nutrients";

export const runtime = "nodejs";
export const maxDuration = 60;

const ITEM_SHAPE = `{"name":string,"quantity":string,"calories":number,
  "macros":{${MACRO_KEYS.map((k) => `"${k}":n`).join(",")}},
  "micros":{${MICRO_KEYS.map((k) => `"${k}":n`).join(",")}}}`;

const COMMON = `All nutrient numbers are totals for the stated quantity (not per 100g). Use realistic estimates; use 0 when unknown or not applicable. Units are in the key names (g, mg, mcg, ml). Return ONLY JSON, no prose or markdown.
Recognise branded products and use that brand's published nutrition when you know it (e.g. "Whittaker's chocolate", "Chapman's butterscotch ice cream", "Chapman's caramel praline ice cream"); put the brand in the item name. Never invent a brand the user did not say.
If audio is provided, first transcribe it faithfully and put the transcript in "transcript"; otherwise set "transcript" to the user's text.`;

const BUCKET_TEXT = MEAL_BUCKETS.map((b) => `${b} (${BUCKET_TIMES[b]})`).join("; ");

const MEAL_SYSTEM = `You are a nutrition parser. The user describes food they ate. Meal buckets and their usual time windows: ${BUCKET_TEXT}.
Pick the bucket the user names (e.g. "dinner" => "Dinner", "lunch" => "Lunch", "breakfast" => "Breakfast", "snack" => the nearest snack bucket); the spoken meal name always wins over the clock. Only if no meal is named, infer from "current local hour" and the windows.
The user may describe SEVERAL meals in one go (e.g. "breakfast was X, lunch was Y, detox drink was Z"): split them into separate meals, one per bucket, merging items that belong to the same bucket.
Return {"kind":"meal","transcript":string,"meals":[{"target_bucket":one of ${JSON.stringify(MEAL_BUCKETS)},"items":[${ITEM_SHAPE}]}]}.
If the user says they ate part of a previously cooked batch (listed in "cooked_batches"), return instead
{"kind":"portion","transcript":string,"target_bucket":...,"batch_id":string,"fraction":number} where fraction (0-1) is the share of the WHOLE batch eaten
(e.g. "a third" = 0.33; "300g" with cooked_weight_g 1200 = 0.25; "1 of 4 servings" = 0.25; "the rest" = remaining).
${COMMON}`;

const PLAN_SYSTEM = `You are a nutrition parser for meal PLANS. The user says what they are GOING to eat, for today or for another day (e.g. "tomorrow", "day after tomorrow", "in 3 days", "on Friday"). Meal buckets: ${BUCKET_TEXT}.
Resolve the day relative to "Today" (given as YYYY-MM-DD with its weekday) and return {"kind":"plan","transcript":string,"target_date":"YYYY-MM-DD","meals":[{"target_bucket":one of ${JSON.stringify(MEAL_BUCKETS)},"items":[${ITEM_SHAPE}]}]}.
Split the plan into separate meals, one per bucket named by the user (the spoken meal name wins). If no day is mentioned, use today.
${COMMON}`;

const COOK_SYSTEM = `You are a nutrition parser for home cooking. The user lists every ingredient put into one dish/batch, possibly stating raw weights (e.g. "raw white rice") and oil quantities.
Compute nutrition for each ingredient exactly as stated (raw stays raw) so the sum is the whole preparation.
Return {"kind":"cook","transcript":string,"name":string (short dish name),"cooked_weight_g":number|null (your best estimate of the final cooked weight incl. absorbed water; null if impossible),"servings":number|null (only if user stated),"items":[${ITEM_SHAPE}]} with one item per ingredient.
If the user says they forgot to add something to, added something extra to, or want to remove something from a dish listed in "cooked_batches" (match by name), return instead
{"kind":"cook_update","transcript":string,"batch_id":string,"add":[${ITEM_SHAPE}],"remove":[ingredient names exactly as listed in that batch's ingredients]}. Otherwise treat it as a new dish.
${COMMON}`;

const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);

interface RawItem { name?: unknown; quantity?: unknown; calories?: unknown; macros?: Record<string, unknown>; micros?: Record<string, unknown> }

function sanitizeItems(items: unknown) {
  const arr = (Array.isArray(items) ? items : []) as RawItem[];
  return arr.slice(0, 60).map((i) => ({
    name: String(i?.name ?? "Item").slice(0, 120),
    quantity: String(i?.quantity ?? "1 serving").slice(0, 60),
    calories: num(i?.calories),
    macros: Object.fromEntries(MACRO_KEYS.map((k) => [k, num(i?.macros?.[k])])),
    micros: Object.fromEntries(MICRO_KEYS.map((k) => [k, num(i?.micros?.[k])])),
  }));
}

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

interface Body {
  text?: unknown;
  hour?: unknown;
  mode?: unknown;
  today?: unknown;
  audio?: { mimeType?: unknown; data?: unknown };
  batches?: { id: string; name: string; cooked_weight_g: number | null; remaining: number; ingredients?: string[] }[];
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json("GEMINI_API_KEY is not configured on the server.", 503);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json("Invalid JSON body.", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const audioData = typeof body.audio?.data === "string" ? body.audio.data : "";
  const audioMime = typeof body.audio?.mimeType === "string" ? body.audio.mimeType : "audio/wav";
  if (!text && !audioData) return json("Provide text or audio.", 400);
  if (text.length > 2000) return json("Text is too long (max 2000 characters).", 400);
  if (audioData.length > 6_000_000) return json("Recording is too long. Keep it under about a minute.", 413);
  if (audioData && !/^audio\/[\w.+-]+$/.test(audioMime)) return json("Unsupported audio type.", 400);

  const mode = body.mode === "cook" ? "cook" : body.mode === "plan" ? "plan" : "meal";
  const todayStr = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = new Date(`${todayStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const hour = typeof body.hour === "number" ? body.hour : new Date().getHours();
  const batches = Array.isArray(body.batches) ? body.batches.filter((b) => mode === "cook" || b.remaining > 0).slice(0, 20) : [];

  const parts: Record<string, unknown>[] = [
    { text: `Current local hour: ${hour}\nToday: ${todayStr} (${weekday})\n${batches.length ? `cooked_batches: ${JSON.stringify(batches)}\n` : ""}${text ? `User said: ${text}` : "The user's request is in the attached audio."}` },
  ];
  if (audioData) parts.push({ inlineData: { mimeType: audioMime, data: audioData } });

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: mode === "cook" ? COOK_SYSTEM : mode === "plan" ? PLAN_SYSTEM : MEAL_SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  // Free-tier, fast models first; fall back if one is retired (404) or overloaded.
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const models = [primary, ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map((s) => s.trim()).filter(Boolean)]
    .filter((m, i, a) => a.indexOf(m) === i);

  let res: Response | null = null;
  outer: for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: payload,
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        res = null;
        continue outer;
      }
      if (res.ok) break outer;
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      continue outer; // 404 / 400 etc: try next model
    }
  }
  if (!res) return json("The AI service timed out. Please try again.", 504);
  if (!res.ok) return json(res.status === 503 || res.status === 429 ? "The AI service is busy right now. Please try again in a moment." : `Gemini request failed (${res.status}).`, 502);

  try {
    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const raw = JSON.parse(out);
    const transcript = typeof raw?.transcript === "string" ? raw.transcript.slice(0, 2000) : text;
    const bucket = MEAL_BUCKETS.includes(raw?.target_bucket) ? raw.target_bucket : null;

    if (raw?.kind === "portion" && batches.some((b) => b.id === raw.batch_id)) {
      const fraction = Math.min(1, num(raw.fraction));
      if (fraction <= 0) return json("Couldn't work out how much of the batch you ate.", 422);
      return NextResponse.json({ kind: "portion", transcript, target_bucket: bucket, batch_id: raw.batch_id, fraction });
    }
    if (mode === "cook" && raw?.kind === "cook_update" && batches.some((b) => b.id === raw.batch_id)) {
      const add = sanitizeItems(raw.add);
      const remove = (Array.isArray(raw.remove) ? raw.remove : []).map((r: unknown) => String(r).slice(0, 120));
      if (!add.length && !remove.length) return json("Couldn't tell what to add or remove.", 422);
      return NextResponse.json({ kind: "cook_update", transcript, batch_id: raw.batch_id, add, remove });
    }
    if (mode !== "cook") {
      const srcMeals = Array.isArray(raw?.meals) ? raw.meals : raw?.items ? [{ target_bucket: raw.target_bucket, items: raw.items }] : [];
      const merged = new Map<string, ReturnType<typeof sanitizeItems>>();
      for (const m of srcMeals.slice(0, 12)) {
        const its = sanitizeItems(m?.items);
        if (!its.length) continue;
        const b: string = MEAL_BUCKETS.includes(m?.target_bucket) ? m.target_bucket : "";
        merged.set(b, [...(merged.get(b) ?? []), ...its]);
      }
      if (!merged.size) return json(transcript ? `No food items recognised in "${transcript}". Try rephrasing.` : "No food items recognised. Try rephrasing.", 422);
      const meals = [...merged].map(([target_bucket, its]) => ({ target_bucket: target_bucket || null, items: its }));
      if (mode === "plan") {
        const d = typeof raw?.target_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.target_date) ? raw.target_date : todayStr;
        return NextResponse.json({ kind: "plan", transcript, target_date: d, meals });
      }
      return NextResponse.json({ kind: "meals", transcript, meals });
    }
    const items = sanitizeItems(raw?.items);
    if (!items.length) return json(transcript ? `No food items recognised in "${transcript}". Try rephrasing.` : "No food items recognised. Try rephrasing.", 422);
    if (mode === "cook") {
      return NextResponse.json({
        kind: "cook", transcript, items,
        name: String(raw?.name ?? "Cooked dish").slice(0, 80),
        cooked_weight_g: raw?.cooked_weight_g == null ? null : num(raw.cooked_weight_g) || null,
        servings: raw?.servings == null ? null : num(raw.servings) || null,
      });
    }
    return NextResponse.json({ kind: "meal", transcript, target_bucket: bucket, items });
  } catch {
    return json("Could not understand the AI response.", 502);
  }
}
