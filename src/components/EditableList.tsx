"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

/** A clean list with one Edit toggle per section; edit mode reveals per-item edit/delete and an add box. */
export function EditableList({ items, onAdd, onEdit, onRemove, numbered, layout = "grid-cols-1 sm:grid-cols-2", placeholder = "Add a new item…" }: {
  items: string[]; onAdd: (t: string) => void; onEdit: (i: number, t: string) => void; onRemove: (i: number) => void;
  numbered?: boolean; layout?: string; placeholder?: string;
}) {
  const [manage, setManage] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");

  const save = () => { if (text.trim()) onEdit(editing!, text); setEditing(null); };
  const add = () => { if (draft.trim()) { onAdd(draft); setDraft(""); } };
  const done = () => { setManage(false); setEditing(null); };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className={manage ? "btn-primary !py-1.5" : "btn-ghost !py-1.5"} onClick={() => (manage ? done() : setManage(true))}>
          {manage ? <><Check size={14} />Done</> : <><Pencil size={14} />Edit</>}
        </button>
      </div>
      <ul className={`grid gap-2 ${layout}`}>
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
            {numbered ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{i + 1}</span> : <span className="text-brand" aria-hidden>●</span>}
            {manage && editing === i ? (
              <>
                <textarea autoFocus aria-label="Edit item" rows={2} className="input min-w-0 flex-1 !py-1.5 text-sm" value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") setEditing(null); }} />
                <button aria-label="Save" className="text-good" onClick={save}><Check size={16} /></button>
                <button aria-label="Cancel" className="text-subtle" onClick={() => setEditing(null)}><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1">{t}</span>
                {manage && (
                  <span className="flex shrink-0 gap-2 text-subtle">
                    <button aria-label="Edit" className="hover:text-brand" onClick={() => { setEditing(i); setText(t); }}><Pencil size={14} /></button>
                    <button aria-label="Delete" className="hover:text-bad" onClick={() => confirm("Delete this item?") && onRemove(i)}><Trash2 size={14} /></button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <div className="mt-3 flex gap-2">
          <input aria-label="New item" className="input flex-1" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn-primary" onClick={add} disabled={!draft.trim()}><Plus size={16} />Add</button>
        </div>
      )}
    </div>
  );
}
