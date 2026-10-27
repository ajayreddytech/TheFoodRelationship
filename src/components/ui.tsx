"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Gran, GRANS, PeriodWindow, canGoNext, shiftAnchor, windowFor } from "@/lib/period";
import { todayISO } from "@/lib/dates";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-subtle">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** A clearly bounded block with a tinted header strip. */
export function Section({ title, subtitle, icon, right, children, className = "" }: { title: string; subtitle?: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-line bg-surface/90 shadow-sm backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-brand/15 via-brand/5 to-transparent px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          {icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-brand">{icon}</span>}
          <div>
            <h2 className="font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-subtle">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function ProgressBar({ value, max, color = "bg-brand", over = "bg-bad" }: { value: number; max: number; color?: string; over?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <motion.div className={`h-full rounded-full ${value > max ? over : color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-subtle">{children}</div>;
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-label={title}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-t-3xl border border-line bg-surface p-5 shadow-dock sm:rounded-3xl"
      >
        {children}
      </motion.div>
    </div>
  );
}

export const fmt = (n: number | null | undefined, d = 0) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }));

const GRAN_LABEL: Record<Gran, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };

/** Day/Week/Month/Year buttons, back/forward arrows, and a "jump to current" dropdown. */
export function PeriodControls({ gran, anchor, setGran, setAnchor, trail = 7 }: { gran: Gran; anchor: string; setGran: (g: Gran) => void; setAnchor: (a: string) => void; trail?: number }) {
  const w: PeriodWindow = windowFor(gran, anchor, trail);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Period">
        {GRANS.map((g) => (
          <button key={g} aria-pressed={gran === g} onClick={() => setGran(g)} className={`rounded-lg px-3 py-1.5 text-sm transition ${gran === g ? "bg-brand text-white shadow" : "text-subtle hover:text-fg"}`}>{GRAN_LABEL[g]}</button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button aria-label="Previous period" className="btn-ghost px-2.5" onClick={() => setAnchor(shiftAnchor(gran, anchor, -1))}><ChevronLeft size={16} /></button>
        <span className="min-w-[10.5rem] text-center text-sm font-semibold">{w.label}</span>
        <button aria-label="Next period" className="btn-ghost px-2.5" disabled={!canGoNext(gran, anchor, trail)} onClick={() => setAnchor(shiftAnchor(gran, anchor, 1))}><ChevronRight size={16} /></button>
      </div>
      <select aria-label="Jump to current" className="input w-auto" value="" onChange={(e) => { const g = e.target.value as Gran; if (g) { setGran(g); setAnchor(todayISO()); } }}>
        <option value="">Jump to…</option>
        <option value="day">Current Day</option>
        <option value="week">Current Week</option>
        <option value="month">Current Month</option>
        <option value="year">Current Year</option>
      </select>
    </div>
  );
}
