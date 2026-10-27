"use client";

import { useEffect, useState } from "react";
import { Mic, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import { FoodItem, MEAL_BUCKETS, MealBucket, ParsedFood, BUCKET_TIMES } from "@/lib/types";
import { scaleItem } from "@/lib/dates";
import { parseInput } from "@/lib/parseClient";
import { useRecorder } from "@/lib/useRecorder";
import { Modal } from "./ui";

interface Props {
  parsed: ParsedFood | null;
  onClose: () => void;
  onConfirm: (bucket: MealBucket, items: FoodItem[], batch?: { id: string; fraction: number }) => void;
}

const BLANK: FoodItem = { name: "", quantity: "1 serving", calories: 0, macros: { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, micros: {} };

export function ConfirmModal({ parsed, onClose, onConfirm }: Props) {
  const [bucket, setBucket] = useState<MealBucket>("Breakfast");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [batch, setBatch] = useState<ParsedFood["batch"]>();
  const [origTotal, setOrigTotal] = useState(0);
  const [transcript, setTranscript] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed) return;
    setBucket(parsed.target_bucket);
    setItems(parsed.items);
    setBatch(parsed.batch);
    setOrigTotal(parsed.items.reduce((s, i) => s + i.calories, 0));
    setTranscript(parsed.transcript);
    setErr(null);
  }, [parsed]);

  const respeak = useRecorder(async (audio) => {
    setBusy(true); setErr(null);
    try {
      const r0 = await parseInput({ audio, mode: "meal" });
      const r = r0.kind === "meals" ? { kind: "meal" as const, parsed: r0.meals[0] } : r0;
      if (r.kind !== "meal") throw new Error("Please describe food you ate, not a recipe.");
      setBucket(r.parsed.target_bucket); setItems(r.parsed.items); setBatch(r.parsed.batch);
      setOrigTotal(r.parsed.items.reduce((s, i) => s + i.calories, 0)); setTranscript(r.parsed.transcript);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  });

  const patch = (i: number, p: Partial<FoodItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setCalories = (i: number, cal: number) =>
    setItems((xs) => xs.map((x, j) => (j === i ? (x.calories > 0 ? scaleItem(x, cal / x.calories) : { ...x, calories: cal }) : x)));
  const total = items.reduce((s, i) => s + i.calories, 0);

  // If calories of a batch portion were edited, deduct a proportional share of the batch.
  const confirm = () => {
    const b = batch ? { id: batch.id, fraction: origTotal > 0 ? Math.min(1, (batch.fraction * total) / origTotal) : batch.fraction } : undefined;
    onConfirm(bucket, items, b);
  };

  return (
    <Modal open={!!parsed} onClose={onClose} title="Confirm meal">
      {parsed?.editId && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">Editing logged meal</p>}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div>
          <select aria-label="Meal bucket" value={bucket} onChange={(e) => setBucket(e.target.value as MealBucket)} className="rounded-lg bg-transparent text-2xl font-bold outline-none">
            {MEAL_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="text-xs text-subtle">{BUCKET_TIMES[bucket]}</div>
        </div>
        <button className="btn-ghost" onClick={respeak.recording ? respeak.stop : respeak.start} disabled={busy || respeak.processing || !respeak.supported}>
          {busy || respeak.processing ? <RefreshCw size={16} className="animate-spin" /> : respeak.recording ? <Square size={16} className="text-bad" fill="currentColor" /> : <Mic size={16} />}
          {respeak.recording ? `Stop (${respeak.seconds}s)` : "Re-speak"}
        </button>
      </div>
      {transcript && <p className="mb-2 rounded-lg bg-muted px-3 py-1.5 text-xs italic text-subtle">“{transcript}”</p>}
      {batch && <p className="mb-2 text-xs text-brand">Portion of your cooked batch — it will be deducted from what&apos;s left.</p>}
      {(err || respeak.error) && <p role="alert" className="mb-2 text-sm text-bad">{err ?? respeak.error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs text-subtle">
            <tr><th className="pb-2">Item</th><th className="pb-2">Quantity</th><th className="pb-2">Est. Calories</th><th /></tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2"><input aria-label="Item" className="input" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} /></td>
                <td className="py-1.5 pr-2"><input aria-label="Quantity" className="input" value={it.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} /></td>
                <td className="w-28 py-1.5 pr-2"><input aria-label="Calories" type="number" min={0} className="input" value={it.calories} onChange={(e) => setCalories(i, Math.max(0, Number(e.target.value) || 0))} /></td>
                <td><button aria-label="Remove item" className="p-2 text-subtle hover:text-bad" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setItems((xs) => [...xs, { ...BLANK }])}><Plus size={16} />Add item</button>
        <span className="text-sm font-medium">Total: {Math.round(total)} kcal</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!items.length || items.some((i) => !i.name.trim())} onClick={confirm}>Confirm</button>
      </div>
    </Modal>
  );
}
