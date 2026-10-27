"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { pullAll, supabase } from "@/lib/supabase";
import { Dock } from "./Dock";
import { HeaderNav } from "./HeaderNav";
import { Backdrop } from "./Backdrop";
import { LogView } from "./LogView";
import { CalendarView } from "./CalendarView";
import { InsightsView } from "./InsightsView";
import { NutrientsView } from "./NutrientsView";
import { WeightView } from "./WeightView";
import { SettingsView } from "./SettingsView";
import { RecipesView } from "./RecipesView";
import { GuideView } from "./GuideView";
import { PlanView } from "./PlanView";
import { useContent } from "@/lib/contentStore";

export function AppShell() {
  const [mounted, setMounted] = useState(false);
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const palette = useStore((s) => s.palette);
  const syncError = useStore((s) => s.syncError);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.palette = palette;
  }, [theme, palette, mounted]);

  useEffect(() => {
    if (!supabase) return;
    const apply = async (user: { id: string; email?: string } | null) => {
      const st = useStore.getState();
      st.setUser(user?.id ?? null, user?.email ?? null);
      if (user) {
        try {
          st.hydrateRemote(await pullAll(user.id));
          await useContent.getState().hydrateContent(user.id);
          await useStore.getState().syncDrafts();
        } catch (e) {
          useStore.setState({ syncError: e instanceof Error ? e.message : "Sync failed" });
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Defer to avoid deadlocking the auth client with its own calls.
      setTimeout(() => apply(session?.user ?? null), 0);
    });
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void useStore.getState().syncDrafts();
      void useStore.getState().syncShared();
      const uid = useStore.getState().userId;
      if (uid) useContent.getState().hydrateContent(uid).catch(() => {});
    };
    const timer = setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!mounted) return <div className="min-h-screen" />;

  const View = { log: LogView, calendar: CalendarView, insights: InsightsView, nutrients: NutrientsView, weight: WeightView, plan: PlanView, recipes: RecipesView, guide: GuideView, settings: SettingsView }[view];

  return (
    <div className="min-h-screen">
      <Backdrop />
      <Dock />
      <HeaderNav />
      <main className={`mx-auto max-w-5xl px-4 pb-28 sm:px-6 md:pb-10 md:pl-24 ${view === "log" ? "pt-4" : "pt-16"}`}>
        {syncError && (
          <div role="alert" className="mb-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2 text-sm">
            Cloud sync issue: {syncError}. Your data is safe locally.
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <View />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
