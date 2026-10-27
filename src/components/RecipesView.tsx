"use client";

import { useState } from "react";
import { CookingPot } from "lucide-react";
import { useContent } from "@/lib/contentStore";
import { PageHeader, Section } from "./ui";
import { EditableList } from "./EditableList";
import { ModuleManager } from "./ModuleManager";

export function RecipesView() {
  const { recipes, addItem, editItem, removeItem, addModule, renameModule, removeModule } = useContent();
  const [active, setActive] = useState(recipes[0]?.id ?? "");
  const cat = recipes.find((c) => c.id === active) ?? recipes[0];
  const modules = <ModuleManager modules={recipes} onAdd={(t, e) => setActive(addModule("recipes", t, e))} onRename={(id, t, e) => renameModule("recipes", id, t, e)} onRemove={(id) => removeModule("recipes", id)} />;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Recipes & Meal Prep" subtitle="Quick ideas to keep the food relationship simple — add, edit or delete any" />

      <div role="tablist" aria-label="Recipe categories" className="flex flex-wrap gap-2">
        {recipes.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat.id === c.id} onClick={() => setActive(c.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${cat.id === c.id ? "border-transparent bg-brand text-white shadow-lg shadow-brand/30" : "border-line bg-surface hover:bg-muted"}`}>
            <span aria-hidden>{c.emoji}</span> {c.title}
          </button>
        ))}
      </div>

      {modules}
      {cat && <Section title={cat.title} subtitle={`${cat.items.length} ideas`} icon={<CookingPot size={18} />}>
        <EditableList items={cat.items} onAdd={(t) => addItem("recipes", cat.id, t)} onEdit={(i, t) => editItem("recipes", cat.id, i, t)} onRemove={(i) => removeItem("recipes", cat.id, i)} />
      </Section>}
    </div>
  );
}
