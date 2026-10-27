"use client";

import { useState } from "react";
import { CalendarCheck, ChefHat, Loader2, Mic, Send, Sparkles, Square, Utensils } from "lucide-react";
import { ParseMode, ParseResult, parseInput } from "@/lib/parseClient";
import { useRecorder } from "@/lib/useRecorder";

const META: Record<ParseMode, { label: string; Icon: typeof Utensils; placeholder: string }> = {
  meal: { label: "Log", Icon: Utensils, placeholder: "e.g. Breakfast was 2 idlis, lunch was dal rice, or “I ate a third of the biryani for dinner”" },
  plan: { label: "Plan", Icon: CalendarCheck, placeholder: "e.g. Tomorrow: oats with banana, dal rice, 2 rotis with aloo matar" },
  cook: { label: "Cook", Icon: ChefHat, placeholder: "e.g. cooked 300g raw basmati rice, 2 tbsp oil, 400g potatoes…" },
  auto: { label: "Auto", Icon: Sparkles, placeholder: "Say a meal plan or what you cooked — I'll detect which" },
};

/** Floating text + voice bar. Only the modes passed in are offered. */
export function CommandBar({ modes, onResult }: { modes: ParseMode[]; onResult: (r: ParseResult, mode: ParseMode) => void }) {
  const [mode, setMode] = useState<ParseMode>(modes[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (input: { text?: string; audio?: Parameters<typeof parseInput>[0]["audio"] }) => {
    setBusy(true); setErr(null);
    try {
      onResult(await parseInput({ ...input, mode }), mode);
      setText("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    setBusy(false);
  };
  const rec = useRecorder((audio) => handle({ audio }));

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-3xl md:bottom-4 md:left-28">
      {(err || rec.error) && <p role="alert" className="mb-1 rounded-lg bg-bad/15 px-3 py-1 text-sm text-bad">{err ?? rec.error}</p>}
      <form className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-xl" onSubmit={(e) => { e.preventDefault(); if (text.trim()) handle({ text }); }}>
        <div className="flex shrink-0 rounded-xl bg-muted p-0.5 text-xs">
          {modes.map((m) => {
            const { Icon, label } = META[m];
            return (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${mode === m ? "bg-brand text-white" : "text-subtle"}`}>
                <Icon size={14} /><span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
        <input aria-label="Describe your food" className="input !border-0 !bg-transparent flex-1" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={rec.recording ? `Listening… ${rec.seconds}s` : META[mode].placeholder} />
        {rec.supported && (
          <button type="button" aria-label={rec.recording ? "Stop recording" : "Start recording"} onClick={rec.toggle} disabled={busy || rec.processing}
            className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${rec.recording ? "bg-bad" : "bg-brand"}`}>
            {rec.recording && <span className="absolute inset-0 rounded-full bg-bad/40" style={{ transform: `scale(${1 + rec.level * 0.8})` }} />}
            <span className="relative">{rec.processing ? <Loader2 size={18} className="animate-spin" /> : rec.recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</span>
          </button>
        )}
        <button aria-label="Send" className="btn-primary !h-11 !px-3" disabled={busy || !text.trim()}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
      </form>
    </div>
  );
}
