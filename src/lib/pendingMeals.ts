import { supabase } from "./supabase";
import { useStore } from "./store";
import type { RecordedAudio } from "./useRecorder";

/**
 * Meals whose AI request could not be reached. They live in the cloud (pending_meals table), so every
 * device sees the same list. The server retries them (see /api/pending), and the owner confirms or discards.
 */
export interface PendingMeal {
  id: string;
  /** When the food was spoken or typed (ISO). */
  createdAt: string;
  /** The log day it belongs to (YYYY-MM-DD). */
  logDate: string;
  /** Local hour it was spoken, used for the meal-time guess. */
  hour: number;
  text: string | null;
  attempts: number;
  lastError: string | null;
  /** waiting = being retried, ready = AI reply available to confirm, failed = AI could not read it. */
  status: "waiting" | "ready" | "failed";
  /** The raw /api/parse-food reply once ready. */
  result: any | null;
}

interface Row {
  id: string;
  created_at: string;
  log_date: string;
  hour: number;
  text: string | null;
  attempts: number;
  last_error: string | null;
  status: PendingMeal["status"];
  result: any | null;
}

export const PENDING_CHANGED = "tfr-pending-changed";
const COLUMNS = "id, created_at, log_date, hour, text, attempts, last_error, status, result";

export const notifyPendingChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PENDING_CHANGED));
};

/** True when an error from the parse client means "try again later" rather than "the input is wrong". */
export const isRetryable = (e: unknown): boolean => !!(e as { retryable?: boolean } | null)?.retryable;

const client = () => {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  return supabase;
};

const toPending = (r: Row): PendingMeal => ({
  id: r.id, createdAt: r.created_at, logDate: r.log_date, hour: r.hour, text: r.text,
  attempts: r.attempts, lastError: r.last_error, status: r.status, result: r.result,
});

export async function listPending(uid: string): Promise<PendingMeal[]> {
  const { data, error } = await client().from("pending_meals").select(COLUMNS).eq("user_id", uid).order("created_at");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toPending);
}

/** Saves a meal the AI could not be reached for. Returns false if it could not be saved. */
export async function enqueuePending(uid: string, input: { text?: string; audio?: RecordedAudio; logDate: string; hour: number }): Promise<boolean> {
  try {
    const batches = useStore.getState().batches.map((b) => ({ id: b.id, name: b.name, cooked_weight_g: b.cookedWeightG, remaining: b.remaining, ingredients: b.ingredients.map((i) => i.name) }));
    const { error } = await client().from("pending_meals").insert({
      user_id: uid, log_date: input.logDate, hour: input.hour, text: input.text ?? null,
      audio_mime: input.audio?.mimeType ?? null, audio_b64: input.audio?.data ?? null, batches,
      status: "waiting", attempts: 1, last_error: null, next_try_at: new Date(Date.now() + 40_000).toISOString(),
    });
    if (error) return false;
    notifyPendingChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * Takes the entry for confirming. The row is deleted first, so if the same entry is open on two devices
 * only the first confirm logs it. Returns false if another device already took it.
 */
export async function claimPending(id: string): Promise<boolean> {
  const { data, error } = await client().from("pending_meals").delete().eq("id", id).select("id");
  if (error) throw error;
  notifyPendingChanged();
  return (data?.length ?? 0) > 0;
}

export async function discardPending(id: string): Promise<void> {
  const { error } = await client().from("pending_meals").delete().eq("id", id);
  if (error) throw error;
  notifyPendingChanged();
}

/** Puts a failed entry back in the queue to be tried again. */
export async function retryPending(id: string): Promise<void> {
  const { error } = await client().from("pending_meals").update({ status: "waiting", attempts: 0, last_error: null, next_try_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  notifyPendingChanged();
}

/** Asks the server to retry this user's due entries now. Safe to call often. */
export async function processPending(): Promise<void> {
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/pending", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}
