"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { FoodItem } from "@/lib/types";
import { NutrientDef, topSources } from "@/lib/nutrients";
import { fmt, Modal } from "./ui";

/** Pop-up listing the top 5 foods contributing to one nutrient, each with a share bar. */
export function SourcesModal({ nutrient, items, subtitle, perDay = 1, onClose }: { nutrient: NutrientDef | null; items: FoodItem[]; subtitle?: string; perDay?: number; onClose: () => void }) {
  const { sources, total } = nutrient ? topSources(items, nutrient.key) : { sources: [], total: 0 };
  const div = perDay > 0 ? perDay : 1;
  const d = (v: number) => fmt(v / div, v / div < 10 ? 1 : 0);

  return (
    <Modal open={!!nutrient} onClose={onClose} title={nutrient ? `Top sources of ${nutrient.label}` : "Top sources"}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Top sources of {nutrient?.label}</h2>
          <p className="text-xs text-subtle">{subtitle ? `${subtitle} · ` : ""}{div > 1 ? "daily average" : "total"}: {d(total)} {nutrient?.unit}</p>
        </div>
        <button aria-label="Close" className="btn-ghost !p-2" onClick={onClose}><X size={16} /></button>
      </div>
      {sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-subtle">No logged food contributes to {nutrient?.label} here.</p>
      ) : (
        <ul className="space-y-3">
          {sources.map((s, i) => (
            <li key={s.name} className="rounded-xl border border-line bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words font-medium">{i + 1}. {s.name}</span>
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">{Math.round(s.share * 100)}%</span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted shadow-inner" role="progressbar" aria-label={s.name} aria-valuenow={Math.round(s.share * 100)} aria-valuemax={100}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-brand" initial={{ width: 0 }} animate={{ width: `${s.share * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
              <div className="mt-1 text-xs tabular-nums text-subtle">{d(s.value)} {nutrient?.unit}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
