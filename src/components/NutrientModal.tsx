"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { nutrientStatus } from "@/lib/analytics";
import { isUnwanted, NUTRIENTS, NutrientDef, NutrientGroup, rdaFor } from "@/lib/nutrients";
import type { FoodItem } from "@/lib/types";
import { fmt, Modal } from "./ui";
import { SourcesModal } from "./SourcesModal";
import { SCALE, TONE } from "./NutrientsView";

export const sumNutrient = (items: FoodItem[], key: string) =>
  items.reduce((a, i) => a + (((i.macros as Record<string, number>)[key] ?? (i.micros as Record<string, number>)[key]) || 0), 0);

const KIND: Record<"macro" | "micro" | "all", { title: string; groups: NutrientGroup[] }> = {
  macro: { title: "Macronutrient profile", groups: ["Macros", "Fats"] },
  all: { title: "Nutrition profile", groups: ["Macros", "Fats", "Vitamins", "Minerals", "Other"] },
  micro: { title: "Micronutrient profile", groups: ["Vitamins", "Minerals", "Other"] },
};

/** Pop-up with the same personalised bars as the Nutrient Breakdown page, for a set of food items. */
export function NutrientModal({ kind, subtitle, items, calories, onClose }: { kind: "macro" | "micro" | "all" | null; subtitle: string; items: FoodItem[]; calories: number; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const rda = rdaFor(profile);
  const cfg = kind ? KIND[kind] : KIND.macro;
  const [src, setSrc] = useState<NutrientDef | null>(null);
  const [unwantedOpen, setUnwantedOpen] = useState(false);
  const unwanted = NUTRIENTS.filter((n) => isUnwanted(n) && cfg.groups.includes(n.group));

  const tile = (n: NutrientDef) => {
    const v = sumNutrient(items, n.key);
    const r = rda[n.key] ?? 0;
    const ratio = r ? v / r : 0;
    const t = TONE[nutrientStatus(n.limit, ratio)];
    return (
      <div key={n.key} role="button" tabIndex={0} aria-label={`${n.label}: show top sources`} onClick={() => setSrc(n)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSrc(n); } }}
        className="cursor-pointer rounded-xl border border-line bg-muted/30 p-2.5 transition hover:border-brand/50">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{n.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.chip}`}>{Math.round(ratio * 100)}%</span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-muted shadow-inner">
          <motion.div className={`h-full rounded-full bg-gradient-to-r ${t.grad}`} initial={false} animate={{ width: `${(Math.min(ratio, SCALE) / SCALE) * 100}%` }} />
          <div className="absolute -bottom-0.5 -top-0.5 w-0.5 rounded bg-fg/60" style={{ left: `${(1 / SCALE) * 100}%` }} />
        </div>
        <div className="mt-1 text-xs tabular-nums text-subtle">{fmt(v, v < 10 ? 1 : 0)} of {fmt(r, r < 10 ? 1 : 0)} {n.unit}</div>
      </div>
    );
  };

  return (
    <>
    <Modal open={!!kind} onClose={onClose} title={cfg.title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{cfg.title}</h2>
          <p className="text-xs text-subtle">{subtitle}{kind !== "micro" ? ` · ${fmt(calories)} kcal` : ""} · compared with your personal daily targets</p>
        </div>
        <button aria-label="Close" className="btn-ghost !p-2" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="space-y-4">
        {cfg.groups.map((g) => {
          const defs = NUTRIENTS.filter((n) => n.group === g && !isUnwanted(n));
          if (!defs.length) return null;
          return (
            <div key={g}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{g}</div>
              <div className="grid gap-2 sm:grid-cols-2">{defs.map(tile)}</div>
            </div>
          );
        })}
        {unwanted.length > 0 && (
          <div>
            <button aria-expanded={unwantedOpen} className="mb-1.5 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle" onClick={() => setUnwantedOpen((o) => !o)}>
              The best keep these low
              <ChevronDown size={14} className={`ml-auto transition ${unwantedOpen ? "rotate-180" : ""}`} />
            </button>
            {unwantedOpen && <div className="grid gap-2 sm:grid-cols-2">{unwanted.map(tile)}</div>}
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={onClose}>Close</button></div>
    </Modal>
    <SourcesModal nutrient={src} items={items} subtitle={subtitle} onClose={() => setSrc(null)} />
    </>
  );
}
