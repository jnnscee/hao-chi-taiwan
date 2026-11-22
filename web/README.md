# Hao Chi Taiwan — Phase 2 rebuild (skeleton)

This `web/` directory holds the Next.js rebuild of Hao Chi Taiwan
(App Router, TypeScript, plain CSS). It lives alongside the current static
site in this repo and does not replace it yet — the live site keeps being
served from the repo root until the rebuild is ready to take over.

## What the skeleton does

- `app/page.tsx` is a server component that fetches every row from the
  Supabase `places` table and renders the two lists in the live app's
  arrangement: Recommended in Jenny's list order, Want to Try A–Z, with the
  Chinese name as the heading, the English name as the sub-line and the
  gloss beneath.
- Data comes from the Supabase project `hao-chi-taiwan` via
  `lib/supabase.ts`, using only the publishable (anon) key. Row Level
  Security guards the data: `places` is read-only for the public and
  `place_internal` is never touched by this app.
- The committed `.env` holds `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both are public values by design;
  no secret or service-role key must ever be added here.

## Run it

```bash
npm install
npm run build
npm start
```

## Not yet

No search, filters, map, place pages, admin login or PWA — those are the
later Phase 2 steps.
