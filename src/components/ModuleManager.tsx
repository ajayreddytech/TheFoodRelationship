"use client";

import { useState } from "react";
import { Check, LayoutList, Plus, Trash2 } from "lucide-react";

interface Mod { id: string; emoji: string; title: string }

/** One toggle that reveals rename/delete for every module plus a "new module" row. */
export function ModuleManager({ modules, onAdd, onRename, onRemove, label = "Manage modules" }: {
  modules: Mod[]; onAdd: (title: string, emoji: string) => void; onRename: (id: string, title: string, emoji: string) => void; onRemove: (id: string) => void; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");

  const add = () => { if (title.trim()) { onAdd(title, emoji); setTitle(""); setEmoji(""); } };

  return (
    <div>
      <button className={open ? "btn-primary !py-1.5" : "btn-ghost !py-1.5"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <><Check size={14} />Done</> : <><LayoutList size={14} />{label}</>}
      </button>
      {open && (
        <div className="mt-3 space-y-2 rounded-2xl border border-line bg-surface p-3">
          {modules.length === 0 && <p className="text-sm text-subtle">No modules yet — add one below.</p>}
          {modules.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <input aria-label={`Emoji for ${m.title}`} className="input !w-14 text-center" maxLength={4} defaultValue={m.emoji} onBlur={(e) => e.target.value !== m.emoji && onRename(m.id, m.title, e.target.value)} />
              <input aria-label={`Name of ${m.title}`} className="input flex-1" defaultValue={m.title} onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && onRename(m.id, e.target.value, m.emoji)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
              <button aria-label={`Delete ${m.title}`} className="btn-ghost !px-3 text-bad" onClick={() => confirm(`Delete the module "${m.title}" and everything in it?`) && onRemove(m.id)}><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <input aria-label="New module emoji" className="input !w-14 text-center" maxLength={4} placeholder="🥗" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
            <input aria-label="New module name" className="input flex-1" placeholder="New module name…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="btn-primary" disabled={!title.trim()} onClick={add}><Plus size={16} />Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
