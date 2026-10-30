"use client";

import { useEffect, useState } from "react";
import { ChefHat, Mic, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import { FoodItem } from "@/lib/types";
import { scaleItem } from "@/lib/dates";
import { correctInput, type CookDraft } from "@/lib/parseClient";
import { useRecorder } from "@/lib/useRecorder";
import { rescaleItem, useItemBase } from "@/lib/rescale";
import { Modal } from "./ui";

interface Props {
  draft: CookDraft | null;
  onClose: () => void;
  onSave: (d: { name: string; cookedWeightG: number | null; servings: number | null; items: FoodItem[] }) => void;
}

export function CookModal({ draft, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [servings, setServings] = useState("");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [transcript, setTranscript] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { base, carry } = useItemBase();

  useEffect(() => {
    if (!draft) return;
    setName(draft.name);
    setWeight(draft.cookedWeightG ? String(Math.round(draft.cookedWeightG)) : "");
    setServings(draft.servings ? String(draft.servings) : "");
    setItems(draft.items);
    setTranscript(draft.transcript);
    setErr(null);
  }, [draft]);

  // Re-speak corrects the table below; ingredients that aren't mentioned stay as they are.
  const respeak = useRecorder(async (audio) => {
    setBusy(true); setErr(null);
    try {
      const r = await correctInput(audio, { blocks: [{ bucket: "Lunch", items }], name, cookedWeightG: Number(weight) > 0 ? Number(weight) : null, servings: Number(servings) > 0 ? Number(servings) : null }, "cook");
      setItems(r.blocks[0]?.items ?? []);
      if (r.name) setName(r.name);
      if (r.cookedWeightG) setWeight(String(Math.round(r.cookedWeightG)));
      if (r.servings) setServings(String(r.servings));
      if (r.transcript) setTranscript(r.transcript);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  });

  const total = items.reduce((s, i) => s + i.calories, 0);
  const patch = (i: number, p: Partial<FoodItem>) => setItems((xs) => xs.map((x, j) => (j === i ? carry(x, { ...x, ...p }) : x)));
  // The batch total is summed from these rows, so a quantity change moves the whole-batch figures immediately.
  const setQuantity = (i: number, q: string) => setItems((xs) => xs.map((x, j) => (j === i ? carry(x, rescaleItem(base(x), q) ?? { ...x, quantity: q }) : x)));
  const setCal = (i: number, cal: number) => setItems((xs) => xs.map((x, j) => (j === i ? (x.calories > 0 ? scaleItem(x, cal / x.calories) : { ...x, calories: cal }) : x)));
  const w = Number(weight) > 0 ? Number(weight) : null;
  const s = Number(servings) > 0 ? Number(servings) : null;

  return (
    <Modal open={!!draft} onClose={onClose} title="Cooked batch">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><ChefHat className="text-brand" /><h2 className="text-xl font-bold">{draft?.batchId ? "Edit cooked batch" : "Cooked batch"}</h2></div>
        <button className="btn-ghost" onClick={respeak.recording ? respeak.stop : respeak.start} disabled={busy || respeak.processing || !respeak.supported}>
          {busy || respeak.processing ? <RefreshCw size={16} className="animate-spin" /> : respeak.recording ? <Square size={16} className="text-bad" fill="currentColor" /> : <Mic size={16} />}
          {respeak.recording ? `Stop (${respeak.seconds}s)` : "Re-speak"}
        </button>
      </div>
      {transcript && <p className="mb-2 rounded-lg bg-muted px-3 py-1.5 text-xs italic text-subtle">“{transcript}”</p>}
      {(err || respeak.error) && <p role="alert" className="mb-2 text-sm text-bad">{err ?? respeak.error}</p>}
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-1"><label className="label" htmlFor="bn">Dish name</label><input id="bn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="bw">Cooked weight (g)</label><input id="bw" type="number" min={0} className="input" value={weight} placeholder="optional" onChange={(e) => setWeight(e.target.value)} /></div>
        <div><label className="label" htmlFor="bs">Servings</label><input id="bs" type="number" min={0} className="input" value={servings} placeholder="optional" onChange={(e) => setServings(e.target.value)} /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs text-subtle"><tr><th className="pb-2">Ingredient</th><th className="pb-2">Quantity</th><th className="pb-2">Est. Calories</th><th /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2"><input aria-label="Ingredient" className="input" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} /></td>
                <td className="py-1.5 pr-2"><input aria-label="Quantity" className="input" value={it.quantity} onChange={(e) => setQuantity(i, e.target.value)} /></td>
                <td className="w-28 py-1.5 pr-2"><input aria-label="Calories" type="number" min={0} className="input" value={it.calories} onChange={(e) => setCal(i, Math.max(0, Number(e.target.value) || 0))} /></td>
                <td><button aria-label="Remove ingredient" className="p-2 text-subtle hover:text-bad" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setItems((xs) => [...xs, { name: "", quantity: "1 serving", calories: 0, macros: { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, micros: {} }])}><Plus size={16} />Add ingredient</button>
        <span className="text-sm font-medium">Whole batch: {Math.round(total)} kcal{s ? ` · ${Math.round(total / s)} kcal/serving` : ""}</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!items.length || !name.trim() || items.some((i) => !i.name.trim())} onClick={() => onSave({ name: name.trim(), cookedWeightG: w, servings: s, items })}>Save batch</button>
      </div>
    </Modal>
  );
}
