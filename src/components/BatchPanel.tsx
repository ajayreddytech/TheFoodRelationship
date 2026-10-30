"use client";

import { useState } from "react";
import { ChefHat, ChevronDown, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { useStore } from "@/lib/store";
import { BUCKET_TIMES, CookedBatch, MEAL_BUCKETS, MealBucket } from "@/lib/types";
import { guessBucket } from "@/lib/parseClient";
import { Empty, ProgressBar, Section } from "./ui";
import { NutrientModal } from "./NutrientModal";

const PRESETS = [0.125, 0.25, 1 / 3, 0.5, 0.75, 1];
const PRESET_LABEL = ["⅛", "¼", "⅓", "½", "¾", "All"];

interface Handlers {
  onEat: (b: CookedBatch, fraction: number, bucket: MealBucket) => void;
  onEdit: (b: CookedBatch) => void;
}

function BatchRow({ b, onEat, onEdit }: { b: CookedBatch } & Handlers) {
  const removeBatch = useStore((s) => s.removeBatch);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<"all" | null>(null);
  const [eating, setEating] = useState(false);
  const [mode, setMode] = useState<"fraction" | "grams" | "servings">("fraction");
  const [frac, setFrac] = useState(0.25);
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<MealBucket>(guessBucket());

  const amt = Number(amount);
  const fraction =
    mode === "fraction" ? frac
    : mode === "grams" ? (b.cookedWeightG && amt > 0 ? amt / b.cookedWeightG : 0)
    : (b.servings && amt > 0 ? amt / b.servings : 0);
  const eff = Math.min(fraction, b.remaining);
  const done = b.remaining <= 0;

  return (
    <div className={`rounded-xl border border-line bg-muted/40 ${done ? "opacity-60" : ""}`}>
      <button className="flex w-full items-center gap-2 p-2.5 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{b.name}</div>
          <div className="text-[11px] text-subtle">{done ? "Finished" : `${Math.round(b.remaining * 100)}% left · ${Math.round(b.total.calories * b.remaining)} kcal`}</div>
          <div className="mt-1"><ProgressBar value={b.remaining} max={1} /></div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>

      <button className="mx-2.5 mb-2.5 w-[calc(100%-1.25rem)] rounded-lg border border-line py-1.5 text-xs font-semibold text-brand hover:bg-brand/10" onClick={() => setProfile("all")}>Nutrition profile</button>
      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          <p className="text-xs text-subtle">
            {Math.round(b.total.calories)} kcal whole batch
            {b.cookedWeightG ? ` · ${Math.round(b.cookedWeightG)} g` : ""}
            {b.servings ? ` · ${b.servings} servings (${Math.round(b.total.calories / b.servings)} kcal each)` : ""}
          </p>
          <ul className="space-y-0.5 text-xs">
            {b.ingredients.map((i, k) => (
              <li key={k} className="flex justify-between gap-2"><span>{i.name} · {i.quantity}</span><span className="tabular-nums text-orange-500">{Math.round(i.calories)} kcal</span></li>
            ))}
          </ul>
          <div className="flex gap-2">
            {!done && <button className="btn-primary flex-1 !py-2" onClick={() => setEating((e) => !e)}><UtensilsCrossed size={15} />Eat a portion</button>}
            <button className="btn-ghost !py-2" aria-label={`Edit ${b.name}`} onClick={() => onEdit(b)}><Pencil size={15} />Edit</button>
            <button aria-label={`Delete ${b.name}`} className="btn-ghost !py-2 text-bad" onClick={() => confirm(`Delete "${b.name}"?`) && removeBatch(b.id)}><Trash2 size={15} /></button>
          </div>

          {eating && !done && (
            <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
              <div className="flex rounded-lg bg-muted p-1 text-xs">
                {(["fraction", "grams", "servings"] as const).map((m) => (
                  <button key={m} disabled={(m === "grams" && !b.cookedWeightG) || (m === "servings" && !b.servings)} onClick={() => { setMode(m); setAmount(""); }}
                    className={`flex-1 rounded-md px-2 py-1 capitalize disabled:opacity-40 ${mode === m ? "bg-brand text-white" : "text-subtle"}`}>{m === "fraction" ? "Share" : m}</button>))}
              </div>
              {mode === "fraction" ? (
                <div className="grid grid-cols-6 gap-1">
                  {PRESETS.map((p, i) => <button key={i} onClick={() => setFrac(p)} className={`rounded-lg border py-1.5 text-sm ${Math.abs(frac - p) < 1e-6 ? "border-brand bg-brand/15" : "border-line"}`}>{PRESET_LABEL[i]}</button>)}
                </div>
              ) : (
                <input aria-label={mode === "grams" ? "Grams eaten" : "Servings eaten"} type="number" min={0} className="input" placeholder={mode === "grams" ? "Grams you ate" : "Servings you ate"} value={amount} onChange={(e) => setAmount(e.target.value)} />
              )}
              <select aria-label="Meal bucket" className="input" value={bucket} onChange={(e) => setBucket(e.target.value as MealBucket)}>
                {MEAL_BUCKETS.map((x) => <option key={x} value={x}>{x} ({BUCKET_TIMES[x]})</option>)}
              </select>
              <p className="text-xs text-subtle">{eff > 0 ? `≈ ${Math.round(b.total.calories * eff)} kcal (${Math.round(eff * 100)}% of batch)` : "Enter an amount"}{fraction > b.remaining && eff > 0 ? " — capped at what's left" : ""}</p>
              <button className="btn-primary w-full !py-2" disabled={eff <= 0} onClick={() => { onEat(b, eff, bucket); setEating(false); setOpen(false); }}>Review &amp; log</button>
            </div>
          )}
        </div>
      )}
      {/* Sources come from the constituent ingredients, so the top-5 lists name what actually supplies each nutrient. */}
      <NutrientModal kind={profile} subtitle={`${b.name} · whole batch`} items={b.ingredients} calories={b.total.calories} onClose={() => setProfile(null)} />
    </div>
  );
}

export function BatchPanel({ onEat, onEdit, className = "" }: Handlers & { className?: string }) {
  const batches = useStore((s) => s.batches);
  return (
    <Section className={className} title="Cooked batches" subtitle="Tap one for details" icon={<ChefHat size={18} />}>
      {batches.length === 0 ? (
        <Empty>Switch the input bar to <b>Cook</b>, list what you put in (say if it&apos;s raw) and save. Log portions here, or say “I ate a third of the biryani for dinner”.</Empty>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{batches.map((b) => <BatchRow key={b.id} b={b} onEat={onEat} onEdit={onEdit} />)}</div>
      )}
    </Section>
  );
}
