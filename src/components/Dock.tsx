"use client";

import type { ComponentType } from "react";
import { Apple, Calendar, ClipboardList, LineChart, UtensilsCrossed } from "lucide-react";
import { useStore, View } from "@/lib/store";
import { DigitalScale } from "./icons";

const ITEMS: { id: View; label: string; Icon: ComponentType<{ size?: number | string }> }[] = [
  { id: "log", label: "Log", Icon: ClipboardList },
  { id: "plan", label: "Meal Plan", Icon: UtensilsCrossed },
  { id: "calendar", label: "Calendar / History", Icon: Calendar },
  { id: "insights", label: "Insights & Graphs", Icon: LineChart },
  { id: "nutrients", label: "Nutrient Breakdown", Icon: Apple },
  { id: "weight", label: "Weight Tracking", Icon: DigitalScale },
];

export function Dock() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl border border-line bg-surface/90 p-1.5 shadow-dock backdrop-blur md:bottom-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:translate-x-0 md:flex-col md:p-2"
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <div key={id} className="group relative">
            <button
              onClick={() => setView(id)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`grid h-11 w-11 place-items-center rounded-xl transition active:scale-90 ${
                active ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-subtle hover:bg-muted hover:text-fg"
              }`}
            >
              <Icon size={20} />
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs text-bg opacity-0 transition group-hover:opacity-100 md:block">
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
