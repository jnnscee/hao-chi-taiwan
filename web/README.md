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
- An **EN / 中文 language toggle** in the header switches the whole
  chrome — hero stats, tabs, search, filter/sort labels, result and
  batch counts, Cards/Compact, the details dialog and the driver card.
  All wording comes from `lib/i18n.ts`, lifted verbatim from the live
  app's own string table, including its district (33), cuisine (86) and
  city label tables: in Chinese mode the District and Cuisine dropdowns
  show the Chinese labels while option values and filtering are
  unchanged. The choice persists in localStorage under
  `hao-chi-lang-v1`; a `?lang=zh` / `?lang=en` URL parameter wins over
  the stored choice for that visit, switching the toggle rewrites the
  URL parameter in place (keeping any `?place=`), and Share links carry
  the current language. Place names keep the Chinese heading with the
  English sub-line in both languages.
- Clicking or tapping any card or row opens the details dialog
  (`app/PlaceDetails.tsx`): names and gloss, temporarily-closed and list
  badges, cuisine, area, both addresses, the muted Google rating, hours
  with the note, "Last checked" month and a "Check today's hours" link,
  phone / website / Instagram / Facebook links when present, and a
  "Good to know" block (visitor notes, cash-only) that appears only here,
  never on cards. Actions: Open in Google Maps (with the Save hint),
  Get directions, Show driver (full-screen large Chinese name + address),
  Save (device-local, `hao-chi-saved-v1`, with a "Saved" marker on the
  list), Share (Web Share or copy the `?place=<legacy_id>` deep link —
  opening such a link opens that place's details), Add to calendar
  (1-hour Google Calendar template, Asia/Taipei) and a quiet
  "Report a problem with this place" mailto link. The dialog closes via
  its ✕ or Escape and leaves the list state untouched.
- The filtering/sorting/numbering logic lives in `lib/places.ts` and the
  details link/saved-set logic in `lib/details.ts`, both as pure
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

No map, Near me, contact form, place pages, admin login or PWA — those
are the later Phase 2 steps. There is also no `/zh/` route yet; the
language lives in state + the `?lang=` parameter for now.
