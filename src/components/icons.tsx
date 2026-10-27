import { Check, Cookie, Droplet, Dumbbell, Hand, Salad, Sparkles, Utensils, X } from "lucide-react";
import type { Gyr } from "@/lib/types";

export type MetricKind = "intake" | "expenditure" | "hydration" | "gyr" | "nibbles" | "fast";

/** One icon + colour per metric, used identically across Log, Calendar, Insights and heatmaps. */
export const METRICS: Record<MetricKind, { Icon: typeof Utensils; text: string; bg: string; hex: string; label: string }> = {
  intake: { Icon: Utensils, text: "text-emerald-500", bg: "bg-emerald-500/15", hex: "#10b981", label: "Intake" },
  expenditure: { Icon: Dumbbell, text: "text-orange-500", bg: "bg-orange-500/15", hex: "#f97316", label: "Expenditure" },
  hydration: { Icon: Droplet, text: "text-sky-500", bg: "bg-sky-500/15", hex: "#0ea5e9", label: "Hydration" },
  gyr: { Icon: Salad, text: "text-lime-500", bg: "bg-lime-500/15", hex: "#84cc16", label: "GYR" },
  nibbles: { Icon: Hand, text: "text-amber-600", bg: "bg-amber-500/15", hex: "#d97706", label: "No nibbles" },
  fast: { Icon: Sparkles, text: "text-violet-500", bg: "bg-violet-500/15", hex: "#8b5cf6", label: "Fasting" },
};

export const GYR_STYLE: Record<Gyr, { text: string; bg: string; solid: string; border: string; label: string; hint: string }> = {
  green: { text: "text-good", bg: "bg-good/15", solid: "bg-good", border: "border-good", label: "Green", hint: "Satvik" },
  yellow: { text: "text-mid", bg: "bg-mid/20", solid: "bg-mid", border: "border-mid", label: "Yellow", hint: "In between" },
  red: { text: "text-bad", bg: "bg-bad/15", solid: "bg-bad", border: "border-bad", label: "Red", hint: "Tamasik" },
};

/**
 * Stored value `nibbled` (true = had nibbles). No nibbles (good) => restraint hand + green check;
 * nibbles (bad) => half-eaten cookie + red cross.
 */
export function NibbleMark({ nibbled, size = 14, className = "" }: { nibbled: boolean | null; size?: number; className?: string }) {
  if (nibbled == null) return <Hand size={size} className={`${METRICS.nibbles.text} ${className}`} />;
  const Main = nibbled ? Cookie : Hand;
  return (
    <span className={`relative inline-flex ${className}`}>
      <Main size={size} className={nibbled ? "text-amber-600" : "text-good"} />
      {nibbled
        ? <X size={size * 0.75} strokeWidth={3} className="absolute -bottom-1 -right-1.5 rounded-full bg-bad text-white" />
        : <Check size={size * 0.75} strokeWidth={3} className="absolute -bottom-1 -right-1.5 rounded-full bg-good text-white" />}
    </span>
  );
}

export function MetricIcon({ kind, size = 16, className = "" }: { kind: MetricKind; size?: number; className?: string }) {
  const { Icon, text } = METRICS[kind];
  return <Icon size={size} className={`${text} ${className}`} />;
}

/** Rounded tile with the metric icon, same size everywhere. */
export function MetricTile({ kind, tone, size = 20 }: { kind: MetricKind; tone?: string; size?: number }) {
  const { Icon, text, bg } = METRICS[kind];
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone ? "" : bg}`}>
      <Icon size={size} className={tone ?? text} />
    </span>
  );
}
