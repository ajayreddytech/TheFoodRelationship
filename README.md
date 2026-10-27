<div align="center">

<img src="public/logo.png" alt="TheFoodRelationship logo" width="120" />

# TheFoodRelationship

**A fast, offline-friendly wellness tracker for calories, nutrients, hydration, weight and intermittent fasting, with AI meal parsing from voice or plain text.**

[Live demo](http://thefoodrelationship.netlify.app/) · [Report a bug](https://github.com/ajayreddytech/TheFoodRelationship/issues)

![Next.js](https://img.shields.io/badge/Next.js_14-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)

</div>

## Why this exists

Most food trackers make logging tedious: search a database, pick a serving, repeat for every ingredient. TheFoodRelationship lets you say *"For dinner I had 200g grilled chicken and a cup of quinoa"* and turns it into structured calories, macros and micros, which you confirm before anything is saved. It also treats fasting windows, hydration, mood-of-the-day (Green/Yellow/Red) and weight as first-class data, so you can see the whole picture in one place.

## Features

| Area | What you get |
| --- | --- |
| **Log** | Eight meal buckets, eating-window and fasting clock, hydration, expenditure, GYR rating, nibbles, live calorie gauge and targets |
| **AI parsing** | Voice (Web Speech API) or text. Handles several meals in one sentence, brands, and portions of cooked batches. Review and edit in a confirmation table before saving |
| **Meal Plan** | Plan today or future days in one sentence, whole-day macro and micro profile, cooked-batch stock with portion tracking |
| **Calendar** | Monthly grid coloured by your GYR rating, with per-day editing |
| **Insights** | Trend charts with data-driven axes, GitHub-style GYR and nibbles heatmaps |
| **Nutrient breakdown** | Full macro and micronutrient profile versus recommended daily amounts, with collapsible "doing well / can improve / needs work" insights |
| **Weight and BMI** | Weight history, goal line, BMI progress chart |
| **Settings** | Profile (DOB, height, weight, activity), live BMI, BMR (Mifflin-St Jeor) and TDEE, light/dark theme |
| **Recipes and Guide** | Fully editable modules, items and FAQs: add, rename and delete anything |
| **Sync** | Google sign-in; all data, including unsubmitted drafts, syncs across devices |

## Architecture

```
Browser (Next.js App Router, React 18)
 ├─ Zustand stores ── persisted to localStorage (guest mode / offline cache)
 │        └─ debounced sync ──► Supabase Postgres (RLS: each user sees only their rows)
 ├─ Web Speech API ──► transcript
 └─ /api/parse-food (server route) ──► Gemini  (API key never reaches the client)
```

Key design decisions:

- **Local-first.** State lives in Zustand and is persisted locally, so the app works instantly and as a guest. Signing in adds cloud sync rather than gating features.
- **Draft sync.** The current day's form is pushed to a `daily_drafts` table (debounced) and pulled on a timer and on tab focus. Conflicts resolve last-write-wins by `updatedAt`. Submitting writes the final record.
- **Security by default.** Row Level Security on every table; the Gemini key is used only in a server route.
- **Resilient AI calls.** The parse route tries a primary Gemini model and falls back to others, with retry on 429/503, and returns validated JSON.
- **Derived, not stored.** Age, BMI, BMR, TDEE and targets are computed from the profile so they update instantly everywhere.

## Tech stack

| Tool | Why |
| --- | --- |
| Next.js 14 (App Router) + TypeScript | Server routes for the AI proxy, type safety across the data model |
| Tailwind CSS | Design tokens through CSS variables give light/dark theming with little code |
| Framer Motion | Smooth transitions and micro-interactions |
| Recharts | Composable, responsive charts |
| Zustand | Small, fast state with built-in persistence |
| Supabase | Postgres, Google OAuth and RLS without running a backend |
| Google Gemini | Natural-language to structured nutrition JSON |
| Lucide | Consistent icon set |

## Getting started

```bash
git clone https://github.com/ajayreddytech/TheFoodRelationship.git
cd TheFoodRelationship
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Google AI Studio key (server-side only) |
| `GEMINI_MODEL` | Primary model, e.g. `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODELS` | Comma-separated fallbacks |

Without Supabase the app runs as a guest and stores data in the browser.

### Supabase setup

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. Enable the Google provider under Authentication → Providers.
3. Under Authentication → URL Configuration, set the Site URL to your deployed URL and add it plus `http://localhost:3000/` as redirect URLs.

### Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run typecheck` | Type-check the project |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

## Deployment

Connect the repo to Netlify (config in `netlify.toml`) and add the environment variables above.

## Project structure

```
src/
 ├─ app/            routes, layout, API route (parse-food)
 ├─ components/     views (Log, Plan, Calendar, Insights...), shared UI
 └─ lib/            stores, Supabase client, calculations, nutrient data
supabase/schema.sql database schema and RLS policies
```

## Roadmap

- Realtime sync via Supabase channels instead of polling
- Barcode scanning
- Data export (CSV)
- Installable PWA

## Disclaimer

Nutrition values are AI estimates and the app is not medical advice.
