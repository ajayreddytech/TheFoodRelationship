"use client";

import { type ComponentType, useState } from "react";
import { BookOpen, ClipboardCheck, CookingPot, Menu, Settings, X } from "lucide-react";
import { useStore, View } from "@/lib/store";
import { GoalBoardIcon } from "./GoalBoardIcon";

const ITEMS: { id: View; label: string; Icon: ComponentType<{ size?: string | number }> }[] = [
  { id: "routine", label: "Routine", Icon: ClipboardCheck },
  { id: "goal", label: "Goal", Icon: GoalBoardIcon },
  { id: "recipes", label: "Recipes & Meal Prep", Icon: CookingPot },
  { id: "guide", label: "Guide", Icon: BookOpen },
  { id: "settings", label: "Settings", Icon: Settings },
];

/** Top-right shortcuts for the secondary pages. On small screens they fold into a menu button that expands them in a row. */
export function HeaderNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [open, setOpen] = useState(false);

  const go = (id: View) => {
    setView(id);
    setOpen(false);
  };

  return (
    <nav aria-label="Secondary" className="fixed right-3 top-3 z-40 flex items-center gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-dock backdrop-blur sm:right-5">
      <div id="secondary-menu" className={`${open ? "flex" : "hidden"} items-center gap-1 sm:flex`}>
        {ITEMS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <div key={id} className="group relative">
              <button
                onClick={() => go(id)}
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
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="secondary-menu"
        className="grid h-10 w-10 place-items-center rounded-xl text-subtle transition hover:bg-muted hover:text-fg active:scale-90 sm:hidden"
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
    </nav>
  );
}
