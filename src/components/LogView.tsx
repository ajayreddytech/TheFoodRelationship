"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Apple, CalendarCheck, Check, ChevronDown, ChefHat, ClipboardList, Clock, Coffee, Flame, GlassWater, Mic, Minus, Moon, Pencil, Plus, Send,
  Soup, Sandwich, Square, Sparkles, Sunrise, Target, Trash2, UtensilsCrossed, Utensils, X, Loader2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { BUCKET_TIMES, FoodItem, Gyr, MEAL_BUCKETS, MealBucket, MealEntry, ParsedFood } from "@/lib/types";
import { dayFastingHours, dayIntake, fastingStats } from "@/lib/calc";
import { calorieTarget } from "@/lib/analytics";
import { sumItems, todayISO, uid } from "@/lib/dates";
import { fmt, ProgressBar, Section } from "./ui";
import { GYR_STYLE, METRICS, MetricKind, MetricTile } from "./icons";
import { ConfirmModal } from "./ConfirmModal";
import { MealsModal } from "./MealsModal";
import { CommandBar } from "./CommandBar";
import { useContent } from "@/lib/contentStore";


const QUOTES = [
  "Nourish the body, quiet the mind — every meal is a vote for the person you're becoming.",
  "Sleep is the quiet half of fitness; protect it like a workout.",
  "You don't have to be perfect, just consistent. Log it, learn from it, keep going.",
  "Strong bodies are built in the kitchen, recovered in bed, and forged in the gym.",
  "Hydrate, move, rest, repeat. Small habits compound into big change.",
  "What you track, you improve. Awareness is the first ingredient of health.",
  "Eat food that loves you back.",
];

const BUCKET_ICONS: Record<MealBucket, typeof Apple> = {
  "Pre 8:30 a.m.": Sunrise, "Detox Drink": GlassWater, Breakfast: Coffee, "Morning Snack": Apple,
  Lunch: Soup, "Evening Snack": Sandwich, Dinner: UtensilsCrossed, "Post 6:30 p.m.": Moon,
};

const toTimeValue = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fromTimeValue = (date: string, hhmm: string) => (hhmm ? new Date(`${date}T${hhmm}:00`).toISOString() : null);

function InputRow({ kind, label, children, tone }: { kind: MetricKind; label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-muted/40 p-3">
      <MetricTile kind={kind} tone={tone} />
      <div className="min-w-[6rem] font-medium">{label}</div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

function BigStat({ kind, label, value, unit, sub, color }: { kind: MetricKind; label: string; value: string; unit: string; sub: string; color?: string }) {
  const { Icon, text } = METRICS[kind];
  return (
    <div className="rounded-2xl border border-line bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm text-subtle"><Icon size={16} className={text} />{label}</div>
      <div className={`mt-1 text-4xl font-bold tabular-nums ${color ?? ""}`}>{value}<span className="ml-1 text-base font-medium text-subtle">{unit}</span></div>
      <div className="mt-0.5 text-xs text-subtle">{sub}</div>
    </div>
  );
}

function MealRow({ m, onEdit, onRemove }: { m: MealEntry; onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const names = m.items.map((i) => i.name).join(", ");
  return (
    <li className="rounded-lg bg-surface px-2 py-1.5" title={m.items.map((i) => `${i.name} (${i.quantity}) – ${Math.round(i.calories)} kcal`).join("\n")}>
      <div className="flex items-center gap-2">
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={13} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
          <span className="truncate text-[11px] text-subtle">{names}</span>
          <span className="ml-auto shrink-0 font-semibold text-orange-500">{Math.round(m.items.reduce((x, i) => x + i.calories, 0))} kcal</span>
        </button>
        <button aria-label="Edit meal" className="text-subtle hover:text-brand" onClick={onEdit}><Pencil size={13} /></button>
        <button aria-label="Remove meal" className="text-subtle hover:text-bad" onClick={onRemove}><Trash2 size={13} /></button>
      </div>
      {open && (
        <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5">
          {m.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-2"><span>{i.name} <span className="text-subtle">({i.quantity})</span></span><span className="tabular-nums text-orange-500">{Math.round(i.calories)}</span></li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function LogView() {
  const s = useStore();
  const { selectedDate: date, profile, logs } = s;
  const log = s.getLog(date);
  const [parsed, setParsed] = useState<ParsedFood | null>(null);
  const [multi, setMulti] = useState<{ blocks: ParsedFood[]; transcript?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const planItems = useContent((st) => st.plans[todayISO()]) ?? [];
  const planCal = planItems.reduce((a, i) => a + i.calories, 0);
  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);
  const intake = dayIntake(log);
  const target = calorieTarget(profile);
  const remaining = target - intake;
  const pct = target > 0 ? intake / target : 0;
  const fastH = dayFastingHours(log);
  const eating = fastingStats(log.firstMealAt, log.lastMealAt).eatingH;

  const confirmMeal = (bucket: MealBucket, items: FoodItem[], batch?: { id: string; fraction: number }) => {
    const tagged = batch ? items.map((it) => (it.name.endsWith("(portion)") ? { ...it, batch } : it)) : items;
    if (parsed?.editId) s.updateMeal(date, parsed.editId, bucket, tagged);
    else s.addMeal(date, bucket, tagged);
    if (batch && !parsed?.editId) s.consumeBatch(batch.id, batch.fraction);
    setParsed(null);
  };

  const clock = (which: "firstMealAt" | "lastMealAt") => {
    const v = log[which];
    return (
      <div className="flex flex-1 items-center gap-2">
        {v ? (
          <>
            <div className="flex-1 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-subtle">{which === "firstMealAt" ? "Clocked in" : "Clocked off"}</div>
              <input aria-label={which === "firstMealAt" ? "Clock in time" : "Clock off time"} type="time" className="bg-transparent text-lg font-bold outline-none"
                value={toTimeValue(v)} onChange={(e) => s.patchLog(date, { [which]: fromTimeValue(date, e.target.value) })} />
            </div>
            <button aria-label="Clear time" className="p-1 text-subtle hover:text-bad" onClick={() => s.patchLog(date, { [which]: null })}><X size={16} /></button>
          </>
        ) : (
          <button className="btn-ghost flex-1 !py-3 text-base" disabled={log.fasted} onClick={() => {
            const now = new Date(); const [h, m] = [now.getHours(), now.getMinutes()];
            s.patchLog(date, { [which]: fromTimeValue(date, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`) });
          }}><Clock size={16} />{which === "firstMealAt" ? "Clock in" : "Clock off"}</button>
        )}
      </div>
    );
  };

  const alert = pct >= 1
    ? { cls: "border-bad bg-bad/15 text-bad", text: `You're over your limit by ${fmt(-remaining)} kcal today.` }
    : pct >= 0.85 ? { cls: "border-bad bg-bad/10 text-bad", text: `Getting close! Only ${fmt(remaining)} kcal left for today.` }
    : pct >= 0.7 ? { cls: "border-mid bg-mid/15 text-mid", text: `Heads up — ${fmt(remaining)} kcal left today.` } : null;

  return (
    <div className="space-y-5 pb-40 md:pb-28">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand/20 via-surface to-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="TheFoodRelationship logo" className="h-16 w-16 rounded-full border-2 border-brand/50 object-cover shadow-lg sm:h-20 sm:w-20" />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">TheFoodRelationship</h1>
              <p className="mt-1 max-w-xl text-sm italic text-subtle">“{quote}”</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <label htmlFor="log-date" className="sr-only">Log date</label>
            <input id="log-date" type="date" className="bg-transparent font-medium outline-none" value={date} max={todayISO()} onChange={(e) => e.target.value && s.setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Eating window */}
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Section title="Eating window" subtitle="Clock in at your first bite, off at your last" icon={<Clock size={18} />}>
          <div className="flex flex-col gap-4 sm:flex-row">{clock("firstMealAt")}{clock("lastMealAt")}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-2 text-center"><div className="text-xs text-subtle">Eating window</div><div className="text-2xl font-bold tabular-nums">{eating != null ? `${eating.toFixed(1)}h` : "—"}</div></div>
            <div className="rounded-2xl bg-muted/50 p-2 text-center"><div className="flex items-center justify-center gap-1 text-xs text-subtle"><Sparkles size={12} className="text-violet-500" />Fasting</div><div className="text-2xl font-bold tabular-nums">{fastH != null ? `${fastH.toFixed(1)}h` : "—"}</div></div>
          </div>
          <button className={`btn-ghost mt-3 w-full !py-2 ${log.fasted ? "!border-violet-500 !bg-violet-500/15 !text-violet-500" : ""}`} onClick={() => s.setFastingDay(date, !log.fasted)}>
            <Sparkles size={16} className="text-violet-500" />{log.fasted ? "Fasting day ✓ (tap to undo)" : "Fasting day"}
          </button>
          {log.fasted && <p className="mt-2 text-xs text-subtle">Full fast saved: 0 kcal, 24h, Green, no nibbles. Add expenditure and hydration, then submit again.</p>}
        </Section>

        <Section title="Today's meal plan" subtitle={planItems.length ? `${fmt(planCal)} kcal planned` : "Nothing planned"} icon={<CalendarCheck size={18} />}>
          {planItems.length > 0 && (<ul className="max-h-56 space-y-1 overflow-y-auto text-sm">{planItems.map((i, k) => (<li key={k} className="flex justify-between gap-2"><span className="truncate">{i.name} <span className="text-subtle">({i.quantity})</span></span><span className="tabular-nums text-orange-500">{fmt(i.calories)}</span></li>))}</ul>)}
        </Section>
      </div>
      {/* Meals: two columns, filled top to bottom */}
      <Section title="Meals" subtitle="Tap the mic or type below — meals land in the right bucket" icon={<Utensils size={18} />}>
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {[MEAL_BUCKETS.slice(0, 4), MEAL_BUCKETS.slice(4)].map((col, ci) => (
            <div key={ci} className="space-y-3">
              {col.map((b) => {
                const entries = log.meals.filter((m) => m.bucket === b);
                const cal = entries.reduce((a, m) => a + m.items.reduce((x, i) => x + i.calories, 0), 0);
                const Icon = BUCKET_ICONS[b];
                return (
                  <div key={b} className="rounded-2xl border border-line bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand"><Icon size={16} /></span>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{b}</div><div className="text-[11px] text-subtle">{BUCKET_TIMES[b]}</div></div>
                      <div className="text-sm font-bold tabular-nums text-orange-500">{Math.round(cal)} <span className="text-[10px] font-medium">kcal</span></div>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {entries.length === 0 && <li className="text-subtle">Nothing logged</li>}
                      {entries.map((m) => <MealRow key={m.id} m={m} onEdit={() => setParsed({ target_bucket: m.bucket, items: m.items, editId: m.id })} onRemove={() => s.removeMeal(date, m.id)} />)}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Section>
      {/* Inputs + targets */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section title="Daily inputs" subtitle="Everything below is saved when you submit" icon={<ClipboardList size={18} />}>
          <div className="space-y-3">
            <InputRow kind="intake" label="Intake"><span className="text-2xl font-bold tabular-nums">{fmt(intake)}</span><span className="text-sm text-subtle">kcal</span></InputRow>
            <InputRow kind="expenditure" label="Expenditure">
              <input aria-label="Expenditure kcal" type="number" min={0} className="input !w-28 text-right" value={log.expenditure || ""} placeholder="0" onChange={(e) => s.patchLog(date, { expenditure: Math.max(0, Number(e.target.value) || 0) })} />
              <span className="text-sm text-subtle">kcal</span>
            </InputRow>
            <InputRow kind="hydration" label="Hydration">
              <button aria-label="Less water" className="btn-ghost !px-3" onClick={() => s.patchLog(date, { hydrationL: Math.max(0, +(log.hydrationL - 0.5).toFixed(1)) })}><Minus size={16} /></button>
              <span className="min-w-[4rem] text-center text-xl font-bold tabular-nums">{log.hydrationL.toFixed(1)} L</span>
              <button aria-label="More water" className="btn-ghost !px-3" onClick={() => s.patchLog(date, { hydrationL: +(log.hydrationL + 0.5).toFixed(1) })}><Plus size={16} /></button>
            </InputRow>
            <InputRow kind="gyr" label="GYR" tone={log.gyr ? GYR_STYLE[log.gyr].text : undefined}>
              <div className="grid w-full grid-cols-3 gap-2 sm:w-96">
                {(["green", "yellow", "red"] as Gyr[]).map((g) => (
                  <button key={g} aria-pressed={log.gyr === g} onClick={() => s.patchLog(date, { gyr: log.gyr === g ? null : g })}
                    className={`rounded-xl border-2 px-2 py-3 text-center transition ${GYR_STYLE[g].border} ${log.gyr === g ? `${GYR_STYLE[g].solid} text-white shadow-lg` : `${GYR_STYLE[g].bg} ${GYR_STYLE[g].text}`}`}>
                    <div className="text-sm font-bold">{GYR_STYLE[g].label}</div>
                    <div className={`text-[11px] ${log.gyr === g ? "text-white/90" : "opacity-80"}`}>{GYR_STYLE[g].hint}</div>
                  </button>
                ))}
              </div>
            </InputRow>
            <InputRow kind="nibbles" label="No nibbles">
              {([false, true] as const).map((nibbled) => (
                <button key={String(nibbled)} aria-pressed={log.nibbles === nibbled} onClick={() => s.patchLog(date, { nibbles: log.nibbles === nibbled ? null : nibbled })}
                  className={`flex items-center gap-1 rounded-xl border-2 px-5 py-2 text-sm font-semibold ${log.nibbles === nibbled ? (nibbled ? "border-transparent bg-bad text-white" : "border-transparent bg-good text-white") : "border-line"}`}>
                  {nibbled ? <X size={14} /> : <Check size={14} />}{nibbled ? "No" : "Yes"}
                </button>
              ))}
            </InputRow>
            <InputRow kind="fast" label="Fast"><span className="text-2xl font-bold tabular-nums">{fastH != null ? fastH.toFixed(1) : "—"}</span><span className="text-sm text-subtle">hours</span></InputRow>
          </div>
        </Section>

        <Section title="Targets" subtitle={`Calorie goal = maintenance (TDEE) ${target} kcal`} icon={<Target size={18} />}>
          <div className="space-y-3">
            {alert && (
              <div role="alert" className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${alert.cls}`}><AlertTriangle size={18} />{alert.text}</div>
            )}
            <BigStat kind="intake" label={remaining >= 0 ? "Calories remaining for today" : "Calories over today"} value={fmt(Math.abs(remaining))} unit="kcal"
              sub={`${fmt(intake)} eaten of ${fmt(target)}`} color={pct >= 1 ? "text-bad" : pct >= 0.85 ? "text-bad" : pct >= 0.7 ? "text-mid" : ""} />
            <ProgressBar value={intake} max={target} color={pct >= 0.85 ? "bg-bad" : pct >= 0.7 ? "bg-mid" : "bg-brand"} />
            <BigStat kind="expenditure" label="Remaining to burn" value={fmt(Math.max(0, profile.expenditureGoal - log.expenditure))} unit="kcal" sub={`${fmt(log.expenditure)} of ${fmt(profile.expenditureGoal)} goal`} />
            <ProgressBar value={log.expenditure} max={profile.expenditureGoal} color="bg-orange-500" />
            <BigStat kind="hydration" label="Remaining to drink" value={Math.max(0, profile.hydrationGoalL - log.hydrationL).toFixed(1)} unit="L" sub={`${log.hydrationL.toFixed(1)} of ${profile.hydrationGoalL} L goal`} />
            <ProgressBar value={log.hydrationL} max={profile.hydrationGoalL} color="bg-sky-500" />
          </div>
        </Section>
      </div>

      <motion.button whileTap={{ scale: 0.98 }} className="btn-primary w-full !py-4 text-lg" onClick={() => { s.submitLog(date); setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
        {saved ? <><Check size={20} />Saved!</> : <><Send size={20} />Submit</>}
      </motion.button>

      <CommandBar modes={["meal"]} onResult={(r) => {
        if (r.kind === "meals") setMulti({ blocks: r.meals, transcript: r.transcript });
        else if (r.kind === "meal") setParsed(r.parsed);
      }} />

      <MealsModal open={!!multi} mode="meal" blocks={multi?.blocks ?? []} transcript={multi?.transcript} onClose={() => setMulti(null)}
        onConfirm={(bs) => { for (const b of bs) s.addMeal(date, b.bucket, b.items); setMulti(null); }} />
      <ConfirmModal parsed={parsed} onClose={() => setParsed(null)} onConfirm={confirmMeal} />
    </div>
  );
}
