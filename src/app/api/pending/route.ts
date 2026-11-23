import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const RETRY_STATUS = [429, 502, 503, 504];
/** 20 s, 40 s, 80 s ... capped at 10 minutes between tries. */
const backoffMs = (attempts: number) => Math.min(10 * 60_000, 20_000 * 2 ** Math.min(attempts, 6));
const PER_CALL = 2;

interface PendingRow {
  id: string;
  attempts: number;
  log_date: string;
  hour: number;
  text: string | null;
  audio_mime: string | null;
  audio_b64: string | null;
  batches: unknown[] | null;
}

/**
 * Retries saved meals. Called two ways:
 *  - the app, with the signed-in user's token: processes that user's due entries;
 *  - the Supabase scheduler (pending_retry.sql), with x-cron-secret: processes every user's due entries.
 * Uses the service key on the server only; the browser never sees it.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Server retry is not configured." }, { status: 503 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | null = null;
  const cron = process.env.CRON_SECRET && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  if (!cron) {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sign in to retry saved meals." }, { status: 401 });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Sign in to retry saved meals." }, { status: 401 });
    userId = data.user.id;
  }

  const now = () => new Date().toISOString();
  let query = db.from("pending_meals").select("*").eq("status", "waiting").lte("next_try_at", now())
    .or(`locked_until.is.null,locked_until.lt.${now()}`).order("created_at").limit(PER_CALL);
  if (userId) query = query.eq("user_id", userId);
  const { data: rows, error: listErr } = await query;
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  let processed = 0;
  for (const row of (rows ?? []) as PendingRow[]) {
    // Claim the row so the app and the scheduler never parse the same entry at once.
    const { data: claimed } = await db.from("pending_meals")
      .update({ locked_until: new Date(Date.now() + 90_000).toISOString() })
      .eq("id", row.id).or(`locked_until.is.null,locked_until.lt.${now()}`).select("id");
    if (!claimed?.length) continue;

    const attempts = row.attempts + 1;
    let patch: Record<string, unknown>;
    try {
      const res = await fetch(`${origin}/api/parse-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: row.text ?? undefined,
          audio: row.audio_b64 ? { mimeType: row.audio_mime ?? "audio/wav", data: row.audio_b64 } : undefined,
          mode: "meal",
          hour: row.hour,
          today: row.log_date,
          batches: row.batches ?? [],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.kind) {
        // Reached the AI: keep the reply, drop the audio.
        patch = { status: "ready", result: data, audio_b64: null, audio_mime: null, last_error: null, attempts, locked_until: null, next_try_at: null };
      } else {
        const message = data?.error ?? `The AI service returned HTTP ${res.status}.`;
        const busy = !data || RETRY_STATUS.includes(res.status);
        patch = busy
          ? { status: "waiting", attempts, last_error: message, locked_until: null, next_try_at: new Date(Date.now() + backoffMs(attempts)).toISOString() }
          : { status: "failed", attempts, last_error: message, locked_until: null, next_try_at: null };
      }
    } catch {
      patch = { status: "waiting", attempts, last_error: "Could not reach the AI service.", locked_until: null, next_try_at: new Date(Date.now() + backoffMs(attempts)).toISOString() };
    }
    await db.from("pending_meals").update(patch).eq("id", row.id);
    processed++;
  }
  return NextResponse.json({ processed });
}
