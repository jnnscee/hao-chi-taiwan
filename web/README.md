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
  per-place numbers that are purely positional — a place's number is
  its 1-based place in the currently displayed (filtered + sorted)
  list, renumbering with every tab, search, filter and sort — shown as
  quiet faded text ending the card's meta line and the compact row's
  food line ("No. 12" / 「第 12 家」), never as a badge; a live result
  count and Clear all.
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
  badges, cuisine, area, both addresses, the Google rating (worn as a
  small tag chip beside a cuisine chip, as in v1 — the same chip row
  cards carry under their meta line, and compact rows carry at their
  right), hours
  with the note, "Last checked" month and a "Check today's hours" link,
  phone / website / Instagram / Facebook links when present, and a
  "Good to know" block (visitor notes, cash-only) that appears only here,
  never on cards. Actions: Open in Google Maps (with the Save hint),
  Get directions, Show driver (full-screen large Chinese name + address),
  Save (device-local, `hao-chi-saved-v1` — the old app's heart:
  a heart toggle on every card and row and in the details, with a
  "Saved" marker on the list), Share (Web Share or copy the place's own page URL — see
  **Real web addresses**), Add to calendar
  (1-hour Google Calendar template, Asia/Taipei) and a quiet
  "Report a problem with this place" button that opens the contact
  form pre-filled for the place. The dialog closes via
  its ✕ or Escape and leaves the list state untouched.
- A **real interactive map** (`app/PlaceMap.tsx`, Leaflet with
  OpenStreetMap tiles, loaded client-side only) sits below the
  list (the old site's order), headed by the live app's own map strings
  ("Where they are" / 「地圖」 and its tap-a-pin hint, in `lib/i18n.ts`).
  It draws exactly the current filtered set: numbered pins (number =
  the place's list number) at 60 or fewer results; above that, places
  group into cluster badges carrying their count (an ungrouped place
  keeps its plain dot), regrouping as the visitor zooms and expanding
  on tap — badge counts plus dots always add up to the set's size, so
  the 242 baseline is verifiable on screen. Every individual marker
  is clickable to open that place's details. The view fits the set's
  frame (56px padding so no pin or badge touches the edge; fit zoom
  capped at 15; an empty set frames the whole of Taiwan) only when
  the set itself changes — panning or zooming and then toggling
  Cards/Compact keeps the visitor's view. Wheel/drag/pinch zoom runs
  to street level. The marker and clustering logic is pure functions
  in `lib/map.ts`, unit-checked against the real data. (Phase A map
  legibility, 2026-11-23: padded fit, clustering, Taiwan framing for
  no-match searches, rapid-zoom tile hardening, and re-measuring the
  map once the page settles and whenever it scrolls into view, so no
  grey unpainted strips survive first paint.)
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
  搜尋與篩選") in v1's dark-theme teal (`#57c8b2`) with a near-black
  magnifier, whose badge shows the result count whenever the set is
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
  (https://hao-chi-taiwan.vercel.app/og-image.jpg) — point it at
  this app's own domain at launch. The hero photo itself is
  self-hosted (`/banner.jpg`, service-worker precached) since
  2026-11-23: the cross-origin copy was never cached, so cold
  home-screen launches often missed it.
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

The site wears a single **night theme** (all in
`app/globals.css`, CSS variables at the top — several token names
are fossils from the earlier light scheme; `--cream`, for
instance, now holds the dark ground, as the stylesheet's header
comment records). An earlier design-polish slice first built a
light Taiwan palette (cream, sand, brown, mountain green, ocean
blue); Jenny then asked for the banner to fade into a night
colour with no cream at all — "my first version has a black
background" — so the whole app converted to the old app's own
dark tokens: page ground `#131715`, surfaces `#1d2320`, raised
chips/inputs `#232a26`, ink `#f0ede3`, muted `#a9b3a6`, lines
`#39413c`. Headings and brand are gold (`#e0b95e` / `#c98f1b`;
the old brand brown is illegible on near-black). The green
`#2f6f4e` and blue `#1f6f96` fills survive from the Taiwan
palette (primary and travel actions), with lighter text variants
on dark (`#6fd3a7` / `#7cc7ea`); red is alerts and the saved
heart. The hero is the old site's banner photo (self-hosted at
`/banner.jpg`) with the
title and counts on the photo, its bottom edge fading directly
into the dark page — no band, no cream. On phones the hero runs
full-bleed to the screen edges and the title scales with the
screen (`clamp(1.45rem, 6.6vw, 1.9rem)`, never wrapping). The
Show driver card deliberately stays black-on-white. The PWA
theme/background colour is the night ground `#131715`. All
colour pairings pass WCAG AA. Because the banner photo loads
from the guide's main Vercel address, the Privacy page's Vercel
bullet says so, in both languages (adaptation 7 in
`lib/pages.ts`).

Details Jenny directed along the way: list numbers are quiet
positional text ending the card meta line and the compact food
line ("· No. 12" / 「· 第 12 家」), renumbering with every view
and shared with the map pins — never a badge, never beside the
Save heart; the Google rating is worn as a tag chip beside a
cuisine chip (cards, details, and compact rows — in rows the
chip sits on its own line under the food line, after a
phone-width crush taught us it cannot share the names line);
the floating search button wears the old app's teal `#57c8b2`
with a near-black magnifier (hover `#3da892`) and its red count
badge. The language toggle's twin-path helper (`lib/routes.ts`)
normalises the client router's "/index" name for the root
route, which had once pointed the English home's toggle at a
404; the old app's heart is the Save control everywhere (and
the Privacy text's "(the heart)" / 「（愛心）」 with it —
adaptation 5 in `lib/pages.ts`).

## Run it

```bash
npm install
npm run build
npm start
```

## Tests

Two suites, both added by the engineering-backbone slice
(2026-11-22):

- **Logic tests (Vitest)** — `npm test`. Sixty-three tests in
  `tests/` over the pure lib modules (`places`, `map`, `i18n`,
  `routes`, `details`, `contact`), run against
  `tests/fixtures/places.json`: a snapshot of all 242 places
  exported from the Supabase `places` table in the shape
  `lib/data.ts` produces. They pin the invariants the slices
  originally proved by hand — search/filter counts (noodle 14,
  Zuoying 93, Kaohsiung 196, Hot pot 4), positional numbering,
  pin numbers agreeing with list numbers, Near me radius counts
  from Zuoying HSR, zero-miss Chinese labels, twin paths,
  contact-form composition. The fixture is a snapshot on
  purpose (CI has no database credentials): **refresh it in the
  same commit whenever a bulk data change lands**; single edits
  Jenny makes through /admin change the database only and never
  touch the repo, so the counts describe the snapshot.
- **Browser tests (Playwright)** —
  `npm run test:e2e` (needs `npx playwright install chromium`
  once, and a production build first; the config serves
  `npm start` on port 3100). Two specs in `tests-e2e/`: a
  phone-width layout spec at 390px and 360px viewports asserting
  the compact rows keep their width, the hero title stays on one
  line, nothing overflows horizontally, and the rating chip sits
  below the food line — the regression Jenny's 2026-11-22
  screenshot caught, which a desktop check structurally cannot
  see — and a map legibility spec (desktop viewport) asserting a
  filtered set's pins sit fully inside the frame, the cluster
  counts plus dots sum to 242 and a cluster tap zooms in, a
  no-match search leaves the map framed on Taiwan, and four rapid
  zoom-ins never leave the map blank. The map spec stubs the
  OpenStreetMap tile endpoint with a locally drawn PNG (the
  sandbox/CI cannot reliably reach the real tile service, and
  its usage policy discourages test traffic anyway) and blocks
  the service worker, whose cache-first tile serving would
  otherwise bypass the stub nondeterministically.

## CI

`.github/workflows/ci.yml` (repo root) runs on pushes to
`staging` and `main` touching `web/**`: Node 22, `npm ci`,
`npm test`, `npm run build`, the budget check below, then the
Playwright install and layout spec — the same gates as locally,
so a red push is never promoted. (The workflow file itself was
authored in the backbone slice but could not be pushed by the
GitHub snapshot tool — workflow files need a scope the token
does not hold, so that push was rejected with a 403. It was
then added on `staging` through the GitHub web UI (commit
7af0eab, 2026-11-22) and CI run #1 succeeded with all four
gates green; the proposed copy is preserved at
`hidden_files/ci-workflow-proposed-2026-11-22.yml` in the goal
workspace.)

## Performance budget

`npm run check-budget` (after a build) sums the gzipped size of
the home page's First Load JS from the build manifest and fails
over **160 kB**. Measured when the budget was set (2026-11-22):
129.4 kB — the cap is that measurement plus ~25% headroom, so a
change that quietly makes the home page a quarter heavier fails
in CI instead of reaching a visitor's phone.


## Not yet

Admin login is done (see above), and public sign-ups were
disabled in the Supabase dashboard on 2026-11-22. The login
email shows only the magic link, not a 6-digit code: on
Supabase's free plan the email template cannot be edited
(that needs custom SMTP or a paid plan), so the code box in
the login form stays unused unless the plan changes — the
working flow is to tap the link in the email.
`app/InfoOverlay.tsx` is a retired stub (the info overlays were
replaced by real pages); it stays only because the GitHub snapshot
push cannot delete files.
