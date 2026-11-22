# Hao Chi Taiwan — Phase 2 rebuild

This `web/` directory holds the Next.js rebuild of Hao Chi Taiwan
(App Router, TypeScript, plain CSS). It lives alongside the current static
site in this repo and does not replace it yet — the live site keeps being
served from the repo root until the rebuild is ready to take over.

## What it does

- `app/page.tsx` is a server component that fetches every row from the
  Supabase `places` table and hands the full set to `app/PlaceBrowser.tsx`,
  a client component with the list controls, mirroring the live app:
  All / Recommended / Want to Try tabs with counts; search across names,
  gloss, cuisine, city, district and addresses; City, District and Cuisine
  dropdowns (options derived from the data, cuisine labels as stored);
  sort by Recommended order (Recommended in Jenny's list order, then Want
  to Try A–Z), Name A–Z or Highest Google rating; Cards (10 at a time) /
  Compact (15) views with Show more, the view choice persisted in
  localStorage under `hao-chi-view-v1` with Compact as the phone default;
  per-place numbers (legacy numbers for Recommended, 1..N in displayed
  order for Want to Try); a live result count and Clear all.
- The filtering/sorting/numbering logic lives in `lib/places.ts` as pure
  functions, unit-checked against the real data.
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

No place details, language toggle, map, Save/Share, Show driver, Near me,
place pages, admin login or PWA — those are the later Phase 2 steps.
