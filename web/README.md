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
  unchanged. Language lives in the path (see **Real web addresses**
  below): the toggle navigates between a page's two language twins
  and records the choice in localStorage under `hao-chi-lang-v1`.
  On the English home page only, a `?lang=zh` / `?lang=en` URL
  parameter still wins over the stored choice for that visit (the
  old share-link form), without overwriting it. Place names keep
  the Chinese heading with the English sub-line in both languages.
- Clicking or tapping any card or row opens the details dialog
  (`app/PlaceDetails.tsx`): names and gloss, temporarily-closed and list
  badges, cuisine, area, both addresses, the muted Google rating, hours
  with the note, "Last checked" month and a "Check today's hours" link,
  phone / website / Instagram / Facebook links when present, and a
  "Good to know" block (visitor notes, cash-only) that appears only here,
  never on cards. Actions: Open in Google Maps (with the Save hint),
  Get directions, Show driver (full-screen large Chinese name + address),
  Save (device-local, `hao-chi-saved-v1`, with a "Saved" marker on the
  list), Share (Web Share or copy the place's own page URL — see
  **Real web addresses**), Add to calendar
  (1-hour Google Calendar template, Asia/Taipei) and a quiet
  "Report a problem with this place" button that opens the contact
  form pre-filled for the place. The dialog closes via
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
- **Jenny's floating search button**, as on the live app: a circular
  button fixed bottom-right (bilingual aria-label "Search & filters /
  搜尋與篩選") whose badge shows the result count whenever the set is
  narrowed below the current tab's full set. On desktop it appears
  only once the in-page search area has scrolled off screen; on phone
  (≤640px) it is always visible and the in-page search area leaves the
  page flow entirely — the list starts under the hero with the result
  count and a small toolbar carrying the Cards/Compact and EN/中文
  toggles. Tapping the button opens a panel holding the same controls
  bound to the same state (tabs, search, dropdowns, sort, view, Near
  me), so nothing resets on open/close. The panel closes ONLY via its
  ✕ — scrolling, backdrop taps and Escape do not dismiss it. Clear all
  inside the panel resets everything without closing it; if Clear all
  was pressed during a panel session, closing scrolls the page back
  to the search area (on phone, the result-count line) and the panel
  reopens at its top next time — otherwise closing changes no scroll
  position and the panel reopens where it was left. The badge and
  close rules are pure functions in `lib/floating.ts`, unit-checked.
- **Real web addresses** (`lib/routes.ts`): every place has its own
  page — `/place/<legacy_id>` and `/zh/place/<legacy_id>`, statically
  generated for all 242 places × 2 languages (unknown ids get a
  proper bilingual 404) — rendering the same details and actions as
  the dialog (one shared `app/PlaceDetailView.tsx`), plus the site
  header and a back-to-the-list link. About / Privacy / Terms /
  Contact are real routes too (`/about`, `/privacy`, `/terms`,
  `/contact` and their `/zh/` twins): the footer links and the info
  pages' cross-links navigate to them, and the About/Privacy/Terms
  overlays are retired. `/zh/` is the home page in Chinese — the
  path is authoritative for language on every `/zh/` page and
  records Chinese as the stored preference; `/` keeps its
  `?lang=` → stored → English resolution. One `placeUrl` helper
  produces the language-matched place-page URL used by Share, the
  calendar event's "View in Hao Chi Taiwan" line and the contact
  form's "Place page:" line; the home pages still honour the old
  `?place=<legacy_id>` links by opening that place's dialog.
  Metadata (share previews) is per page: the home pages carry the
  live site's two established variants verbatim (EN on `/`, ZH on
  `/zh/`), place pages get their names as title and gloss · cuisine
  · location as description, and the info pages get plain summary
  descriptions. `og:image` everywhere is the default banner, for now
  referenced at the live site's absolute URL
  (https://hao-chi-taiwan.vercel.app/og-image.jpg) because the
  GitHub snapshot push cannot carry the binary — self-host it at
  launch.
- A **Contact & feedback** section and footer close the page, as on
  the live app. The footer's About · Privacy · Terms · Contact &
  feedback links navigate to the real routes above. The three info
  pages carry the live
  app's own bilingual texts (`lib/pages.ts`; the Privacy text is
  minimally adapted to stay true of the rebuild — no Google Fonts is
  loaded, there is no offline copy yet, the language choice is also
  stored on the device, directions never reads the visitor's
  location, and Vercel's basic server logs are noted), cross-linked
  to each other and to the form. The one contact form
  (`app/ContactForm.tsx`) — also the body of the `/contact` page —
  composes an email in the visitor's own app
  — it sends nothing itself: category (Feedback / Report a problem /
  Suggest a place / Other), optional place, name and reply email,
  and a required message, with "Open in email app" (mailto) and
  "Open in Gmail" (the Gmail app scheme on phones, a pre-filled web
  compose in a new tab on desktop) as real anchors whose hrefs are
  composed live from the fields, plus a Copy message fallback — all
  addressed to the single `CONTACT_EMAIL` constant
  (haochitaiwan@muse.ai). A place's "Report a problem with this
  place" in its details opens the same form pre-filled (category,
  the place field, and its deep link + Maps link in the composed
  body). The composition logic is pure functions in `lib/contact.ts`,
  unit-checked.
- The filtering/sorting/numbering logic lives in `lib/places.ts` and the
  details link/saved-set logic in `lib/details.ts`, both as pure
  functions, unit-checked against the real data.
- Data comes from the Supabase project `hao-chi-taiwan` via
  `lib/supabase.ts`, using only the publishable (anon) key. Row Level
  Security guards the data: `places` is read-only for the public,
  and `place_internal` (Jenny's working notes) is readable only
  inside her admin session.
- Admin: `/admin` is Jenny's place manager (English only — her own
  tool). Sign-in is passwordless email code (Supabase Auth
  `signInWithOtp` + `verifyOtp`); the app never creates accounts
  (`shouldCreateUser: false`) and the single admin user lives in
  Supabase Auth. The emailed message also carries a sign-in link
  that lands back on `/admin`. Only `jnnscee@gmail.com` gets the
  manager — any other signed-in account sees "not authorized" and
  no data — and the database enforces the same rule: the
  `admin_jenny_write_policies` migration gives that email, and
  only that email, INSERT/UPDATE/DELETE on `places` and full
  access to `place_internal`. From the manager Jenny can add,
  edit and delete places (delete needs the place's Chinese name
  typed back) and keep the `place_internal` working notes beside
  each place. The form<->row mapping lives in `lib/admin.ts`,
  unit-checked. Public freshness after a save is ISR: `/`, `/zh/`
  and the place pages revalidate every 60 s (and `lib/data.ts`
  caches its fetch for 30 s), so an edit shows up on the public
  pages within about a minute with no redeploy; a brand-new
  place's page renders on its first visit. The only public trace
  of all this is a discreet "Admin" link in the footer.
- The committed `.env` holds `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both are public values by design;
  no secret or service-role key must ever be added here.
- Offline / installable (PWA): a hand-written service worker
  (`public/sw.js`, registered in production by
  `app/ServiceWorkerRegister.tsx`) precaches the home, info and
  contact pages in both languages, then serves pages
  network-first (so ISR freshness still wins online) with the
  cache as the offline fallback and `public/offline.html` for
  never-visited pages. Static assets are stale-while-revalidate;
  OpenStreetMap tiles are cache-first in a ~200-entry capped
  cache. `/admin`, Supabase requests and non-GET requests are
  never cached. The manifest (`app/manifest.ts`) and the icons
  (generated routes — `app/icon.tsx`, `app/apple-icon.tsx`,
  `app/icons/[name]/route.ts` — no binary files) make the guide
  installable, and the footer's "Add to Home Screen" entry
  (`app/InstallButton.tsx`, wording in `lib/install.ts` lifted
  from the live app) fires the browser's install prompt where
  one exists and otherwise shows the steps for the device. With
  a real offline copy again, the Privacy page's offline-copy
  bullet — removed when it wasn't true — is restored.

## Design

The design-polish slice gave the site its finished look (all in
`app/globals.css`, CSS variables at the top): Jenny's palette of
Taiwan — cream `#fffdf8` base and sand `#f0ead9` (kept), brown
`#7a4a12` for headings/brand/the list badge, mountain green
`#2f6f4e` for primary actions and active states, ocean blue
`#1f6f96` for links and travel actions, red `#a33b2e` for
semantic alerts only. The home hero is the old site's signature
banner photo (the `OG_IMAGE_URL` banner at its interim absolute
URL) over a deep green→blue "mountains → sea" gradient band,
which also closes the footer and rules the standalone-page
headers; cards borrow the old site's white-surface / hairline /
soft-shadow treatment. All colour pairings pass WCAG AA (white
on green 5.99:1, on blue 5.57:1, on deep green 9.25:1). No
behaviour changed. Because the banner photo now loads from the
guide's main Vercel address, the Privacy page's Vercel bullet
says so, in both languages (adaptation 7 in `lib/pages.ts`).

## Run it

```bash
npm install
npm run build
npm start
```

## Not yet

Admin login is done (see above); two Auth settings live only in the Supabase
dashboard and are still Jenny's to flip there: disabling public
sign-ups, and adding the 6-digit code (`{{ .Token }}`) to the
Magic Link email template so the login email shows the code as
well as the link.
`app/InfoOverlay.tsx` is a retired stub (the info overlays were
replaced by real pages); it stays only because the GitHub snapshot
push cannot delete files.
