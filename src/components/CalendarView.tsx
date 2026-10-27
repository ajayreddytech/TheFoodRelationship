"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseISODate, toISODate, todayISO } from "@/lib/dates";
import { dayFastingHours, dayIntake } from "@/lib/calc";
import { isLogged } from "@/lib/analytics";
import type { DailyLog } from "@/lib/types";
import { fmt, PageHeader, Section } from "./ui";
import { GYR_STYLE, METRICS, MetricIcon, NibbleMark } from "./icons";

const CELL = { green: "bg-good/55 border-good/60", yellow: "bg-mid/55 border-mid/60", red: "bg-bad/55 border-bad/60" } as const;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Stats({ log, size, labels }: { log: DailyLog; size: number; labels?: boolean }) {
  const fast = dayFastingHours(log);
  const rows = [
    { k: "intake" as const, v: log.meals.length || log.fasted ? fmt(dayIntake(log)) : "–" },
    { k: "expenditure" as const, v: fmt(log.expenditure) },
    { k: "hydration" as const, v: `${log.hydrationL.toFixed(1)}L` },
    { k: "fast" as const, v: fast != null ? `${fast.toFixed(0)}h` : "–" },
  ];
  return (
    <div className="flex flex-col items-center gap-0.5">
      {rows.map((r) => (
        <div key={r.k} className="flex items-center gap-1 text-[10px] font-medium leading-tight sm:text-xs">
          <MetricIcon kind={r.k} size={size} />{labels && <span className="hidden xl:inline">{METRICS[r.k].label}</span>}<span className="hidden sm:inline">{r.v}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 text-[10px] sm:text-xs"><NibbleMark nibbled={log.nibbles} size={size} /></div>
    </div>
  );
}

export function CalendarView() {
  const { logs, selectedDate, setDate, setView, deleteLog } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [month, setMonth] = useState(() => parseISODate(selectedDate));
  const today = todayISO();
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1);
  const count = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => toISODate(new Date(y, m, i + 1)))];
  while (cells.length % 7) cells.push(null);

  const selLog = sel ? logs[sel] : undefined;
  const filled = isLogged(selLog);
  const go = (d: string) => { setDate(d); setView("log"); };

  return (
    <div className="space-y-5 pb-28">
      <PageHeader title="Calendar & History" subtitle="Tap a day to add, edit or delete its entry" />
      <Section title={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })} icon={<MetricIcon kind="gyr" size={18} />}
        right={<div className="flex gap-1">
          <button aria-label="Previous month" className="btn-ghost px-2.5" onClick={() => setMonth(new Date(y, m - 1, 1))}><ChevronLeft size={16} /></button>
          <button className="btn-ghost" onClick={() => { setMonth(new Date()); setSel(today); }}>Today</button>
          <button aria-label="Next month" className="btn-ghost px-2.5" onClick={() => setMonth(new Date(y, m + 1, 1))}><ChevronRight size={16} /></button>
        </div>}>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {DOW.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium text-subtle">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const l = logs[d];
            const has = isLogged(l);
            const g = has && l.gyr ? GYR_STYLE[l.gyr] : null;
            return (
              <div key={d} role="button" tabIndex={0} aria-label={d} aria-pressed={sel === d}
                onClick={() => setSel(sel === d ? null : d)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(sel === d ? null : d); } }}
                className={`group relative flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-start gap-1 rounded-xl border-2 p-1 pt-6 transition sm:min-h-[8.5rem] sm:p-2 sm:pt-7 ${sel === d ? "!border-brand" : g ? "" : "border-transparent"} ${g && l.gyr ? CELL[l.gyr] + " text-fg" : "bg-muted/30"} ${d > today ? "opacity-60" : ""}`}>
                <span className={`absolute left-2 top-1.5 text-sm font-bold ${g ? "text-fg" : "text-subtle"} ${d === today ? "rounded-full bg-brand px-1.5 !text-white" : ""}`}>{parseISODate(d).getDate()}</span>
                {has && <Stats log={l} size={13} />}
                <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                  {has ? (
                    <>
                      <button aria-label={`Edit ${d}`} className="rounded-md bg-surface p-1 text-brand shadow hover:bg-brand hover:text-white" onClick={(e) => { e.stopPropagation(); go(d); }}><Pencil size={12} /></button>
                      <button aria-label={`Delete ${d}`} className="rounded-md bg-surface p-1 text-bad shadow hover:bg-bad hover:text-white" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this day's data?")) deleteLog(d); }}><Trash2 size={12} /></button>
                    </>
                  ) : d <= today ? (
                    <button aria-label={`Add entry ${d}`} className="rounded-md bg-surface p-1 text-brand shadow hover:bg-brand hover:text-white" onClick={(e) => { e.stopPropagation(); go(d); }}><Plus size={12} /></button>
                  ) : null}
                </div>
              </div>            );
          })}
        </div>
      </Section>

      {sel && (
        <Section title={parseISODate(sel).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} subtitle={filled ? "Entry exists" : "No entry yet"} icon={<MetricIcon kind="intake" size={18} />}>
          {filled && selLog && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { k: "intake" as const, v: `${fmt(dayIntake(selLog))} kcal` },
                { k: "expenditure" as const, v: `${fmt(selLog.expenditure)} kcal` },
                { k: "hydration" as const, v: `${selLog.hydrationL.toFixed(1)} L` },
                { k: "fast" as const, v: dayFastingHours(selLog) != null ? `${dayFastingHours(selLog)!.toFixed(1)} h` : "—" },
              ].map((r) => (
                <div key={r.k} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm"><MetricIcon kind={r.k} size={18} /><span>{r.v}</span></div>
              ))}
              <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm"><NibbleMark nibbled={selLog.nibbles} size={18} /><span>{selLog.nibbles == null ? "—" : selLog.nibbles ? "Nibbles" : "No nibbles"}</span></div>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {filled ? (
              <>
                <button className="btn-primary flex-1 !py-4 text-base" onClick={() => go(sel)}><Pencil size={18} />Edit Data</button>
                <button className="btn-ghost flex-1 !py-4 text-base text-bad" onClick={() => { if (confirm("Delete this day's data?")) { deleteLog(sel); } }}><Trash2 size={18} />Delete Data</button>
              </>
            ) : (
              <button className="btn-primary flex-1 !py-4 text-base" onClick={() => go(sel)} disabled={sel > today}><Plus size={18} />Add Entry</button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
