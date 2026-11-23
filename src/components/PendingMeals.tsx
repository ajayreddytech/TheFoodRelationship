"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { discardPending, listPending, PENDING_CHANGED, PendingMeal, processPending, retryPending } from "@/lib/pendingMeals";

const clockTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const describe = (p: PendingMeal) => (p.text?.trim() ? `“${p.text.trim()}”` : "Voice entry");

interface Props {
  /** True when no confirm dialog is open, so a ready entry may open by itself. */
  canAutoOpen: boolean;
  onReview: (p: PendingMeal) => void;
}

/**
 * Saved meals from every device. The server keeps retrying them; while the app is open this also checks
 * every 15 s. When one is ready it opens the same confirm table, with a note explaining it.
 */
export function PendingMeals({ canAutoOpen, onReview }: Props) {
  const uid = useStore((st) => st.userId);
  const [items, setItems] = useState<PendingMeal[]>([]);
  const announced = useRef<Set<string>>(new Set());
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (!uid || running.current) return;
    running.current = true;
    try {
      let list = await listPending(uid);
      if (list.some((p) => p.status === "waiting") && (typeof navigator === "undefined" || navigator.onLine)) {
        await processPending();
        list = await listPending(uid);
      }
      setItems(list);
    } catch { /* offline or not yet set up: keep what we have */ } finally {
      running.current = false;
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    sync();
    const tick = setInterval(sync, 15_000);
    const onWake = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener(PENDING_CHANGED, sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearInterval(tick);
      window.removeEventListener(PENDING_CHANGED, sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [uid, sync]);

  useEffect(() => {
    if (!canAutoOpen) return;
    const next = items.find((p) => p.status === "ready" && !announced.current.has(p.id));
    if (next) {
      announced.current.add(next.id);
      onReview(next);
    }
  }, [items, canAutoOpen, onReview]);

  if (!uid || !items.length) return null;

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const tone = p.status === "ready" ? "border-good/50 bg-good/10" : p.status === "failed" ? "border-bad/50 bg-bad/10" : "border-mid/50 bg-mid/10";
        const title = p.status === "ready" ? "Ready to confirm" : p.status === "failed" ? "Couldn't read this entry" : "Saved, waiting to reach the AI";
        const detail = p.status === "ready"
          ? `Spoken ${clockTime(p.createdAt)} · we reached the AI after ${p.attempts} tries`
          : p.status === "failed"
            ? `Spoken ${clockTime(p.createdAt)} · ${p.lastError ?? "The AI could not read it."}`
            : `Spoken ${clockTime(p.createdAt)} · ${p.attempts} tries so far, retried automatically (also when the app is closed)`;
        return (
          <div key={p.id} className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${tone}`}>
            {p.status === "waiting" ? <Loader2 size={16} className="shrink-0 animate-spin" /> : p.status === "ready" ? <CheckCircle2 size={16} className="shrink-0 text-good" /> : <AlertTriangle size={16} className="shrink-0 text-bad" />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{title}: <span className="font-normal">{describe(p)}</span></div>
              <div className="text-xs text-subtle">{detail}</div>
            </div>
            {p.status === "ready" && <button className="btn-primary !py-1.5 !px-3 text-sm" onClick={() => onReview(p)}>Review</button>}
            {p.status === "failed" && (
              <button aria-label="Try again" className="btn-ghost !py-1.5 !px-2 text-sm" onClick={() => retryPending(p.id).then(sync).catch(() => {})}><RefreshCw size={14} /></button>
            )}
            <button aria-label="Discard" className="btn-ghost !py-1.5 !px-2 text-sm" onClick={() => discardPending(p.id).then(sync).catch(() => {})}><Trash2 size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

/** The note shown above the confirm table for an entry that was recovered. */
export const recoveredNote = (p: PendingMeal) =>
  `You tried to log this at ${clockTime(p.createdAt)}. We couldn't reach the AI then (${p.attempts} tries), and we've reached it now. Please confirm.`;
