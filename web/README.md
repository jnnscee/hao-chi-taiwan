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
- A **real interactive map** (`app/PlaceMap.tsx`, Leaflet with
  OpenStreetMap tiles, loaded client-side only) sits between the
  controls and the list, headed by the live app's own map strings
  ("Where they are" / 「地圖」 and its tap-a-pin hint, in `lib/i18n.ts`).
  It draws exactly the current filtered set: numbered pins (number =
  the place's list number) at 60 or fewer results, small dot markers
  above that, every marker clickable to open that place's details. The
  view fits the set's bounds (fit zoom capped at 15) only when the set
  itself changes — panning or zooming and then toggling Cards/Compact
  keeps the visitor's view. Wheel/drag/pinch zoom runs to street
  level. The marker logic is pure functions in `lib/map.ts`,
  unit-checked against the real data.
- **Near me**, mirroring the live app: the Near me button asks for the
  visitor's location only when tapped (`navigator.geolocation`, the
  live app's options). The position is held in memory (filter state)
  only — never written to localStorage, never sent anywhere — and is
  dropped by "Clear location" or Clear all. While on, a "Within"
  range select (1 / 3 / 5 / 10 / 25 km or Any distance, default 5 km)
  filters the set by haversine distance on top of the tab/search/
  dropdown filters, the sort switches to Nearest, and every card and
  row shows a distance tag ("850 m" / "1.2 km" — the live format);
  the details dialog gains a "Distance from you" fact row. A status
  line under the controls carries the live app's own strings (privacy
  hint at rest, "Found N places within R km of you — nearest first."
  while on, its message when none are in range, and its denied /
  unavailable / timeout / unsupported / offline errors). Choosing
  "Nearest" in the Sort dropdown without a known location asks for
  the location for sorting only (the radius filter stays off), as the
  live app does; a failure restores Recommended order. On the map, a
  blue "you are here" dot marks the visitor, and while Near me
  filters by a real range the fitted bounds include the visitor's
  position alongside the nearby set. All distance/range logic is
  pure functions in `lib/places.ts` (with the fit logic in
  `lib/map.ts`), unit-checked against the real data from a Zuoying
  reference point.
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

No contact form, place pages, admin login or PWA — those are the
later Phase 2 steps. There is also no `/zh/` route yet; the
language lives in state + the `?lang=` parameter for now.
