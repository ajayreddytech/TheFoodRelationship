"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DailyLog } from "@/lib/types";
import { DayPoint, dayPoints } from "@/lib/analytics";
import { Gran, buildSeries, shiftAnchor, windowFor } from "@/lib/period";
import { ChartCard } from "./charts";

/** How many earlier periods each paged chart keeps for scrolling back. */
const HISTORY: Record<Gran, number> = { day: 14, week: 12, month: 12, year: 5 };

interface Props {
  logs: Record<string, DailyLog>;
  gran: Gran;
  anchor: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  color: string;
  unit: string;
  decimals?: number;
  pick: (p: DayPoint) => number | null;
  goal?: number | null;
  goalLabel?: string;
}

/**
 * A trend chart with one page per period, ending on the current one. Scroll or use the arrows to go back;
 * the neighbouring page peeks at the edge so there is a visible hint that history is there.
 */
export function PagedChart({ logs, gran, anchor, title, subtitle, icon, color, unit, decimals, pick, goal, goalLabel }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => {
    // Anchors run oldest to newest, ending on the current period.
    const anchors = [anchor];
    for (let i = 1; i < HISTORY[gran]; i++) anchors.unshift(shiftAnchor(gran, anchors[0], -1));
    return anchors.map((a) => {
      const w = windowFor(gran, a, 7);
      const byDate = new Map(dayPoints(logs, w.from, w.to).map((p) => [p.date, p]));
      return { label: w.label, data: buildSeries(w, (d) => { const p = byDate.get(d); return p ? pick(p) : null; }) };
    });
  }, [logs, gran, anchor, pick]);

  // Open on the current period whenever the period or the anchor changes.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [gran, anchor]);

  const step = (dir: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-end gap-1">
        <span className="mr-auto text-xs text-subtle">Swipe or use the arrows for earlier periods</span>
        <button aria-label={`Earlier ${title}`} className="btn-ghost px-2.5" onClick={() => step(-1)}><ChevronLeft size={16} /></button>
        <button aria-label={`Later ${title}`} className="btn-ghost px-2.5" onClick={() => step(1)}><ChevronRight size={16} /></button>
      </div>
      <div ref={track} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pages.map((p, i) => (
          <div key={i} className="w-[92%] shrink-0 snap-center">
            <ChartCard title={title} subtitle={`${subtitle} · ${p.label}`} icon={icon} color={color} unit={unit} decimals={decimals} data={p.data} goal={goal} goalLabel={goalLabel} />
          </div>
        ))}
      </div>
    </div>
  );
}
