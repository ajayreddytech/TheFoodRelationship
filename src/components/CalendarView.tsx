"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { datesBetween, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { Gran, GRANS, shiftAnchor, windowFor } from "@/lib/period";
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
  const [gran, setGran] = useState<Gran>("month");
  const [anchor, setAnchor] = useState(selectedDate);
  const today = todayISO();
  const win = windowFor(gran, anchor, 1);
  const monthCells = (y: number, m: number) => {
    const cs: (string | null)[] = [...Array(new Date(y, m, 1).getDay()).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => toISODate(new Date(y, m, i + 1)))];
    while (cs.length % 7) cs.push(null);
    return cs;
  };
  const anchorDate = parseISODate(anchor);
  const cells: (string | null)[] = gran === "month" ? monthCells(anchorDate.getFullYear(), anchorDate.getMonth()) : gran === "week" ? datesBetween(win.from, win.to) : gran === "day" ? [anchor] : [];

  const activeSel = gran === "day" ? anchor : sel;
  const selLog = activeSel ? logs[activeSel] : undefined;
  const filled = isLogged(selLog);
  const go = (d: string) => { setDate(d); setView("log"); };

  const renderCell = (d: string) => {
    const l = logs[d];
    const has = isLogged(l);
    const g = has && l.gyr ? GYR_STYLE[l.gyr] : null;
    return (
      <div key={d} role="button" tabIndex={0} aria-label={d} aria-pressed={activeSel === d}
        onClick={() => setSel(sel === d ? null : d)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(sel === d ? null : d); } }}
        className={`group relative flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-start gap-1 rounded-xl border-2 p-1 pt-6 transition sm:min-h-[8.5rem] sm:p-2 sm:pt-7 ${activeSel === d ? "!border-brand" : g ? "" : "border-transparent"} ${g && l.gyr ? CELL[l.gyr] + " text-fg" : "bg-muted/30"} ${d > today ? "opacity-60" : ""}`}>
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
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-28">
      <PageHeader title="Calendar & History" subtitle="Tap a day to add, edit or delete its entry" />
      <Section title={win.label} icon={<MetricIcon kind="gyr" size={18} />}
        right={<div className="flex gap-1">
          <button aria-label={`Previous ${gran}`} className="btn-ghost px-2.5" onClick={() => setAnchor(shiftAnchor(gran, anchor, -1))}><ChevronLeft size={16} /></button>
          <button className="btn-ghost" onClick={() => { setGran("month"); setAnchor(today); setSel(today); }}>Today</button>
          <button aria-label={`Next ${gran}`} className="btn-ghost px-2.5" onClick={() => setAnchor(shiftAnchor(gran, anchor, 1))}><ChevronRight size={16} /></button>
        </div>}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Calendar view">
            {GRANS.map((g) => (
              <button key={g} aria-pressed={gran === g} onClick={() => setGran(g)} className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${gran === g ? "bg-brand text-white shadow" : "text-subtle hover:text-fg"}`}>{g}</button>
            ))}
          </div>
          <select aria-label="Jump to current" className="input w-auto" value="" onChange={(e) => { const g = e.target.value as Gran; if (g) { setGran(g); setAnchor(today); if (g === "day") setSel(today); } }}>
            <option value="">Jump to…</option>
            <option value="day">Current Day</option>
            <option value="week">Current Week</option>
            <option value="month">Current Month</option>
            <option value="year">Current Year</option>
          </select>
        </div>
        {gran === "year" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, m) => {
              const y = anchorDate.getFullYear();
              return (
                <div key={m} className="rounded-2xl border border-line bg-muted/20 p-2">
                  <button className="mb-1 w-full text-center text-sm font-semibold hover:text-brand" onClick={() => { setGran("month"); setAnchor(toISODate(new Date(y, m, 1))); }}>
                    {new Date(y, m, 1).toLocaleDateString(undefined, { month: "long" })}
                  </button>
                  <div className="grid grid-cols-7 gap-0.5">
                    {monthCells(y, m).map((d, i) => {
                      if (!d) return <div key={i} />;
                      const l = logs[d];
                      const g = isLogged(l) && l.gyr ? CELL[l.gyr] : "bg-muted/40";
                      return (
                        <button key={d} aria-label={d} aria-pressed={sel === d} onClick={() => setSel(sel === d ? null : d)}
                          className={`grid aspect-square place-items-center rounded-md border text-[9px] leading-none ${sel === d ? "!border-brand ring-1 ring-brand" : "border-transparent"} ${g} ${d === today ? "font-extrabold underline" : ""} ${d > today ? "opacity-60" : ""}`}>
                          {parseISODate(d).getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`grid gap-1 sm:gap-2 ${gran === "day" ? "mx-auto max-w-xs grid-cols-1" : "grid-cols-7"}`}>
            {gran !== "day" && DOW.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium text-subtle">{d}</div>)}
            {cells.map((d, i) => (d ? renderCell(d) : <div key={i} />))}
          </div>
        )}
      </Section>

      {activeSel && (
        <Section title={parseISODate(activeSel).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} subtitle={filled ? "Entry exists" : "No entry yet"} icon={<MetricIcon kind="intake" size={18} />}>
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
                <button className="btn-primary flex-1 !py-4 text-base" onClick={() => go(activeSel)}><Pencil size={18} />Edit Data</button>
                <button className="btn-ghost flex-1 !py-4 text-base text-bad" onClick={() => { if (confirm("Delete this day's data?")) { deleteLog(activeSel); } }}><Trash2 size={18} />Delete Data</button>
              </>
            ) : (
              <button className="btn-primary flex-1 !py-4 text-base" onClick={() => go(activeSel)} disabled={activeSel > today}><Plus size={18} />Add Entry</button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
