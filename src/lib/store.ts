import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CookedBatch, DailyLog, MealBucket, MealEntry, FoodItem, Palette, Profile, Theme, WeightLog } from "./types";
import { emptyLog, scaleItem, sumItems, todayISO, uid } from "./dates";
import {
  RemoteData, deleteRemoteBatch, deleteRemoteLog, deleteRemoteWeight, pushBatch, pushLog, pushProfile, pushWeight,
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
}

const sync = (set: (p: Partial<State>) => void, fn: () => Promise<unknown>) =>
  fn().then(
    () => set({ syncError: null }),
    (e: unknown) => set({ syncError: e instanceof Error ? e.message : "Sync failed" }),
  );

const latestWeight = (w: WeightLog[]) => [...w].sort((a, b) => b.date.localeCompare(a.date))[0];

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
      userId: null,
      userEmail: null,
      syncError: null,

      setView: (view) => set({ view }),
      setDate: (selectedDate) => set({ selectedDate }),
      setTheme: (theme) => set({ theme }),
      setPalette: (palette) => set({ palette }),

      setProfile: (patch) => {
        const profile = { ...get().profile, ...patch };
        set({ profile });
        const u = get().userId;
        if (u) sync(set, () => pushProfile(u, profile));
      },

      getLog: (date) => get().logs[date] ?? emptyLog(date),

      patchLog: (date, patch) =>
        set((s) => ({ logs: { ...s.logs, [date]: { ...(s.logs[date] ?? emptyLog(date)), ...patch, submitted: false } } })),

      addMeal: (date, bucket, items) =>
        set((s) => {
          const cur = s.logs[date] ?? emptyLog(date);
          const entry: MealEntry = { id: uid(), bucket, items };
          return { logs: { ...s.logs, [date]: { ...cur, meals: [...cur.meals, entry], submitted: false } } };
        }),

      updateMeal: (date, id, bucket, items) =>
        set((s) => {
          const cur = s.logs[date];
          if (!cur) return s;
          return { logs: { ...s.logs, [date]: { ...cur, meals: cur.meals.map((m) => (m.id === id ? { ...m, bucket, items } : m)), submitted: false } } };
        }),

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
        if (u) sync(set, async () => { await pushBatch(u, batch); for (const l of changed) if (l.submitted) await pushLog(u, l); });
      },

      removeMeal: (date, id) =>
        set((s) => {
          const cur = s.logs[date];
          if (!cur) return s;
          return { logs: { ...s.logs, [date]: { ...cur, meals: cur.meals.filter((m) => m.id !== id), submitted: false } } };
        }),

      submitLog: (date) => {
        const log = { ...get().getLog(date), submitted: true };
        set((s) => ({ logs: { ...s.logs, [date]: log } }));
        const u = get().userId;
        if (u) sync(set, () => pushLog(u, log));
      },

      setFastingDay: (date, on) => {
        const cur = get().getLog(date);
        const log: DailyLog = on
          ? { ...cur, meals: [], fasted: true, firstMealAt: null, lastMealAt: null, gyr: "green", nibbles: false, submitted: true }
          : { ...cur, fasted: false, submitted: false };
        set((s) => ({ logs: { ...s.logs, [date]: log } }));
        const u = get().userId;
        if (on && u) sync(set, () => pushLog(u, log));
      },

      addBatch: (b) => {
        set((s) => ({ batches: [b, ...s.batches] }));
        const u = get().userId;
        if (u) sync(set, () => pushBatch(u, b));
      },

      consumeBatch: (id, fraction) => {
        const batches = get().batches.map((b) => (b.id === id ? { ...b, remaining: Math.max(0, Math.round((b.remaining - fraction) * 1000) / 1000) } : b));
        set({ batches });
        const u = get().userId;
        const b = batches.find((x) => x.id === id);
        if (u && b) sync(set, () => pushBatch(u, b));
      },

      removeBatch: (id) => {
        set((s) => ({ batches: s.batches.filter((b) => b.id !== id) }));
        const u = get().userId;
        if (u) sync(set, () => deleteRemoteBatch(u, id));
      },

      deleteLog: (date) => {
        set((s) => {
          const logs = { ...s.logs };
          delete logs[date];
          return { logs };
        });
        const u = get().userId;
        if (u) sync(set, () => deleteRemoteLog(u, date));
      },

      addWeight: (date, kg) => {
        const w = { date, weightKg: kg };
        const weights = [...get().weights.filter((x) => x.date !== date), w];
        const latest = latestWeight(weights);
        set({ weights, profile: { ...get().profile, weightKg: latest.weightKg } });
        const u = get().userId;
        if (u) sync(set, async () => { await pushWeight(u, w); await pushProfile(u, get().profile); });
      },

      removeWeight: (date) => {
        const weights = get().weights.filter((x) => x.date !== date);
        const latest = latestWeight(weights);
        set({ weights, profile: latest ? { ...get().profile, weightKg: latest.weightKg } : get().profile });
        const u = get().userId;
        if (u) sync(set, () => deleteRemoteWeight(u, date));
      },

      setUser: (userId, userEmail) => set({ userId, userEmail }),

      // Remote wins per-date; local-only records are pushed up so guest data isn't lost.
      hydrateRemote: (r) => {
        const s = get();
        const remoteDates = new Set(r.logs.map((l) => l.date));
        const logs = { ...s.logs };
        for (const l of r.logs) logs[l.date] = l;
        const rw = new Set(r.weights.map((w) => w.date));
        const weights = [...r.weights, ...s.weights.filter((w) => !rw.has(w.date))];
        const rb = new Set(r.batches.map((b) => b.id));
        const batches = [...r.batches, ...s.batches.filter((b) => !rb.has(b.id))];
        let profile = s.profile;
        if (r.profile) {
          const p = r.profile;
          profile = {
            dob: p.dob, gender: p.gender ?? profile.gender, heightCm: p.height_cm ?? profile.heightCm,
            weightKg: p.weight_kg ?? profile.weightKg, activity: p.activity_level ?? profile.activity,
            unitSystem: p.unit_system ?? profile.unitSystem,
            expenditureGoal: p.expenditure_goal ?? profile.expenditureGoal,
            hydrationGoalL: p.hydration_goal_l ?? profile.hydrationGoalL,
            fastingGoalH: p.fasting_goal_h ?? profile.fastingGoalH, targetWeightKg: p.target_weight_kg,
          };
        }
        set({ logs, weights, profile, batches });
        const u = s.userId;
        if (!u) return;
        sync(set, async () => {
          if (!r.profile) await pushProfile(u, profile);
          for (const l of Object.values(s.logs)) if (l.submitted && !remoteDates.has(l.date)) await pushLog(u, l);
          for (const w of s.weights) if (!rw.has(w.date)) await pushWeight(u, w);
          for (const b of s.batches) if (!rb.has(b.id)) await pushBatch(u, b);
        });
      },
    }),
    {
      name: "thefoodrelationship-v1",
      partialize: (s) => ({
        theme: s.theme, palette: s.palette, profile: s.profile, logs: s.logs, weights: s.weights, batches: s.batches,
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
