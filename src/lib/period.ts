import { addDays, datesBetween, parseISODate, toISODate, todayISO } from "./dates";

export type Gran = "day" | "week" | "month" | "year";
export const GRANS: Gran[] = ["day", "week", "month", "year"];

export interface PeriodWindow {
  gran: Gran;
  from: string;
  to: string;
  label: string;
}

const fmtDay = (s: string, o: Intl.DateTimeFormatOptions) => parseISODate(s).toLocaleDateString(undefined, o);

/** `trail` = number of days shown for the "day" granularity (1 = a single day). */
export function windowFor(gran: Gran, anchor: string, trail = 7): PeriodWindow {
  const d = parseISODate(anchor);
  if (gran === "day") {
    const from = addDays(anchor, -(trail - 1));
    return {
      gran, from, to: anchor,
      label: trail === 1 ? fmtDay(anchor, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : `${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(anchor, { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  if (gran === "week") {
    const from = addDays(anchor, -d.getDay());
    const to = addDays(from, 6);
    return { gran, from, to, label: `${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(to, { month: "short", day: "numeric", year: "numeric" })}` };
  }
  if (gran === "month") {
    return {
      gran,
      from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }
  return { gran, from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31`, label: String(d.getFullYear()) };
}

export function shiftAnchor(gran: Gran, anchor: string, dir: 1 | -1): string {
  const d = parseISODate(anchor);
  if (gran === "day") return addDays(anchor, dir);
  if (gran === "week") return addDays(anchor, 7 * dir);
  if (gran === "month") return toISODate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  return toISODate(new Date(d.getFullYear() + dir, 0, 1));
}

export function canGoNext(gran: Gran, anchor: string, trail = 7): boolean {
  return windowFor(gran, shiftAnchor(gran, anchor, 1), trail).from <= todayISO();
}

export interface SeriesPoint {
  key: string;
  label: string;
  value: number | null;
}

/** Points for a line chart. Year => monthly running averages of logged days; otherwise one point per day. */
export function buildSeries(w: PeriodWindow, valueOf: (date: string) => number | null): SeriesPoint[] {
  const today = todayISO();
  if (w.gran === "year") {
    return Array.from({ length: 12 }, (_, m) => {
      const from = toISODate(new Date(parseISODate(w.from).getFullYear(), m, 1));
      const to = toISODate(new Date(parseISODate(w.from).getFullYear(), m + 1, 0));
      const vals = datesBetween(from, to).filter((x) => x <= today).map(valueOf).filter((v): v is number => v != null);
      return { key: from, label: new Date(2000, m, 1).toLocaleDateString(undefined, { month: "short" }), value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
  }
  return datesBetween(w.from, w.to).map((date) => ({
    key: date,
    label: w.gran === "week" ? fmtDay(date, { weekday: "short" }) : w.gran === "month" ? String(parseISODate(date).getDate()) : fmtDay(date, { month: "short", day: "numeric" }),
    value: date <= today ? valueOf(date) : null,
  }));
}
