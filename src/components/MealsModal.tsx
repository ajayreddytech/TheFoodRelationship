"use client";

import { useEffect, useState } from "react";
import { Mic, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import { BUCKET_TIMES, FoodItem, MEAL_BUCKETS, MealBucket, ParsedFood } from "@/lib/types";
import { scaleItem, todayISO } from "@/lib/dates";
import { correctInput, ParseMode } from "@/lib/parseClient";
import { useRecorder } from "@/lib/useRecorder";
import { Modal } from "./ui";

export interface MealBlock { bucket: MealBucket; items: FoodItem[] }

/** A plan is one whole-day meal, so every parsed block is flattened into a single block. */
const toBlocks = (mode: string, bs: ParsedFood[]): MealBlock[] =>
  mode === "plan" ? [{ bucket: "Lunch", items: bs.flatMap((b) => b.items) }] : bs.map((b) => ({ bucket: b.target_bucket, items: b.items }));

interface Props {
  open: boolean;
  /** "meal" confirms logged meals; "plan" also shows an editable plan date. */
  mode: Exclude<ParseMode, "cook" | "auto">;
  blocks: ParsedFood[];
  transcript?: string;
  date?: string;
  onClose: () => void;
  onConfirm: (blocks: MealBlock[], date: string) => void;
}

const BLANK: FoodItem = { name: "", quantity: "1 serving", calories: 0, macros: { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, micros: {} };

export function MealsModal({ open, mode, blocks: initial, transcript: t0, date: d0, onClose, onConfirm }: Props) {
  const [blocks, setBlocks] = useState<MealBlock[]>([]);
  const [date, setDate] = useState(todayISO());
  const [transcript, setTranscript] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBlocks(toBlocks(mode, initial));
    setDate(d0 ?? todayISO());
    setTranscript(t0);
    setErr(null);
  }, [open, initial, d0, t0, mode]);

  // Re-speak corrects the tables below; rows that aren't mentioned stay as they are.
  const respeak = useRecorder(async (audio) => {
    setBusy(true); setErr(null);
    try {
      const r = await correctInput(audio, { blocks, date }, mode);
      setBlocks(r.blocks);
      if (r.transcript) setTranscript(r.transcript);
      if (mode === "plan" && r.date && r.date >= todayISO()) setDate(r.date);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  });

  const patchBlock = (bi: number, fn: (items: FoodItem[]) => FoodItem[]) => setBlocks((bs) => bs.map((b, i) => (i === bi ? { ...b, items: fn(b.items) } : b)));
  const patchItem = (bi: number, ii: number, p: Partial<FoodItem>) => patchBlock(bi, (xs) => xs.map((x, j) => (j === ii ? { ...x, ...p } : x)));
  const setCalories = (bi: number, ii: number, cal: number) =>
    patchBlock(bi, (xs) => xs.map((x, j) => (j === ii ? (x.calories > 0 ? scaleItem(x, cal / x.calories) : { ...x, calories: cal }) : x)));
  const grand = blocks.reduce((s, b) => s + b.items.reduce((a, i) => a + i.calories, 0), 0);
  const valid = blocks.length > 0 && blocks.every((b) => b.items.length && b.items.every((i) => i.name.trim()));

  return (
    <Modal open={open} onClose={onClose} title={mode === "plan" ? "Confirm meal plan" : "Confirm meals"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {mode === "plan" ? (
          <label className="flex items-center gap-2 text-sm font-medium">Plan for
            <input type="date" aria-label="Plan date" className="input !w-auto" value={date} min={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        ) : <span className="text-sm text-subtle">{blocks.length} meal{blocks.length === 1 ? "" : "s"} found</span>}
        <button className="btn-ghost" onClick={respeak.recording ? respeak.stop : respeak.start} disabled={busy || respeak.processing || !respeak.supported}>
          {busy || respeak.processing ? <RefreshCw size={16} className="animate-spin" /> : respeak.recording ? <Square size={16} className="text-bad" fill="currentColor" /> : <Mic size={16} />}
          {respeak.recording ? `Stop (${respeak.seconds}s)` : "Re-speak"}
        </button>
      </div>
      {transcript && <p className="mb-3 rounded-lg bg-muted px-3 py-1.5 text-xs italic text-subtle">“{transcript}”</p>}
      {(err || respeak.error) && <p role="alert" className="mb-2 text-sm text-bad">{err ?? respeak.error}</p>}

      <div className="space-y-4">
        {blocks.map((b, bi) => (
          <div key={bi} className="rounded-2xl border border-line bg-muted/30 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              {mode === "plan" ? <div className="text-xl font-bold">Whole day</div> : <div>
                <select aria-label="Meal bucket" value={b.bucket} onChange={(e) => setBlocks((bs) => bs.map((x, i) => (i === bi ? { ...x, bucket: e.target.value as MealBucket } : x)))} className="rounded-lg bg-transparent text-xl font-bold outline-none">
                  {MEAL_BUCKETS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <div className="text-xs text-subtle">{BUCKET_TIMES[b.bucket]}</div>
              </div>}
                           {mode !== "plan" && <button aria-label="Remove this meal" className="p-2 text-subtle hover:text-bad" onClick={() => setBlocks((bs) => bs.filter((_, i) => i !== bi))}><Trash2 size={16} /></button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-subtle"><tr><th className="pb-1">Item</th><th className="pb-1">Quantity</th><th className="pb-1">Est. Calories</th><th /></tr></thead>
                <tbody>
                  {b.items.map((it, ii) => (
                    <tr key={ii} className="border-t border-line">
                      <td className="py-1.5 pr-2"><input aria-label="Item" className="input" value={it.name} onChange={(e) => patchItem(bi, ii, { name: e.target.value })} /></td>
                      <td className="py-1.5 pr-2"><input aria-label="Quantity" className="input" value={it.quantity} onChange={(e) => patchItem(bi, ii, { quantity: e.target.value })} /></td>
                      <td className="w-28 py-1.5 pr-2"><input aria-label="Calories" type="number" min={0} className="input" value={it.calories} onChange={(e) => setCalories(bi, ii, Math.max(0, Number(e.target.value) || 0))} /></td>
                      <td><button aria-label="Remove item" className="p-2 text-subtle hover:text-bad" onClick={() => patchBlock(bi, (xs) => xs.filter((_, j) => j !== ii))}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button className="btn-ghost !py-1.5" onClick={() => patchBlock(bi, (xs) => [...xs, { ...BLANK }])}><Plus size={14} />Add item</button>
              <span className="text-sm font-medium text-orange-500">{Math.round(b.items.reduce((a, i) => a + i.calories, 0))} kcal</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {mode !== "plan" ? <button className="btn-ghost" onClick={() => setBlocks((bs) => [...bs, { bucket: "Breakfast", items: [{ ...BLANK }] }])}><Plus size={16} />Add another meal</button> : <span />}
        <span className="text-sm font-semibold">Total: {Math.round(grand)} kcal</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={() => onConfirm(blocks, date)}>{mode === "plan" ? "Save plan" : `Confirm ${blocks.length > 1 ? "all" : ""}`}</button>
      </div>
    </Modal>
  );
}
