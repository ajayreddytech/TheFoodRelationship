# TheFoodRelationship

Track calories, nutrients, hydration, weight and intermittent fasting, with AI meal parsing (voice or text).

**Live:** http://thefoodrelationship.netlify.app/

Built with Next.js (App Router), TypeScript, Tailwind, Framer Motion, Recharts, Zustand, Supabase and Gemini.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Google AI Studio key (server-side only) |
| `GEMINI_MODEL` | Optional, e.g. `gemini-3.1-flash-lite` |

Without Supabase the app runs as a guest and stores data in the browser.

## Supabase

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. Enable the Google provider under Authentication → Providers.
3. Under Authentication → URL Configuration, set the Site URL to the launch link and add both `http://thefoodrelationship.netlify.app/` and `http://localhost:3000/` as redirect URLs.

## Deploy (Netlify)

Connect the GitHub repo; Netlify detects Next.js (see `netlify.toml`). Add the environment variables above in Site settings.
