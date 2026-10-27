"use client";

import { BookOpen, CookingPot, Settings } from "lucide-react";
import { useStore, View } from "@/lib/store";

const ITEMS: { id: View; label: string; Icon: typeof Settings }[] = [
  { id: "recipes", label: "Recipes & Meal Prep", Icon: CookingPot },
  { id: "guide", label: "Guide", Icon: BookOpen },
  { id: "settings", label: "Settings", Icon: Settings },
];

/** Top-right shortcuts for the secondary pages. */
export function HeaderNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  return (
    <nav aria-label="Secondary" className="fixed right-3 top-3 z-40 flex gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-dock backdrop-blur sm:right-5">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <div key={id} className="group relative">
            <button
              onClick={() => setView(id)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`grid h-10 w-10 place-items-center rounded-xl transition active:scale-90 ${active ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-subtle hover:bg-muted hover:text-fg"}`}
            >
              <Icon size={19} />
            </button>
            <span className="pointer-events-none absolute right-0 top-full mt-2 hidden whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs text-bg opacity-0 transition group-hover:opacity-100 md:block">{label}</span>
          </div>
        );
      })}
    </nav>
  );
}
