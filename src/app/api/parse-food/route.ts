import { NextResponse } from "next/server";
import { BUCKET_TIMES, MEAL_BUCKETS } from "@/lib/types";
import { MACRO_KEYS, MICRO_KEYS } from "@/lib/nutrients";

export const runtime = "nodejs";
export const maxDuration = 60;

const ITEM_SHAPE = `{"name":string,"quantity":string,"calories":number,
  "macros":{${MACRO_KEYS.map((k) => `"${k}":n`).join(",")}},
  "micros":{${MICRO_KEYS.map((k) => `"${k}":n`).join(",")}}}`;

const COMMON = `All nutrient numbers are totals for the stated quantity (not per 100g). Use realistic estimates; use 0 when unknown or not applicable. Units are in the key names (g, mg, mcg, ml). Return ONLY JSON, no prose or markdown.
Recognise branded products and use that brand's published nutrition when you know it (e.g. "Whittaker's chocolate", "Chapman's butterscotch ice cream", "Chapman's caramel praline ice cream"); put the brand in the item name. When the user names a brand or variant, match that exact product's label values for the stated serving and never substitute a generic equivalent; only fall back to a generic estimate when you do not know that product's label. Never invent a brand the user did not say.
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

const AUTO_SYSTEM = `The user speaks or types about meal prep. Decide which it is and answer in the matching format below.
A) A meal PLAN: they say what they are GOING to eat on a day (today, tomorrow, a weekday...). Use the PLAN format.
B) COOKING / a cooked batch: they list ingredients they cooked or put into one dish, or amend an existing cooked batch. Use the COOK format.
--- PLAN format ---
${PLAN_SYSTEM}
--- COOK format ---
${COOK_SYSTEM}`;

const CORRECT_SYSTEM = `You are correcting a table the user already confirmed-or-reviewed. "current" lists the table: "blocks" (each with "block" index, optional "bucket", and items with "index", name, quantity, calories) and for cooking also name/cooked_weight_g/servings.
The user now speaks ONLY the corrections. Change nothing they did not mention - every other row must stay exactly as is. Never rebuild the table.
Return {"kind":"correction","transcript":string,
"update":[{"block":number,"index":number,"item":${ITEM_SHAPE}}] (rows to change - give the full corrected item with nutrition for the new name/quantity),
"remove":[{"block":number,"index":number}],
"add":[{"block":number|null,"target_bucket":one of ${JSON.stringify(MEAL_BUCKETS)}|null,"item":${ITEM_SHAPE}}] (new rows; block null + target_bucket for a meal that is not in the table yet),
"set_bucket":[{"block":number,"target_bucket":one of ${JSON.stringify(MEAL_BUCKETS)}}],
"target_date":"YYYY-MM-DD"|null (only when the user changes the day of a plan),
"name":string|null,"cooked_weight_g":number|null,"servings":number|null (only when the user changes them; otherwise null)}.
Use empty arrays when nothing applies. Meal buckets: ${BUCKET_TEXT}.
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

/** Pulls the JSON object out of a model reply, tolerating ```json fences and stray prose around it. */
function extractJson(out: string) {
  const t = out.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* fall back to the outermost braces */ }
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("No JSON object in model reply");
  return JSON.parse(t.slice(s, e + 1));
}

interface Body {
  text?: unknown;
  hour?: unknown;
  mode?: unknown;
  today?: unknown;
  audio?: { mimeType?: unknown; data?: unknown };
  batches?: { id: string; name: string; cooked_weight_g: number | null; remaining: number; ingredients?: string[] }[];
  current?: unknown;
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

  const mode = body.mode === "cook" ? "cook" : body.mode === "plan" ? "plan" : body.mode === "auto" ? "auto" : body.mode === "correct" ? "correct" : "meal";
  const currentJson = mode === "correct" ? JSON.stringify(body.current ?? null).slice(0, 20000) : "";
  if (mode === "correct" && (!body.current || typeof body.current !== "object")) return json("Nothing to correct.", 400);
  const todayStr = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = new Date(`${todayStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const hour = typeof body.hour === "number" ? body.hour : new Date().getHours();
  const batches = Array.isArray(body.batches) && mode !== "correct" ? body.batches.filter((b) => mode === "cook" || mode === "auto" || b.remaining > 0).slice(0, 20) : [];

  const parts: Record<string, unknown>[] = [
    { text: `Current local hour: ${hour}\nToday: ${todayStr} (${weekday})\n${batches.length ? `cooked_batches: ${JSON.stringify(batches)}\n` : ""}${currentJson ? `current: ${currentJson}\n` : ""}${text ? `User said: ${text}` : "The user's request is in the attached audio."}` },
  ];
  if (audioData) parts.push({ inlineData: { mimeType: audioMime, data: audioData } });

  const system = { cook: COOK_SYSTEM, plan: PLAN_SYSTEM, auto: AUTO_SYSTEM, correct: CORRECT_SYSTEM, meal: MEAL_SYSTEM }[mode];
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  // Free-tier, fast models first; fall back if one is retired (404) or overloaded.
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const models = [primary, ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map((s) => s.trim()).filter(Boolean)]
    .filter((m, i, a) => a.indexOf(m) === i);

  const ask = async (): Promise<Response | null> => {
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
    return res;
  };

  // A reply that isn't valid JSON is retried once with a fresh call before the user sees an error.
  let raw: any = null;
  for (let attempt = 0; attempt < 2 && raw == null; attempt++) {
    const res = await ask();
    if (!res) return json("The AI service timed out. Please try again.", 504);
    if (!res.ok) return json(res.status === 503 || res.status === 429 ? "The AI service is busy right now. Please try again in a moment." : `Gemini request failed (${res.status}).`, 502);
    try {
      const data = await res.json();
      raw = extractJson(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    } catch {
      raw = null;
    }
  }
  if (raw == null) return json("Could not understand the AI response. Please try again.", 502);

  try {
    const transcript = typeof raw?.transcript === "string" ? raw.transcript.slice(0, 2000) : text;
    const bucket = MEAL_BUCKETS.includes(raw?.target_bucket) ? raw.target_bucket : null;

    if (mode === "correct") {
      const idx = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
      const bk = (v: unknown) => (MEAL_BUCKETS.includes(v as never) ? (v as string) : null);
      const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).slice(0, 60) : []);
      const update = arr(raw?.update).flatMap((u) => { const b = idx(u?.block), i = idx(u?.index), it = sanitizeItems([u?.item])[0]; return b != null && i != null && u?.item ? [{ block: b, index: i, item: it }] : []; });
      const remove = arr(raw?.remove).flatMap((u) => { const b = idx(u?.block), i = idx(u?.index); return b != null && i != null ? [{ block: b, index: i }] : []; });
      const add = arr(raw?.add).flatMap((u) => (u?.item ? [{ block: idx(u?.block), target_bucket: bk(u?.target_bucket), item: sanitizeItems([u.item])[0] }] : []));
      const set_bucket = arr(raw?.set_bucket).flatMap((u) => { const b = idx(u?.block), t = bk(u?.target_bucket); return b != null && t ? [{ block: b, target_bucket: t }] : []; });
      const target_date = typeof raw?.target_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.target_date) ? raw.target_date : null;
      const name = typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : null;
      const cooked_weight_g = typeof raw?.cooked_weight_g === "number" && raw.cooked_weight_g > 0 ? raw.cooked_weight_g : null;
      const servings = typeof raw?.servings === "number" && raw.servings > 0 ? raw.servings : null;
      if (!update.length && !remove.length && !add.length && !set_bucket.length && !target_date && !name && !cooked_weight_g && !servings) {
        return json(transcript ? `Couldn't tell what to change from "${transcript}". Try again.` : "Couldn't tell what to change. Try again.", 422);
      }
      return NextResponse.json({ kind: "correction", transcript, update, remove, add, set_bucket, target_date, name, cooked_weight_g, servings });
    }
    // "auto" decides plan vs cook from what the model returned.
    const eff = mode === "auto" ? (raw?.kind === "plan" ? "plan" : "cook") : mode;

    if (raw?.kind === "portion" && batches.some((b) => b.id === raw.batch_id)) {
      const fraction = Math.min(1, num(raw.fraction));
      if (fraction <= 0) return json("Couldn't work out how much of the batch you ate.", 422);
      return NextResponse.json({ kind: "portion", transcript, target_bucket: bucket, batch_id: raw.batch_id, fraction });
    }
    if (eff === "cook" && raw?.kind === "cook_update" && batches.some((b) => b.id === raw.batch_id)) {
      const add = sanitizeItems(raw.add);
      const remove = (Array.isArray(raw.remove) ? raw.remove : []).map((r: unknown) => String(r).slice(0, 120));
      if (!add.length && !remove.length) return json("Couldn't tell what to add or remove.", 422);
      return NextResponse.json({ kind: "cook_update", transcript, batch_id: raw.batch_id, add, remove });
    }
    if (eff !== "cook") {
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
      if (eff === "plan") {
        const d = typeof raw?.target_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.target_date) ? raw.target_date : todayStr;
        return NextResponse.json({ kind: "plan", transcript, target_date: d, meals });
      }
      return NextResponse.json({ kind: "meals", transcript, meals });
    }
    const items = sanitizeItems(raw?.items);
    if (!items.length) return json(transcript ? `No food items recognised in "${transcript}". Try rephrasing.` : "No food items recognised. Try rephrasing.", 422);
    if (eff === "cook") {
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
