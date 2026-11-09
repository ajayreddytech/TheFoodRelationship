"use client";

import { useEffect } from "react";

// Registers /sw.js so the app is installable as a standalone PWA.
// Only runs in production builds to avoid interfering with local development.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure is non-fatal; the app works normally in the browser.
    });
  }, []);
  return null;
}
