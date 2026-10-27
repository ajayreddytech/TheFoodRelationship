"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { CookedBatch, FoodItem, MealBucket, ParsedFood } from "@/lib/types";
import { CookDraft, portionItem } from "@/lib/parseClient";
import { sumItems, uid } from "@/lib/dates";
import { BatchPanel } from "./BatchPanel";
import { ConfirmModal } from "./ConfirmModal";
import { CookModal } from "./CookModal";

/** Cooked-batch stock with its own portion and edit dialogs; portions are logged to the selected log date. */
export function BatchStock({ incoming, onConsumed }: { incoming?: CookDraft | null; onConsumed?: () => void }) {
  const s = useStore();
  const [parsed, setParsed] = useState<ParsedFood | null>(null);
  const [draft, setDraft] = useState<CookDraft | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { if (incoming) { setDraft(incoming); onConsumed?.(); } }, [incoming, onConsumed]);

  const eat = (b: CookedBatch, fraction: number, bucket: MealBucket) => {
    const p = portionItem(b.id, fraction);
    if (p) setParsed({ target_bucket: bucket, items: [p.item], batch: { id: b.id, fraction } });
  };
  const confirm = (bucket: MealBucket, items: FoodItem[], batch?: { id: string; fraction: number }) => {
    const tagged = batch ? items.map((it) => (it.name.endsWith("(portion)") ? { ...it, batch } : it)) : items;
    s.addMeal(s.selectedDate, bucket, tagged);
    if (batch) s.consumeBatch(batch.id, batch.fraction);
    setNote(`Logged to ${bucket} on ${s.selectedDate}. Open the Log page and submit to save the day.`);
    setParsed(null);
  };

  return (
    <>
      <BatchPanel onEat={eat} onEdit={(b) => setDraft({ name: b.name, cookedWeightG: b.cookedWeightG, servings: b.servings, items: b.ingredients, batchId: b.id })} />
      {note && <p role="status" className="text-sm text-brand">{note}</p>}
      <ConfirmModal parsed={parsed} onClose={() => setParsed(null)} onConfirm={confirm} />
      <CookModal draft={draft} onClose={() => setDraft(null)} onSave={(d) => {
        if (draft?.batchId) s.updateBatch(draft.batchId, { name: d.name, cookedWeightG: d.cookedWeightG, servings: d.servings, ingredients: d.items });
        else s.addBatch({ id: uid(), name: d.name, createdAt: new Date().toISOString(), cookedWeightG: d.cookedWeightG, servings: d.servings, ingredients: d.items, total: sumItems(d.name, "whole batch", d.items), remaining: 1 });
        setDraft(null);
      }} />
    </>
  );
}
