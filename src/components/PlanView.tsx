"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useContent } from "@/lib/contentStore";
import { todayISO, parseISODate } from "@/lib/dates";
import { calorieTarget } from "@/lib/analytics";
import { CookDraft } from "@/lib/parseClient";
import { ParsedFood } from "@/lib/types";
import { Empty, PageHeader, Section, fmt } from "./ui";
import { MealsModal } from "./MealsModal";
import { BatchStock } from "./BatchStock";
import { CommandBar } from "./CommandBar";
import { NutrientModal } from "./NutrientModal";

type Multi = { blocks: ParsedFood[]; transcript?: string; date?: string };

export function PlanView() {
  const plans = useContent((s) => s.plans);
  const { clearPlan, replacePlan, addPlan, pruneOldPlans } = useContent.getState();
  const profile = useStore((s) => s.profile);
  const [profileKind, setProfileKind] = useState<{ date: string; kind: "all" } | null>(null);
  const [editing, setEditing] = useState<{ date: string; block: ParsedFood } | null>(null);
  const [multi, setMulti] = useState<Multi | null>(null);
  const [incoming, setIncoming] = useState<CookDraft | null>(null);
  const [upcoming, setUpcoming] = useState(false);
  const today = todayISO();
  const target = calorieTarget(profile);

  useEffect(() => { pruneOldPlans(); }, [pruneOldPlans, today]);

  const future = useMemo(() => Object.keys(plans).filter((d) => d > today).sort(), [plans, today]);
  const dates = useMemo(() => [...(plans[today] ? [today] : []), ...(upcoming ? future : [])], [plans, today, future, upcoming]);

  const label = (d: string) => (d === today ? "Today" : parseISODate(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }));

  return (
    <div className="space-y-5 pb-32">
      <PageHeader title="Meal Plan" subtitle="Each day's plan is treated as one meal — totals for the whole day" />

      {dates.length === 0 ? (
        <Empty>
          No plan for today. Use the bar below, switch to <b>Plan</b> and say e.g. “Today I&apos;ll have oats with banana, dal rice and 2 rotis with aloo matar”.
        </Empty>
      ) : dates.map((d) => {
        const items = plans[d];
        const total = items.reduce((a, i) => a + i.calories, 0);
        return (
          <Section key={d} title={label(d)} subtitle={`${d}${d > today ? " · upcoming" : ""}`} icon={<CalendarCheck size={18} />}
            right={<div className="flex gap-2">
              <button aria-label="Edit plan" className="btn-ghost !py-1.5" onClick={() => setEditing({ date: d, block: { target_bucket: "Lunch", items } })}><Pencil size={14} />Edit</button>
              <button aria-label="Delete plan" className="btn-ghost !py-1.5 text-bad" onClick={() => confirm("Delete this day's plan?") && clearPlan(d)}><Trash2 size={14} /></button>
            </div>}>
            <div className="text-3xl font-extrabold tabular-nums text-orange-500">{fmt(total)} <span className="text-base font-semibold text-subtle">kcal</span></div>
            <p className={`mt-1 text-sm ${total > target ? "text-bad" : "text-subtle"}`}>{total > target ? `${fmt(total - target)} kcal over` : `${fmt(target - total)} kcal under`} your {fmt(target)} kcal maintenance target.</p>

            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {items.map((i, k) => (
                <li key={k} className="flex justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5"><span>{i.name} <span className="text-subtle">({i.quantity})</span></span><span className="tabular-nums text-orange-500">{fmt(i.calories)}</span></li>
              ))}
            </ul>

            <button className="btn-ghost mt-4 w-full" onClick={() => setProfileKind({ date: d, kind: "all" })}>Nutrition profile</button>
          </Section>
        );
      })}

      {future.length > 0 && (
        <button className="btn-ghost" onClick={() => setUpcoming((u) => !u)}>
          {upcoming ? "Hide upcoming plans" : `Show upcoming plans (${future.length})`}
        </button>
      )}

      <BatchStock incoming={incoming} onConsumed={() => setIncoming(null)} />

      <NutrientModal kind={profileKind?.kind ?? null} subtitle={profileKind ? `${label(profileKind.date)} · whole day` : ""}
        items={profileKind ? plans[profileKind.date] ?? [] : []} calories={profileKind ? (plans[profileKind.date] ?? []).reduce((a, i) => a + i.calories, 0) : 0}
        onClose={() => setProfileKind(null)} />

      <MealsModal open={!!multi} mode="plan" blocks={multi?.blocks ?? []} transcript={multi?.transcript} date={multi?.date} onClose={() => setMulti(null)}
        onConfirm={(bs, date) => { addPlan(date, bs.flatMap((b) => b.items)); setMulti(null); }} />

      <MealsModal open={!!editing} mode="plan" blocks={editing ? [editing.block] : []} date={editing?.date} onClose={() => setEditing(null)}
        onConfirm={(bs, date) => { if (editing) replacePlan(editing.date, date, bs.flatMap((b) => b.items)); setEditing(null); }} />

      <CommandBar modes={["plan", "cook"]} onResult={(r) => {
        if (r.kind === "plan") setMulti({ blocks: r.meals, transcript: r.transcript, date: r.date });
        else if (r.kind === "cook") setIncoming(r.draft);
      }} />
    </div>
  );
}
