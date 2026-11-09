"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Check, GripVertical, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { RoutineItem, useStore } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { Empty, PageHeader, Section } from "./ui";

interface RowProps {
  item: RoutineItem;
  done: boolean;
  manage: boolean;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}

/** One checklist line. Dragging only starts from the grip handle, and only in Edit mode. */
function RoutineRow({ item, done, manage, onToggle, onEdit, onRemove }: RowProps) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  const startEdit = () => { setText(item.text); setEditing(true); };
  const save = () => { onEdit(text); setEditing(false); };

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-sm"
    >
      {manage && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="shrink-0 cursor-grab touch-none text-subtle hover:text-fg active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical size={18} />
        </button>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${item.text}" as done`}
        onClick={onToggle}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition active:scale-90 ${done ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-brand"}`}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </button>

      {editing ? (
        <>
          <input
            autoFocus
            aria-label="Edit routine item"
            className="input min-w-0 flex-1 !py-1.5 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button aria-label="Save" className="shrink-0 text-good" onClick={save}><Check size={16} /></button>
          <button aria-label="Cancel" className="shrink-0 text-subtle" onClick={() => setEditing(false)}><X size={16} /></button>
        </>
      ) : (
        <>
          <span className={`min-w-0 flex-1 break-words ${done ? "text-subtle line-through" : ""}`}>{item.text}</span>
          {manage && (
            <span className="flex shrink-0 gap-2 text-subtle">
              <button aria-label="Edit" className="hover:text-brand" onClick={startEdit}><Pencil size={14} /></button>
              <button aria-label="Delete" className="hover:text-bad" onClick={() => confirm("Delete this item?") && onRemove()}><Trash2 size={14} /></button>
            </span>
          )}
        </>
      )}
    </Reorder.Item>
  );
}

export function RoutineView() {
  const routine = useStore((s) => s.routine);
  const checks = useStore((s) => s.routineChecks);
  const addRoutineItem = useStore((s) => s.addRoutineItem);
  const editRoutineItem = useStore((s) => s.editRoutineItem);
  const removeRoutineItem = useStore((s) => s.removeRoutineItem);
  const reorderRoutine = useStore((s) => s.reorderRoutine);
  const toggleRoutineItem = useStore((s) => s.toggleRoutineItem);

  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState("");

  const today = todayISO();
  const doneCount = routine.filter((r) => checks[r.id] === today).length;

  const add = () => {
    if (!draft.trim()) return;
    addRoutineItem(draft);
    setDraft("");
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Routine" subtitle="Your daily checklist — tick things off as you go" />

      <Section
        title="Checklist"
        subtitle={routine.length ? `${doneCount} of ${routine.length} done today` : "Nothing here yet"}
        icon={<ListChecks size={18} />}
        right={
          <button className={manage ? "btn-primary !py-1.5" : "btn-ghost !py-1.5"} onClick={() => setManage((m) => !m)}>
            {manage ? <><Check size={14} />Done</> : <><Pencil size={14} />Edit</>}
          </button>
        }
      >
        {routine.length === 0 ? (
          <Empty>No routine items yet. Add your first checklist item below.</Empty>
        ) : (
          <Reorder.Group axis="y" values={routine} onReorder={reorderRoutine} className="grid gap-2">
            {routine.map((item) => (
              <RoutineRow
                key={item.id}
                item={item}
                done={checks[item.id] === today}
                manage={manage}
                onToggle={() => toggleRoutineItem(item.id)}
                onEdit={(t) => editRoutineItem(item.id, t)}
                onRemove={() => removeRoutineItem(item.id)}
              />
            ))}
          </Reorder.Group>
        )}

        <div className="mt-4 flex gap-2">
          <input
            aria-label="New routine item"
            className="input flex-1"
            value={draft}
            placeholder="Add a checklist item…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button className="btn-primary" onClick={add} disabled={!draft.trim()}><Plus size={16} />Add</button>
        </div>
      </Section>
    </div>
  );
}
