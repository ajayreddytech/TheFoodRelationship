"use client";

import { useState } from "react";
import { Check, ChevronDown, HelpCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useContent } from "@/lib/contentStore";
import { PageHeader, Section } from "./ui";
import { EditableList } from "./EditableList";
import { ModuleManager } from "./ModuleManager";

export function GuideView() {
  const { guide, faqs, addItem, editItem, removeItem, addModule, renameModule, removeModule, addFaq, editFaq, removeFaq } = useContent();
  const [tab, setTab] = useState<string>(guide[0]?.id ?? "faq");
  const [open, setOpen] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [edit, setEdit] = useState<{ i: number | null; q: string; a: string } | null>(null);
  const section = guide.find((s) => s.id === tab);

  const saveFaq = () => {
    if (!edit || !edit.q.trim() || !edit.a.trim()) return;
    if (edit.i == null) addFaq(edit.q, edit.a); else editFaq(edit.i, edit.q, edit.a);
    setEdit(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Guide" subtitle="Safe practices, true satvik food, how the best eat, proportions, and answers to “what if”" />

      <div role="tablist" aria-label="Guide sections" className="flex flex-wrap gap-2">
        {[...guide.map((s) => ({ id: s.id, label: `${s.emoji} ${s.title}` })), { id: "faq", label: "❓ What if (FAQ)" }].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${tab === t.id ? "border-transparent bg-brand text-white shadow-lg shadow-brand/30" : "border-line bg-surface hover:bg-muted"}`}>{t.label}</button>
        ))}
      </div>

      <ModuleManager modules={guide} onAdd={(t, e) => setTab(addModule("guide", t, e))} onRename={(id, t, e) => renameModule("guide", id, t, e)} onRemove={(id) => removeModule("guide", id)} />
      {section ? (
        <Section title={section.title} subtitle={section.subtitle} icon={<span aria-hidden>{section.emoji}</span>}>
          <EditableList numbered layout="md:grid-cols-2" items={section.points} placeholder="Add a new point…"
            onAdd={(t) => addItem("guide", section.id, t)} onEdit={(i, t) => editItem("guide", section.id, i, t)} onRemove={(i) => removeItem("guide", section.id, i)} />
        </Section>
      ) : (
        <Section title="What if…" subtitle="Quick answers for tricky moments" icon={<HelpCircle size={18} />}
          right={manage ? (
          <div className="flex gap-2">
            <button className="btn-ghost !py-1.5" onClick={() => setEdit({ i: null, q: "", a: "" })}><Plus size={14} />Add</button>
            <button className="btn-primary !py-1.5" onClick={() => { setManage(false); setEdit(null); }}><Check size={14} />Done</button>
          </div>
        ) : <button className="btn-ghost !py-1.5" onClick={() => setManage(true)}><Pencil size={14} />Edit</button>}>
          {manage && edit && (
            <div className="mb-3 space-y-2 rounded-xl border border-brand/40 bg-muted/40 p-3">
              <input aria-label="Question" autoFocus className="input" placeholder="What if…" value={edit.q} onChange={(e) => setEdit({ ...edit, q: e.target.value })} />
              <textarea aria-label="Answer" rows={3} className="input" placeholder="Answer" value={edit.a} onChange={(e) => setEdit({ ...edit, a: e.target.value })} />
              <div className="flex gap-2"><button className="btn-primary" onClick={saveFaq} disabled={!edit.q.trim() || !edit.a.trim()}><Check size={16} />Save</button><button className="btn-ghost" onClick={() => setEdit(null)}><X size={16} />Cancel</button></div>
            </div>
          )}
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-line bg-muted/40">
                <div className="flex items-center gap-2 p-3">
                  <button className="flex flex-1 items-center justify-between gap-3 text-left text-sm font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    {f.q}<ChevronDown size={16} className={`shrink-0 text-subtle transition ${open === i ? "rotate-180" : ""}`} />
                  </button>
                  {manage && <button aria-label="Edit question" className="text-subtle hover:text-brand" onClick={() => setEdit({ i, q: f.q, a: f.a })}><Pencil size={14} /></button>}
                  {manage && <button aria-label="Delete question" className="text-subtle hover:text-bad" onClick={() => confirm("Delete this question?") && removeFaq(i)}><Trash2 size={14} /></button>}
                </div>
                {open === i && <p className="border-t border-line p-3 text-sm">{f.a}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
