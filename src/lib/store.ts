import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CookedBatch, DailyLog, MealBucket, MealEntry, FoodItem, Palette, Profile, Theme, UsersProfileRow, WeightLog } from "./types";
import { emptyLog, scaleItem, sumItems, todayISO, uid } from "./dates";
import {
  RemoteData, deleteRemoteBatch, deleteRemoteDraft, deleteRemoteLog, deleteRemoteWeight, pullBatches, pullDrafts, pullProfile, pullWeights, pushBatch, pushDraft, pushLog, pushProfile, pushWeight, syncMessage,
} from "./supabase";

export type View = "log" | "plan" | "calendar" | "insights" | "nutrients" | "recipes" | "guide" | "weight" | "settings";

export const DEFAULT_PROFILE: Profile = {
  dob: null,
  gender: "male",
  heightCm: 170,
  weightKg: 70,
  activity: "moderate",
  unitSystem: "metric",
  expenditureGoal: 500,
  hydrationGoalL: 2.5,
  fastingGoalH: 16,
  targetWeightKg: null,
};

interface State {
  view: View;
  selectedDate: string;
  theme: Theme;
  palette: Palette;
  profile: Profile;
  logs: Record<string, DailyLog>;
  weights: WeightLog[];
  batches: CookedBatch[];
  /** Ids/dates known to exist on the server. A synced item that vanishes remotely was deleted on another device. */
  syncedBatchIds: string[];
  syncedDrafts: string[];
  syncedWeights: string[];
  /** Batch deletions not yet confirmed by the server (retried so they cannot come back). */
  deletedBatchIds: string[];
  userId: string | null;
  userEmail: string | null;
  syncError: string | null;

  setView: (v: View) => void;
  setDate: (d: string) => void;
  setTheme: (t: Theme) => void;
  setPalette: (p: Palette) => void;
  setProfile: (p: Partial<Profile>) => void;
  getLog: (date: string) => DailyLog;
  patchLog: (date: string, patch: Partial<DailyLog>) => void;
  addMeal: (date: string, bucket: MealBucket, items: FoodItem[]) => void;
  updateMeal: (date: string, id: string, bucket: MealBucket, items: FoodItem[]) => void;
  removeMeal: (date: string, id: string) => void;
  submitLog: (date: string) => void;
  /** Full-day fast: zero intake, 24h fast, GYR green, no nibbles; submits immediately. */
  setFastingDay: (date: string, on: boolean) => void;
  deleteLog: (date: string) => void;
  addBatch: (b: CookedBatch) => void;
  /** Edits a batch and re-scales every logged meal that was a share of it. */
  updateBatch: (id: string, patch: { name: string; cookedWeightG: number | null; servings: number | null; ingredients: FoodItem[] }) => void;
  consumeBatch: (id: string, fraction: number) => void;
  removeBatch: (id: string) => void;
  addWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;
  setUser: (id: string | null, email: string | null) => void;
  hydrateRemote: (r: RemoteData) => void;
  /** Merges drafts from other devices (newer wins) and uploads newer local drafts. */
  syncDrafts: () => Promise<void>;
  /** Pulls cooked batches and weights so deletes/edits made on other devices show up here. */
  syncShared: () => Promise<void>;
}

const addTo = (xs: string[], ...ids: string[]) => [...new Set([...xs, ...ids])];

/** Batches whose upload is in flight; a pull must not overwrite them with older server data. */
const batchInflight = new Set<string>();

function mergeBatches(local: CookedBatch[], remote: CookedBatch[], synced: string[], deleted: string[]) {
  const del = new Set(deleted), syn = new Set(synced), rids = new Set(remote.map((b) => b.id));
  const out = remote.filter((b) => !del.has(b.id)).map((b) => (batchInflight.has(b.id) ? local.find((x) => x.id === b.id) ?? b : b));
  const toPush: CookedBatch[] = [];
  for (const l of local) {
    if (rids.has(l.id) || del.has(l.id)) continue;
    if (syn.has(l.id) && !batchInflight.has(l.id)) continue; // deleted on another device
    out.push(l);
    toPush.push(l);
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { batches: out, toPush, synced: [...rids] };
}

async function pushBatchTracked(set: (p: Partial<State>) => void, get: () => State, u: string, b: CookedBatch) {
  batchInflight.add(b.id);
  try {
    await pushBatch(u, b);
    set({ syncedBatchIds: addTo(get().syncedBatchIds, b.id) });
  } finally { batchInflight.delete(b.id); }
}

/** Per-batch push chain: uploads run one after another and always send the latest local state, so a slow earlier response can't roll `remaining` back. */
const batchQueue = new Map<string, Promise<void>>();
function queueBatchPush(set: (p: Partial<State>) => void, get: () => State, u: string, id: string) {
  const send = async () => {
    const b = get().batches.find((x) => x.id === id);
    if (b) await pushBatchTracked(set, get, u, b);
  };
  const next = (batchQueue.get(id) ?? Promise.resolve()).then(send, send);
  batchQueue.set(id, next);
  return next.finally(() => { if (batchQueue.get(id) === next) batchQueue.delete(id); });
}

async function pushDraftTracked(set: (p: Partial<State>) => void, get: () => State, u: string, log: DailyLog) {
  await pushDraft(u, log);
  set({ syncedDrafts: addTo(get().syncedDrafts, log.date) });
}

const sync = (set: (p: Partial<State>) => void, fn: () => Promise<unknown>) =>
  fn().then(
    () => set({ syncError: null }),
    (e: unknown) => set({ syncError: syncMessage(e) }),
  );

const now = () => new Date().toISOString();
const draftTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/** Debounced upload of one day's form so other devices see it even before submission. */
function queueDraft(set: (p: Partial<State>) => void, get: () => State, date: string) {
  clearTimeout(draftTimers[date]);
  draftTimers[date] = setTimeout(() => {
    const u = get().userId;
    const log = get().logs[date];
    if (u && log) sync(set, () => pushDraftTracked(set, get, u, log));
  }, 600);
}

const latestWeight = (w: WeightLog[]) => [...w].sort((a, b) => b.date.localeCompare(a.date))[0];

const prefsOf = (s: { theme: Theme; palette: Palette }) => ({ theme: s.theme, palette: s.palette });

/** Overlay a remote profile row (settings, goals, theme) on the local state. */
function applyProfileRow(s: { profile: Profile; theme: Theme; palette: Palette }, p: UsersProfileRow | null) {
  if (!p) return { profile: s.profile, theme: s.theme, palette: s.palette };
  const o = s.profile;
  const profile: Profile = {
    dob: p.dob, gender: p.gender ?? o.gender, heightCm: p.height_cm ?? o.heightCm,
    weightKg: p.weight_kg ?? o.weightKg, activity: p.activity_level ?? o.activity,
    unitSystem: p.unit_system ?? o.unitSystem,
    expenditureGoal: p.expenditure_goal ?? o.expenditureGoal,
    hydrationGoalL: p.hydration_goal_l ?? o.hydrationGoalL,
    fastingGoalH: p.fasting_goal_h ?? o.fastingGoalH, targetWeightKg: p.target_weight_kg,
  };
  return { profile, theme: (p.prefs?.theme as Theme) ?? s.theme, palette: (p.prefs?.palette as Palette) ?? s.palette };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      view: "log",
      selectedDate: todayISO(),
      theme: "light",
      palette: "emerald",
      profile: DEFAULT_PROFILE,
      logs: {},
      weights: [],
      batches: [],
      syncedBatchIds: [],
      syncedDrafts: [],
      syncedWeights: [],
      deletedBatchIds: [],
      userId: null,
      userEmail: null,
      syncError: null,

      setView: (view) => set({ view }),
      setDate: (selectedDate) => set({ selectedDate }),
      setTheme: (theme) => { set({ theme }); const u = get().userId; if (u) sync(set, () => pushProfile(u, get().profile, prefsOf(get()))); },
      setPalette: (palette) => { set({ palette }); const u = get().userId; if (u) sync(set, () => pushProfile(u, get().profile, prefsOf(get()))); },

      setProfile: (patch) => {
        const profile = { ...get().profile, ...patch };
        set({ profile });
        const u = get().userId;
        if (u) sync(set, () => pushProfile(u, profile, prefsOf(get())));
      },

      getLog: (date) => get().logs[date] ?? emptyLog(date),

      patchLog: (date, patch) => {
        set((s) => ({ logs: { ...s.logs, [date]: { ...(s.logs[date] ?? emptyLog(date)), ...patch, submitted: false, updatedAt: now() } } }));
        queueDraft(set, get, date);
      },

      addMeal: (date, bucket, items) => {
        set((s) => {
          const cur = s.logs[date] ?? emptyLog(date);
          const entry: MealEntry = { id: uid(), bucket, items };
          return { logs: { ...s.logs, [date]: { ...cur, meals: [...cur.meals, entry], submitted: false, updatedAt: now() } } };
        });
        queueDraft(set, get, date);
      },

      updateMeal: (date, id, bucket, items) => {
        set((s) => {
          const cur = s.logs[date];
          if (!cur) return s;
          return { logs: { ...s.logs, [date]: { ...cur, meals: cur.meals.map((m) => (m.id === id ? { ...m, bucket, items } : m)), submitted: false, updatedAt: now() } } };
        });
        queueDraft(set, get, date);
      },

      updateBatch: (id, patch) => {
        const old = get().batches.find((b) => b.id === id);
        if (!old) return;
        const total = sumItems(patch.name, "whole batch", patch.ingredients);
        const batch: CookedBatch = { ...old, ...patch, total };
        const changed: DailyLog[] = [];
        const logs = Object.fromEntries(
          Object.entries(get().logs).map(([d, l]) => {
            let hit = false;
            const meals = l.meals.map((m) => ({
              ...m,
              items: m.items.map((it) => {
                if (it.batch?.id !== id) return it;
                hit = true;
                return { ...scaleItem(total, it.batch.fraction, `${patch.name} (portion)`, it.quantity), batch: it.batch };
              }),
            }));
            if (!hit) return [d, l];
            const nl = { ...l, meals };
            changed.push(nl);
            return [d, nl];
          }),
        );
        set({ logs, batches: get().batches.map((b) => (b.id === id ? batch : b)) });
        const u = get().userId;
        if (u) sync(set, async () => { await queueBatchPush(set, get, u, id); for (const l of changed) if (l.submitted) await pushLog(u, l); });
      },

      removeMeal: (date, id) => {
        set((s) => {
          const cur = s.logs[date];
          if (!cur) return s;
          return { logs: { ...s.logs, [date]: { ...cur, meals: cur.meals.filter((m) => m.id !== id), submitted: false, updatedAt: now() } } };
        });
        queueDraft(set, get, date);
      },

      submitLog: (date) => {
        const log = { ...get().getLog(date), submitted: true, updatedAt: now() };
        set((s) => ({ logs: { ...s.logs, [date]: log } }));
        const u = get().userId;
        if (u) sync(set, async () => { await pushLog(u, log); await pushDraftTracked(set, get, u, log); });
      },

      setFastingDay: (date, on) => {
        const cur = get().getLog(date);
        const log: DailyLog = on
          ? { ...cur, meals: [], fasted: true, firstMealAt: null, lastMealAt: null, gyr: "green", nibbles: false, submitted: true, updatedAt: now() }
          : { ...cur, fasted: false, submitted: false, updatedAt: now() };
        set((s) => ({ logs: { ...s.logs, [date]: log } }));
        const u = get().userId;
        if (on && u) sync(set, async () => { await pushLog(u, log); await pushDraftTracked(set, get, u, log); });
        else queueDraft(set, get, date);
      },

      addBatch: (b) => {
        set((s) => ({ batches: [b, ...s.batches] }));
        const u = get().userId;
        if (u) sync(set, () => pushBatchTracked(set, get, u, b));
      },

      consumeBatch: (id, fraction) => {
        const cur = get().batches.find((b) => b.id === id);
        if (!cur) return;
        const remaining = Math.max(0, Math.round((cur.remaining - fraction) * 1000) / 1000);
        // Auto-cleanup: a batch with nothing left leaves the active inventory (removeBatch also deletes it remotely).
        if (remaining <= 0) { get().removeBatch(id); return; }
        set((s) => ({ batches: s.batches.map((b) => (b.id === id ? { ...b, remaining } : b)) }));
        const u = get().userId;
        if (u) sync(set, () => queueBatchPush(set, get, u, id));
      },

      removeBatch: (id) => {
        set((s) => ({ batches: s.batches.filter((b) => b.id !== id), deletedBatchIds: addTo(s.deletedBatchIds, id) }));
        const u = get().userId;
        if (u) sync(set, async () => {
          await deleteRemoteBatch(u, id);
          set((s) => ({ deletedBatchIds: s.deletedBatchIds.filter((x) => x !== id), syncedBatchIds: s.syncedBatchIds.filter((x) => x !== id) }));
        });
      },

      deleteLog: (date) => {
        set((s) => {
          const logs = { ...s.logs };
          delete logs[date];
          return { logs };
        });
        const u = get().userId;
        if (u) sync(set, async () => { await deleteRemoteLog(u, date); await deleteRemoteDraft(u, date); set((s) => ({ syncedDrafts: s.syncedDrafts.filter((x) => x !== date) })); });
      },

      addWeight: (date, kg) => {
        const w = { date, weightKg: kg };
        const weights = [...get().weights.filter((x) => x.date !== date), w];
        const latest = latestWeight(weights);
        set({ weights, profile: { ...get().profile, weightKg: latest.weightKg } });
        const u = get().userId;
        if (u) sync(set, async () => { await pushWeight(u, w); set({ syncedWeights: addTo(get().syncedWeights, date) }); await pushProfile(u, get().profile, prefsOf(get())); });
      },

      removeWeight: (date) => {
        const weights = get().weights.filter((x) => x.date !== date);
        const latest = latestWeight(weights);
        set({ weights, profile: latest ? { ...get().profile, weightKg: latest.weightKg } : get().profile });
        const u = get().userId;
        if (u) sync(set, async () => { await deleteRemoteWeight(u, date); set((s) => ({ syncedWeights: s.syncedWeights.filter((x) => x !== date) })); });
      },

      setUser: (userId, userEmail) => set({ userId, userEmail }),

      syncDrafts: async () => {
        const u = get().userId;
        if (!u) return;
        try {
          const remote = await pullDrafts(u);
          const byDate = new Map(remote.map((d) => [d.date, d]));
          const logs = { ...get().logs };
          let changed = false;
          for (const d of remote) {
            const local = logs[d.date];
            if (!local || (d.updatedAt ?? "") > (local.updatedAt ?? "")) { logs[d.date] = { ...emptyLog(d.date), ...d }; changed = true; }
          }
          if (changed) set({ logs });
          const synced = new Set(get().syncedDrafts);
          const dropped: string[] = [];
          for (const l of Object.values(get().logs)) {
            const r = byDate.get(l.date);
            if (!r && synced.has(l.date)) { dropped.push(l.date); continue; } // deleted on another device
            if (l.updatedAt && (!r || l.updatedAt > (r.updatedAt ?? ""))) await pushDraftTracked(set, get, u, l);
          }
          if (dropped.length) {
            const logs2 = { ...get().logs };
            for (const d of dropped) delete logs2[d];
            set({ logs: logs2 });
          }
          set({ syncedDrafts: addTo(remote.map((d) => d.date), ...get().syncedDrafts.filter((d) => !dropped.includes(d) && get().logs[d] && byDate.has(d))) });
        } catch (e) {
          set({ syncError: syncMessage(e) });
        }
      },

      syncShared: async () => {
        const u = get().userId;
        if (!u) return;
        try {
          for (const id of get().deletedBatchIds) {
            await deleteRemoteBatch(u, id);
            set((s) => ({ deletedBatchIds: s.deletedBatchIds.filter((x) => x !== id) }));
          }
          const [rb, rw, rp] = await Promise.all([pullBatches(u), pullWeights(u), pullProfile(u)]);
          if (rp) {
            const a = applyProfileRow(get(), rp);
            if (JSON.stringify([a.profile, a.theme, a.palette]) !== JSON.stringify([get().profile, get().theme, get().palette])) set(a);
          }
          const s = get();
          const m = mergeBatches(s.batches, rb, s.syncedBatchIds, s.deletedBatchIds);
          if (JSON.stringify(m.batches) !== JSON.stringify(s.batches)) set({ batches: m.batches });
          set({ syncedBatchIds: m.synced });
          for (const b of m.toPush) await pushBatchTracked(set, get, u, b);

          const wr = new Set(rw.map((w) => w.date)), ws = new Set(s.syncedWeights);
          const keep = s.weights.filter((w) => wr.has(w.date) || !ws.has(w.date));
          const weights = [...rw, ...keep.filter((w) => !wr.has(w.date))];
          const norm = (xs: WeightLog[]) => JSON.stringify([...xs].sort((a, b) => a.date.localeCompare(b.date)));
          if (norm(weights) !== norm(s.weights)) {
            const latest = latestWeight(weights);
            set({ weights, ...(latest ? { profile: { ...get().profile, weightKg: latest.weightKg } } : {}) });
          }
          set({ syncedWeights: [...wr] });
          for (const w of keep) if (!wr.has(w.date)) { await pushWeight(u, w); set({ syncedWeights: addTo(get().syncedWeights, w.date) }); }
        } catch (e) {
          set({ syncError: syncMessage(e) });
        }
      },

      // Remote wins per-date; local-only records are pushed up so guest data isn't lost.
      hydrateRemote: (r) => {
        const s = get();
        const remoteDates = new Set(r.logs.map((l) => l.date));
        const logs = { ...s.logs };
        // An unsubmitted local draft is never overwritten by the last submitted copy; syncDrafts resolves it.
        for (const l of r.logs) if (!(logs[l.date] && !logs[l.date].submitted)) logs[l.date] = l;
        const sd = new Set(s.syncedDrafts), sw = new Set(s.syncedWeights);
        // Submitted days that were synced before but are gone remotely were deleted on another device.
        for (const l of Object.values(s.logs)) if (l.submitted && !remoteDates.has(l.date) && sd.has(l.date)) delete logs[l.date];
        const rw = new Set(r.weights.map((w) => w.date));
        const weights = [...r.weights, ...s.weights.filter((w) => !rw.has(w.date) && !sw.has(w.date))];
        const mb = mergeBatches(s.batches, r.batches, s.syncedBatchIds, s.deletedBatchIds);
        const batches = mb.batches;
        const { profile, theme, palette } = applyProfileRow(s, r.profile);
        set({ logs, weights, profile, theme, palette, batches, syncedBatchIds: mb.synced, syncedWeights: [...rw] });
        const u = s.userId;
        if (!u) return;
        sync(set, async () => {
          if (!r.profile) await pushProfile(u, profile, prefsOf(get()));
          for (const l of Object.values(s.logs)) if (l.submitted && !remoteDates.has(l.date) && !sd.has(l.date)) await pushLog(u, l);
          for (const w of s.weights) if (!rw.has(w.date) && !sw.has(w.date)) { await pushWeight(u, w); set({ syncedWeights: addTo(get().syncedWeights, w.date) }); }
          for (const b of mb.toPush) await pushBatchTracked(set, get, u, b);
          for (const id of s.deletedBatchIds) { await deleteRemoteBatch(u, id); set((x) => ({ deletedBatchIds: x.deletedBatchIds.filter((y) => y !== id) })); }
        });
      },
    }),
    {
      name: "thefoodrelationship-v1",
      partialize: (s) => ({
        theme: s.theme, palette: s.palette, profile: s.profile, logs: s.logs, weights: s.weights, batches: s.batches,
        syncedBatchIds: s.syncedBatchIds, syncedDrafts: s.syncedDrafts, syncedWeights: s.syncedWeights, deletedBatchIds: s.deletedBatchIds,
      }),
      // Logs saved by older versions lack newer fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const logs = Object.fromEntries(Object.entries(p.logs ?? {}).map(([d, l]) => [d, { ...emptyLog(d), ...l }]));
        return { ...current, ...p, logs, batches: p.batches ?? [] };
      },
    },
  ),
);
