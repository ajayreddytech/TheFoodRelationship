"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Minus, RotateCcw, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { GoalBoardIcon } from "./GoalBoardIcon";
import { useStore } from "@/lib/store";
import { KCAL_PER_KG, kgToLb, lbToKg, round } from "@/lib/calc";
import { todayISO } from "@/lib/dates";
import { GoalDay, computeGoal } from "@/lib/goal";
import { Empty, PageHeader, Section, fmt } from "./ui";

const CANVAS = 320; // square the circle lives in, so it fits a 360px phone
const RING = 200; // diameter of the full distance (the starting point)
const MAX = 290; // largest the solid circle may grow when moving away
const MIN = 48; // smallest dot once the goal is reached
const REF_MIN = 500; // kcal floor for the baseline, so a tiny gap still gets a sensible scale
const SPRING = { type: "spring", stiffness: 80, damping: 16 } as const;

/** Wave geometry: one crest every 50 units, so sliding by PERIOD loops seamlessly. */
const PERIOD = 100;
function wavePath(y: number, amp: number, phase: number) {
  let d = "";
  for (let x = -PERIOD; x <= 3 * PERIOD; x += 2) {
    const yy = y + amp * Math.sin(((x + phase) / PERIOD) * Math.PI * 2);
    d += `${x === -PERIOD ? "M" : "L"}${x} ${yy.toFixed(2)}`;
  }
  return `${d} L${3 * PERIOD} 200 L${-PERIOD} 200 Z`;
}
const WAVE_BACK = wavePath(30, 5, 0);
const WAVE_FRONT = wavePath(37, 4, 50);
/** Air bubbles rising through the liquid. Fixed values so server and client render the same markup. */
const BUBBLES = [
  { left: 22, size: 7, delay: 0, dur: 4.2 },
  { left: 48, size: 5, delay: 1.3, dur: 5.1 },
  { left: 70, size: 9, delay: 2.2, dur: 4.7 },
  { left: 35, size: 4, delay: 3.1, dur: 3.9 },
  { left: 60, size: 6, delay: 0.6, dur: 5.6 },
  { left: 12, size: 5, delay: 1.9, dur: 4.4 },
  { left: 85, size: 6, delay: 0.3, dur: 5.3 },
  { left: 55, size: 3, delay: 2.8, dur: 3.5 },
];
/** Lit from the upper left: inner rim darkening on the far side, bright edge on the near side, and a lifted drop shadow. */
const GLOBE_SHADOW = "inset -22px -26px 44px rgba(0,0,0,0.38), inset 18px 18px 36px rgba(255,255,255,0.28), 0 28px 44px -12px rgba(0,0,0,0.5)";

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/**
 * Solid disc area = kcal still to go, relative to the starting distance (the faint ring).
 * Area goes down as you close in, and grows red past the ring when you move away.
 * The disc is filled with moving water, so it keeps animating while you wait.
 */
function GoalCircle({ remaining, base, reached, wrong }: { remaining: number; base: number; reached: boolean; wrong: boolean }) {
  const reduce = useReducedMotion();
  const ref = Math.max(base, REF_MIN);
  const solid = reached ? MIN : Math.min(MAX, Math.max(MIN, RING * Math.sqrt(remaining / ref)));
  const fill = reached ? "bg-good" : wrong ? "bg-bad" : "bg-brand";

  return (
    <div className="mx-auto grid place-items-center" style={{ width: CANVAS, height: CANVAS, maxWidth: "100%" }} role="img" aria-label={`${reached ? "Goal reached" : wrong ? "Moving away from goal" : "Distance to goal"}`}>
      {/* Starting distance: a dashed ring that slowly turns, so the chart feels alive. */}
      <motion.div
        aria-hidden
        className="col-start-1 row-start-1 rounded-full border-2 border-dashed border-line"
        animate={{ width: RING, height: RING, rotate: 360 }}
        transition={{ width: SPRING, height: SPRING, rotate: { duration: 36, repeat: Infinity, ease: "linear" } }}
      />
      {/* Covered part: the faint disc that shows the progress already made. */}
      <motion.div aria-hidden className="col-start-1 row-start-1 rounded-full bg-brand/10" animate={{ width: RING, height: RING }} transition={SPRING} />
      {/* Still to go: a water globe that bobs and tilts in 3D. */}
      <motion.div
        className="col-start-1 row-start-1"
        style={{ transformPerspective: 700 }}
        animate={reduce ? undefined : { y: [0, -8, 0], rotateX: [0, 7, 0, -7, 0], rotateY: [0, -9, 0, 9, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
      <motion.div
        className={`relative overflow-hidden rounded-full ${fill}`}
        style={{ boxShadow: GLOBE_SHADOW }}
        animate={{ width: solid, height: solid }}
        transition={SPRING}
      >
        <svg aria-hidden viewBox="0 0 200 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <motion.g animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
            <motion.g animate={reduce ? undefined : { x: [0, -PERIOD] }} transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}>
              <path d={WAVE_BACK} fill="rgba(0,0,0,0.18)" />
            </motion.g>
          </motion.g>
          <motion.g animate={reduce ? undefined : { y: [0, 3, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
            <motion.g animate={reduce ? undefined : { x: [-PERIOD, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}>
              <path d={WAVE_FRONT} fill="rgba(255,255,255,0.22)" />
            </motion.g>
          </motion.g>
        </svg>

        {BUBBLES.map((b) => (
          <motion.span
            key={b.left}
            aria-hidden
            className="absolute bottom-[10%] rounded-full bg-white/50"
            style={{ left: `${b.left}%`, width: b.size, height: b.size }}
            animate={reduce ? undefined : { y: [0, -300], x: [0, 4, -4, 0], opacity: [0, 0.9, 0] }}
            transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: "easeIn" }}
          />
        ))}

        {/* Sphere shading: the edge falls into shadow so the disc reads as a ball of glass. */}
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.3) 100%)" }} />
        {/* Lit area from the upper left. */}
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%)" }} />
        {/* Glint that breathes. */}
        <motion.span
          aria-hidden
          className="absolute rounded-full bg-white/80 blur-[2px]"
          style={{ left: "18%", top: "12%", width: "22%", height: "11%", rotate: -30 }}
          animate={reduce ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.9, 1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Light sheen sweeping across the glass. */}
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-1/2"
          style={{ background: "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)" }}
          initial={{ left: "-60%" }}
          animate={reduce ? undefined : { left: ["-60%", "120%"] }}
          transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
        />

        {(reached || wrong) && (
          <span aria-hidden className={`absolute inset-0 animate-ping rounded-full ${reached ? "bg-good/40" : "border-2 border-bad"}`} />
        )}
      </motion.div>
      </motion.div>
    </div>
  );
}

function DayRow({ d, remainingLabel, live }: { d: GoalDay; remainingLabel: string; live: boolean }) {
  const good = d.effect > 0;
  const away = d.effect < 0;
  const burned = d.net < 0;
  const Icon = burned ? TrendingDown : d.net > 0 ? TrendingUp : Minus;
  const tone = good ? "text-good" : away ? "text-bad" : "text-subtle";
  const badge = good ? "bg-good/15 text-good" : away ? "bg-bad/15 text-bad" : "bg-muted text-subtle";
  const verdict = good ? "Good" : away ? "Bad" : "Neutral";
  const label = burned ? "Burned" : d.net > 0 ? "Added" : "Even";

  return (
    <motion.li initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
      <span className="w-28 shrink-0 font-medium">{fmtDay(d.date)}</span>
      <span className={`flex items-center gap-1.5 font-semibold tabular-nums ${tone}`}>
        <Icon size={16} />
        {label} {fmt(Math.round(Math.abs(d.net)))} kcal
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{verdict}</span>
      {live && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">Today, live</span>}
      <span className="ml-auto text-xs tabular-nums text-subtle">{remainingLabel}</span>
    </motion.li>
  );
}

/** Start (or restart) a goal: sets today's current weight and the target. Restarting from zero is the same action. */
function GoalSetup({ imperial, unit, startValue, submitLabel }: { imperial: boolean; unit: string; startValue: string; submitLabel: string }) {
  const addWeight = useStore((s) => s.addWeight);
  const setProfile = useStore((s) => s.setProfile);
  const [current, setCurrent] = useState(startValue);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function start(e: FormEvent) {
    e.preventDefault();
    const c = Number(current);
    const t = Number(target);
    if (!(c > 0) || !(t > 0)) {
      setError("Enter both your current weight and your goal weight.");
      return;
    }
    if (c === t) {
      setError("Goal weight must be different from your current weight.");
      return;
    }
    // A fresh weigh-in anchors the count, so progress starts from zero today.
    addWeight(todayISO(), round(imperial ? lbToKg(c) : c, 2));
    setProfile({ targetWeightKg: round(imperial ? lbToKg(t) : t, 2) });
    setError(null);
  }

  return (
    <form className="space-y-3" onSubmit={start}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="goal-current">Current weight ({unit})</label>
          <input id="goal-current" type="number" step="0.1" min="0" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="goal-target">Goal weight ({unit})</label>
          <input id="goal-target" type="number" step="0.1" min="0" className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="submit" className="btn-primary w-full">{submitLabel}</button>
    </form>
  );
}

export function GoalView() {
  const weights = useStore((s) => s.weights);
  const logs = useStore((s) => s.logs);
  const profile = useStore((s) => s.profile);
  const goalSince = useStore((s) => s.goalSince);
  const setProfile = useStore((s) => s.setProfile);
  const imperial = profile.unitSystem === "imperial";
  const unit = imperial ? "lbs" : "kg";
  const conv = (kg: number) => (imperial ? kgToLb(kg) : kg);
  const startValue = String(round(conv(profile.weightKg), 1));

  // Re-check the date every minute so the count moves on at midnight without a reload.
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const snap = useMemo(() => computeGoal(logs, weights, profile, goalSince, today), [logs, weights, profile, goalSince, today]);

  function resetGoal() {
    if (window.confirm("Reset the goal? The target and energy progress start over from zero.")) setProfile({ targetWeightKg: null });
  }

  if (!snap) {
    return (
      <div className="space-y-5 pb-10">
        <PageHeader title="Goal" subtitle="Set a target and watch the circle close in on it" />
        <Section title="Start a goal" subtitle="Enter where you are now and where you want to be" icon={<GoalBoardIcon size={18} />}>
          <GoalSetup imperial={imperial} unit={unit} startValue={startValue} submitLabel="Start goal" />
          <p className="mt-3 text-xs text-subtle">Energy progress counts from the day you start, and the circle updates as you log.</p>
        </Section>
      </div>
    );
  }

  const toGoKg = Math.abs(snap.remainingKcal) / KCAL_PER_KG;
  const gapKg = Math.abs(snap.target - snap.current);
  const headline = snap.reached ? (snap.remainingKcal < 0 ? "Past goal" : "Goal reached") : snap.wrong ? "Moving away" : "To go";
  const tone = snap.reached ? "text-good" : snap.wrong ? "text-bad" : "text-brand";
  const gapWord = snap.mode === "lose" ? "to lose" : snap.mode === "gain" ? "to gain" : "— at target";

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Goal" subtitle="Your path from current weight to target — shrinks as you close in" />

      <Section
        title="Distance to goal"
        subtitle={`${fmt(conv(snap.current), 1)} ${unit} now → ${fmt(conv(snap.target), 1)} ${unit} target`}
        icon={<GoalBoardIcon size={18} />}
        right={
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={resetGoal}>
            <RotateCcw size={14} /> Reset
          </button>
        }
      >
        <GoalCircle remaining={Math.max(0, snap.remainingKcal)} base={snap.baseKcal} reached={snap.reached} wrong={snap.wrong} />

        <div className="mt-5 text-center">
          <p className={`text-sm font-semibold uppercase tracking-wide ${tone}`}>{headline}</p>
          <motion.p key={`${fmt(conv(toGoKg), 1)}-${unit}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold tabular-nums">
            {fmt(conv(toGoKg), 1)} <span className="text-lg font-semibold text-subtle">{unit}</span>
          </motion.p>
          <p className="mt-1 text-sm text-subtle tabular-nums">
            {fmt(Math.round(Math.abs(snap.remainingKcal)))} kcal {snap.reached ? (snap.remainingKcal < 0 ? "past the line" : "on target") : "to go"}
          </p>
          <p className="mt-3 text-sm">
            Weight gap: <b className="tabular-nums">{fmt(conv(gapKg), 1)} {unit}</b> {gapWord}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Energy progress counts from {fmtDay(snap.countingFrom)}{snap.lastWeighIn ? " — a new weigh-in resets the count" : ""}. 1 kg ≈ 7,700 kcal.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-subtle">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" />Still to go</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand/20" />Covered</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bad" />Moving away</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-good" />Reached</span>
        </div>
      </Section>

      {snap.reached && (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-good/40 bg-good/10 p-4">
            <Trophy size={20} className="mt-0.5 shrink-0 text-good" />
            <div className="text-sm">
              <p className="font-semibold">You reached {fmt(conv(snap.target), 1)} {unit}.</p>
              <p className="text-subtle">Enter a new current and goal weight below to start again. The count resets from today.</p>
            </div>
          </div>
          <Section title="Start a new goal" subtitle="Resets the circle and the energy count" icon={<RotateCcw size={18} />}>
            <GoalSetup imperial={imperial} unit={unit} startValue={startValue} submitLabel="Start new goal" />
          </Section>
        </>
      )}

      <Section title="Daily log" subtitle={snap.days.length ? `${snap.days.length} day${snap.days.length === 1 ? "" : "s"} counted` : "No days counted yet"} icon={<TrendingDown size={18} />}>
        {snap.days.length === 0 ? (
          <Empty>No days counted since {fmtDay(snap.countingFrom)} yet. Log a meal on the Log page and today appears here as you go.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {[...snap.days].reverse().map((d) => (
              <DayRow
                key={d.date}
                d={d}
                live={d.date === today}
                remainingLabel={d.remainingAfter <= 0 ? "Reached" : `${fmt(Math.round(d.remainingAfter))} kcal left`}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
