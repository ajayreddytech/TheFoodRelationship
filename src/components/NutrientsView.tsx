"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, Flame, Lightbulb, Microscope, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { windowFor, Gran } from "@/lib/period";
import { todayISO, datesBetween } from "@/lib/dates";
import { aggregateNutrients, dietaryInsights, nutrientStatus, NutrientAgg } from "@/lib/analytics";
import { calcAge } from "@/lib/calc";
import { NUTRIENTS, NutrientDef, NutrientGroup, isUnwanted } from "@/lib/nutrients";
import { motion } from "framer-motion";
import { fmt, PageHeader, PeriodControls, Section } from "./ui";
import { SourcesModal } from "./SourcesModal";

const GROUPS: NutrientGroup[] = ["Macros", "Fats", "Vitamins", "Minerals", "Other"];
export const TONE = {
  good: { label: "Doing well", chip: "bg-good/15 text-good", grad: "from-emerald-400 to-good", box: "border-good/40 bg-good/10", text: "text-good", Icon: CheckCircle2, status: "On target" },
  warn: { label: "Can improve", chip: "bg-mid/20 text-mid", grad: "from-amber-300 to-mid", box: "border-mid/50 bg-mid/10", text: "text-mid", Icon: AlertTriangle, status: "Getting there" },
  bad: { label: "Needs work", chip: "bg-bad/15 text-bad", grad: "from-rose-400 to-bad", box: "border-bad/40 bg-bad/10", text: "text-bad", Icon: AlertOctagon, status: "Off target" },
};
export const SCALE = 1.5; // bar spans 0-150% of target; the marker sits at 100%

/** One nutrient with its running average against the personal target. Opens the top-sources list on click. */
function NutrientTile({ n, a, onOpen }: { n: NutrientDef; a: NutrientAgg; onOpen: (n: NutrientDef) => void }) {
  const ratio = a.rda ? a.avg / a.rda : 0;
  const t = TONE[nutrientStatus(n.limit, ratio)];
  const fill = Math.min(ratio, SCALE) / SCALE;
  return (
    <div role="button" tabIndex={0} aria-label={`${n.label}: show top sources`} onClick={() => onOpen(n)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(n); } }}
      className="cursor-pointer rounded-2xl border border-line bg-muted/30 p-3 transition hover:border-brand/50">
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
  );
}

export function NutrientsView() {
  const { logs, profile } = useStore();
  const [gran, setGran] = useState<Gran>("day");
  const [openTone, setOpenTone] = useState<Record<string, boolean>>({});
  // Nutrient groups start collapsed; a group is open only once the user expands it.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [src, setSrc] = useState<NutrientDef | null>(null);
  const [anchor, setAnchor] = useState(todayISO());
  const w = windowFor(gran, anchor, 1);
  const today = todayISO();
  const to = w.to > today ? today : w.to;

  const aggs = useMemo(() => aggregateNutrients(logs, w.from, to, profile), [logs, w.from, to, profile]);
  const periodItems = useMemo(() => datesBetween(w.from, to).flatMap((d) => (logs[d]?.meals ?? []).flatMap((m) => m.items)), [logs, w.from, to]);
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
            <div className="grid items-start gap-3 md:grid-cols-3">
              {(["good", "warn", "bad"] as const).map((tone) => {
                const t = TONE[tone];
                const list = insights.filter((i) => i.tone === tone);
                return (
                  <div key={tone} className={`self-start rounded-2xl border ${t.box}`}>
                    <button className={`flex w-full items-center gap-2 p-3 text-left font-semibold ${t.text}`} aria-expanded={!!openTone[tone]} onClick={() => setOpenTone((o) => ({ ...o, [tone]: !o[tone] }))}>
                      <t.Icon size={18} />{t.label} <span className="text-xs font-normal text-subtle">({list.length})</span>
                      <ChevronDown size={16} className={`ml-auto transition ${openTone[tone] ? "rotate-180" : ""}`} />
                    </button>
                    {openTone[tone] && (
                      <div className="px-4 pb-4">
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
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {GROUPS.map((g) => {
            // Limit nutrients live in the drop-down below, not in their group.
            const defs = NUTRIENTS.filter((n) => n.group === g && !isUnwanted(n));
            if (!defs.length) return null;
            const isOpen = !!openGroups[g];
            return (
              <Section key={g} title={g} icon={<Microscope size={18} />} collapsed={!isOpen}
                right={<button aria-label={`${isOpen ? "Collapse" : "Expand"} ${g}`} aria-expanded={isOpen} className="btn-ghost !p-2" onClick={() => setOpenGroups((o) => ({ ...o, [g]: !o[g] }))}><ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} /></button>}>
                <div className="grid gap-3 md:grid-cols-2">
                  {defs.map((n) => <NutrientTile key={n.key} n={n} a={aggs.find((x) => x.key === n.key)!} onOpen={setSrc} />)}
                </div>
              </Section>
            );
          })}

          <Section title="The best keep these low" subtitle="Keep these under their upper limits" icon={<AlertOctagon size={18} />} collapsed={!openGroups.unwanted}
            right={<button aria-label={`${openGroups.unwanted ? "Collapse" : "Expand"} the best keep these low`} aria-expanded={!!openGroups.unwanted} className="btn-ghost !p-2" onClick={() => setOpenGroups((o) => ({ ...o, unwanted: !o.unwanted }))}><ChevronDown size={16} className={`transition ${openGroups.unwanted ? "rotate-180" : ""}`} /></button>}>
            <div className="grid gap-3 md:grid-cols-2">
              {NUTRIENTS.filter(isUnwanted).map((n) => <NutrientTile key={n.key} n={n} a={aggs.find((x) => x.key === n.key)!} onOpen={setSrc} />)}
            </div>
          </Section>
        </>
      )}
      <SourcesModal nutrient={src} items={periodItems} subtitle={w.label} perDay={days} onClose={() => setSrc(null)} />
    </div>
  );
}
