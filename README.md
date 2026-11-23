<div align="center">

<img src="public/logo.png" alt="TheFoodRelationship logo" width="120" />

# TheFoodRelationship

**Log what you eat by speaking it. See how food, fasting, hydration and weight affect how you feel.**

[Live demo](http://thefoodrelationship.netlify.app/) · [Report a bug](https://github.com/ajayreddytech/TheFoodRelationship/issues)

![Next.js](https://img.shields.io/badge/Next.js_14-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)

</div>

## The problem

Food tracking fails because it is tedious. Searching a database, picking servings and logging every ingredient is why most people quit within weeks.

## The solution

Say it, and it is logged. *"Dinner was 200g grilled chicken and a cup of quinoa"* becomes calories, macros and micronutrients. You confirm the result before anything is saved.

It also connects food to how you feel. Fasting windows, hydration, a daily mood rating and weight appear on one timeline, so patterns are visible.

## Who it is for

- **People managing weight, fasting or nutrition** who want accurate tracking without the typing.
- **Anyone who finds current trackers too slow** to keep using.

## Why it is different

- **Voice-first logging.** Several meals in one sentence, brand names, and portions of home-cooked batches.
- **A review step before saving.** Estimates are shown in an editable table, so the user stays in control.
- **Mood, food and body in one view.** Calendar, insights and heatmaps show the relationship over time.
- **Works offline and as a guest.** Sign-in adds sync across devices; it never gates features.
- **Resilient AI.** If the primary model is busy, the app falls back to other models and queues meals to retry later.
- **Private by design.** Row-level security on every table; AI keys never reach the browser.

## Features

| Area | What you get |
| --- | --- |
| **Log** | Meal buckets, eating window, fasting clock, hydration, daily mood rating, live calorie targets |
| **AI parsing** | Voice or text, with a confirmation table before saving |
| **Meal plan** | Plan future days in a sentence; whole-day nutrient profile |
| **Insights** | Trend charts, calendar and heatmaps coloured by mood |
| **Nutrients** | Macro and micronutrient profile against recommended daily amounts |
| **Weight and BMI** | History, goal line and progress |
| **Sync** | Google sign-in; data syncs across devices |

## Built with

Next.js 14 and TypeScript, Tailwind CSS, Zustand, Supabase (Postgres, Google auth, RLS), Google Gemini with OpenAI as backup.

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
| `GEMINI_MODEL` | Primary Gemini model |
| `OPENAI_API_KEY` | Backup AI key, used when Gemini fails twice (server-side only) |
| `OPENAI_MODEL` | Optional backup chat model (default `gpt-6-luna`) |
| `OPENAI_TRANSCRIBE_MODEL` | Optional voice transcription model (default `gpt-transcribe`) |

Without Supabase, the app runs as a guest and stores data in the browser.

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

## Deployment

Connect the repo to Netlify (config in `netlify.toml`) and add the environment variables above.

## Roadmap

- Realtime sync instead of polling
- Barcode scanning
- CSV export
- Installable PWA

## Disclaimer

Nutrition values are AI estimates. This app is not medical advice.
