"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Flame, Lightbulb, Microscope, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { windowFor, Gran } from "@/lib/period";
import { todayISO } from "@/lib/dates";
import { aggregateNutrients, dietaryInsights, nutrientStatus } from "@/lib/analytics";
import { calcAge } from "@/lib/calc";
import { NUTRIENTS, NutrientGroup } from "@/lib/nutrients";
import { motion } from "framer-motion";
import { fmt, PageHeader, PeriodControls, Section } from "./ui";

const GROUPS: NutrientGroup[] = ["Macros", "Fats", "Vitamins", "Minerals", "Other"];
export const TONE = {
  good: { label: "Doing well", chip: "bg-good/15 text-good", grad: "from-emerald-400 to-good", box: "border-good/40 bg-good/10", text: "text-good", Icon: CheckCircle2, status: "On target" },
  warn: { label: "Can improve", chip: "bg-mid/20 text-mid", grad: "from-amber-300 to-mid", box: "border-mid/50 bg-mid/10", text: "text-mid", Icon: AlertTriangle, status: "Getting there" },
  bad: { label: "Needs work", chip: "bg-bad/15 text-bad", grad: "from-rose-400 to-bad", box: "border-bad/40 bg-bad/10", text: "text-bad", Icon: AlertOctagon, status: "Off target" },
};
export const SCALE = 1.5; // bar spans 0-150% of target; the marker sits at 100%
export function NutrientsView() {
  const { logs, profile } = useStore();
  const [gran, setGran] = useState<Gran>("day");
  const [anchor, setAnchor] = useState(todayISO());
  const w = windowFor(gran, anchor, 1);
  const today = todayISO();
  const to = w.to > today ? today : w.to;

  const aggs = useMemo(() => aggregateNutrients(logs, w.from, to, profile), [logs, w.from, to, profile]);
  const insights = useMemo(() => dietaryInsights(aggs), [aggs]);
  const days = aggs[0]?.days ?? 0;
  const age = calcAge(profile.dob);

  return (
    <div className="space-y-5 pb-28">
      <PageHeader title="Complete Nutrient Breakdown" subtitle="AI-estimated from your logged meals" />
      <div className="sticky top-0 z-20 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur"><PeriodControls gran={gran} anchor={anchor} setGran={setGran} setAnchor={setAnchor} trail={1} /></div>

      <div className="flex items-start gap-2 rounded-2xl border border-line bg-muted/40 p-3 text-xs text-subtle">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <span>
          {gran === "day" ? "Daily totals" : `Running daily average over ${days} logged day(s) with meals`}. Targets are personalised and update live from your
          {age != null ? ` age (${age})` : " age (add DOB in Settings)"}, gender, height, weight ({profile.weightKg} kg) and activity level.
        </span>
      </div>

      {days === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-subtle">No meals logged in this period.</div>
      ) : (
        <>
          <Section title="Dietary insights" subtitle="What stands out in this period" icon={<Lightbulb size={18} />}>
            <div className="grid gap-4 md:grid-cols-3">
              {(["good", "warn", "bad"] as const).map((tone) => {
                const t = TONE[tone];
                const list = insights.filter((i) => i.tone === tone);
                return (
                  <div key={tone} className={`rounded-2xl border p-4 ${t.box}`}>
                    <h3 className={`mb-2 flex items-center gap-2 font-semibold ${t.text}`}><t.Icon size={18} />{t.label} <span className="text-xs font-normal text-subtle">({list.length})</span></h3>
                    {list.length === 0 ? <p className="text-sm text-subtle">Nothing here.</p> : (
                      <ul className="space-y-2 text-sm">
                        {list.map((i) => (
                          <li key={i.id}>
                            <b>{i.title}</b> <span className="text-subtle">{i.text}</span>
                            {i.tip && <span className="block text-xs text-subtle">{i.tip}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>          </Section>

          {GROUPS.map((g) => {
            const defs = NUTRIENTS.filter((n) => n.group === g);
            if (!defs.length) return null;
            return (
              <Section key={g} title={g} icon={<Microscope size={18} />}>
                <div className="grid gap-3 md:grid-cols-2">
                  {defs.map((n) => {
                    const a = aggs.find((x) => x.key === n.key)!;
                    const ratio = a.rda ? a.avg / a.rda : 0;
                    const t = TONE[nutrientStatus(n.limit, ratio)];
                    const fill = Math.min(ratio, SCALE) / SCALE;
                    return (
                      <div key={n.key} className="rounded-2xl border border-line bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{n.label}{n.limit && <span className="ml-1 text-[10px] text-subtle">(limit)</span>}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.chip}`}>{t.status} · {Math.round(ratio * 100)}%</span>
                        </div>
                        <div className="relative mt-3 h-4 w-full rounded-full bg-muted shadow-inner" role="progressbar" aria-label={n.label} aria-valuenow={Math.round(ratio * 100)} aria-valuemax={100}>
                          <motion.div className={`h-full rounded-full bg-gradient-to-r shadow ${t.grad}`} initial={false} animate={{ width: `${fill * 100}%` }} transition={{ type: "spring", stiffness: 110, damping: 18 }} />
                          <div className="absolute -bottom-1 -top-1 w-0.5 rounded bg-fg/60" style={{ left: `${(1 / SCALE) * 100}%` }} title="Target" />
                        </div>
                        <div className="mt-1.5 text-xs tabular-nums text-subtle">{fmt(a.avg, a.avg < 10 ? 1 : 0)} of {fmt(a.rda, a.rda < 10 ? 1 : 0)} {n.unit}</div>
                      </div>
                    );                  })}
                </div>
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
}
