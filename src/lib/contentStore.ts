"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FAQS, Faq, GUIDE_SECTIONS, GuideSection, PROPORTIONS, RECIPE_CATEGORIES, RECIPE_TIPS, RecipeCategory, TRY_IDEAS, WEEK_PLAN } from "./guide";
import type { FoodItem } from "./types";
import { todayISO } from "./dates";
import { pullContent, pushContent } from "./supabase";
import { useStore } from "./store";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const defaultRecipes = (): RecipeCategory[] => [
  ...clone(RECIPE_CATEGORIES).filter((c) => c.id !== "try"),
  { id: "try", title: "Try", emoji: "🧪", items: [...TRY_IDEAS] },
];

const tipsSection = (points: string[]): GuideSection => ({ id: "tips", title: "Tips", subtitle: "Small habits that make it easier", emoji: "💡", points });

const defaultGuide = (): GuideSection[] => [
  ...clone(GUIDE_SECTIONS),
  tipsSection([...RECIPE_TIPS]),
  { id: "proportions", title: "Proportions & Week Plan", subtitle: "What the trailblazers follow for peak performance", emoji: "🎯", points: [...PROPORTIONS, `Week plan: ${WEEK_PLAN}`] },
];

type List = "recipes" | "guide";

interface ContentData {
  /** One whole-day meal per date (ISO). */
  plans: Record<string, FoodItem[]>;
  recipes: RecipeCategory[];
  guide: GuideSection[];
  faqs: Faq[];
}

interface ContentState extends ContentData {
  addItem: (list: List, id: string, text: string) => void;
  editItem: (list: List, id: string, index: number, text: string) => void;
  removeItem: (list: List, id: string, index: number) => void;
  addFaq: (q: string, a: string) => void;
  editFaq: (index: number, q: string, a: string) => void;
  removeFaq: (index: number) => void;
  addPlan: (date: string, items: FoodItem[]) => void;
  clearPlan: (date: string) => void;
  /** Replaces the whole plan for a date, optionally moving it to another date. */
  replacePlan: (from: string, to: string, items: FoodItem[]) => void;
  /** Drops plans for days before today. */
  pruneOldPlans: () => void;
  hydrateContent: (uid: string) => Promise<void>;
}

const mapList = (st: ContentData, list: List, id: string, f: (items: string[]) => string[]) =>
  list === "recipes"
    ? { recipes: st.recipes.map((c) => (c.id === id ? { ...c, items: f(c.items) } : c)) }
    : { guide: st.guide.map((c) => (c.id === id ? { ...c, points: f(c.points) } : c)) };

let timer: ReturnType<typeof setTimeout> | undefined;
const pick = (s: ContentData): ContentData => ({ plans: s.plans, recipes: s.recipes, guide: s.guide, faqs: s.faqs });

/** Debounced upload of all editable content for the signed-in user. */
function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const uid = useStore.getState().userId;
    if (!uid) return;
    pushContent(uid, pick(useContent.getState())).then(
      () => useStore.setState({ syncError: null }),
      (e: unknown) => useStore.setState({ syncError: e instanceof Error ? e.message : "Sync failed" }),
    );
  }, 500);
}

export const useContent = create<ContentState>()(
  persist(
    (set, get) => {
      const upd = (fn: (st: ContentState) => Partial<ContentData>) => { set(fn); schedulePush(); };
      return {
        plans: {},
        recipes: defaultRecipes(),
        guide: defaultGuide(),
        faqs: clone(FAQS),
        addItem: (list, id, text) => upd((st) => mapList(st, list, id, (a) => [...a, text.trim()])),
        editItem: (list, id, index, text) => upd((st) => mapList(st, list, id, (a) => a.map((x, i) => (i === index ? text.trim() : x)))),
        removeItem: (list, id, index) => upd((st) => mapList(st, list, id, (a) => a.filter((_, i) => i !== index))),
        addFaq: (q, a) => upd((st) => ({ faqs: [...st.faqs, { q: q.trim(), a: a.trim() }] })),
        editFaq: (index, q, a) => upd((st) => ({ faqs: st.faqs.map((f, i) => (i === index ? { q: q.trim(), a: a.trim() } : f)) })),
        removeFaq: (index) => upd((st) => ({ faqs: st.faqs.filter((_, i) => i !== index) })),
        addPlan: (date, items) => upd((st) => ({ plans: { ...st.plans, [date]: [...(st.plans[date] ?? []), ...items] } })),
        clearPlan: (date) => upd((st) => { const plans = { ...st.plans }; delete plans[date]; return { plans }; }),
        replacePlan: (from, to, items) => upd((st) => {
          const plans = { ...st.plans };
          delete plans[from];
          if (items.length) plans[to] = items;
          return { plans };
        }),
        pruneOldPlans: () => {
          const today = todayISO();
          if (Object.keys(get().plans).some((d) => d < today)) upd((st) => ({ plans: Object.fromEntries(Object.entries(st.plans).filter(([d]) => d >= today)) }));
        },
        // Remote wins; if the account has no row yet, this device's content is uploaded.
        hydrateContent: async (uid) => {
          const r = await pullContent(uid);
          if (!r) { await pushContent(uid, pick(get())); return; }
          set({
            plans: (r.plans as ContentData["plans"]) ?? get().plans,
            recipes: (r.recipes as RecipeCategory[] | null) ?? get().recipes,
            guide: (r.guide as GuideSection[] | null) ?? get().guide,
            faqs: (r.faqs as Faq[] | null) ?? get().faqs,
          });
          get().pruneOldPlans();
        },
      };
    },
    {
      name: "tfr-content-v1",
      version: 2,
      partialize: (s) => pick(s),
      // v1 kept Tips under Recipes and had no plans; Tips now live in the Guide.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<ContentData>;
        const recipes = p.recipes ?? defaultRecipes();
        const tips = recipes.find((c) => c.id === "tips");
        const guide = p.guide ?? defaultGuide();
        if (tips && !guide.some((g) => g.id === "tips")) guide.splice(Math.max(0, guide.length - 1), 0, tipsSection(tips.items));
        return { plans: {}, faqs: clone(FAQS), ...p, recipes: recipes.filter((c) => c.id !== "tips"), guide } as ContentState;
      },
    },
  ),
);
