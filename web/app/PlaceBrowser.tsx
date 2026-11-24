"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  assignDisplayNumbers,
  batchFor,
  distinctValues,
  filterAndSortPlaces,
  formatDist,
  glossFor,
  placeDistanceKm,
  ANY_DISTANCE_KM,
  DEFAULT_FILTERS,
  NEAR_RADIUS_OPTIONS,
  type ListFilters,
  type Place,
  type SortKey,
  type TabKey,
  type ViewKey,
} from "@/lib/places";
import { buildMapMarkers } from "@/lib/map";
import {
  badgeCountFor,
  planPanelClose,
  sessionClearedOnClearAll,
} from "@/lib/floating";
import {
  CONTACT_EMAIL,
  SAVED_STORAGE_KEY,
  parseSavedIds,
  placeIdFromSearch,
  toggleSavedId,
} from "@/lib/details";
import type { ContactCategoryKey } from "@/lib/contact";
import {
  LANG_STORAGE_KEY,
  STRINGS,
  cityLabel,
  cuisineLabel,
  districtLabel,
  langFromSearch,
  parseStoredLang,
  type Lang,
} from "@/lib/i18n";
import PlaceDetails from "./PlaceDetails";
import ContactForm, { type ContactOpenRequest } from "./ContactForm";
import LangSwitch from "./LangSwitch";
import SiteFooter from "./SiteFooter";

// The interactive map is client-only: Leaflet needs `window`, so it is
// dynamically imported with ssr:false and hydrates after the static
// prerender. The placeholder keeps the section's height while it loads.
const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => <div className="place-map" aria-hidden="true" />,
});

const VIEW_STORAGE_KEY = "hao-chi-view-v1"; // same key as the live app

const TAB_KEYS: TabKey[] = ["all", "recommended", "want_to_try"];

/** Near me status errors, as keys into the i18n string table. */
type NearErrorKey =
  | "near_error_denied"
  | "near_error_unavail"
  | "near_error_timeout"
  | "near_error_unsupported"
  | "offline_near";

/** The live app's geolocation options, unchanged. */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 60000,
};

function geoErrorKey(err: GeolocationPositionError): NearErrorKey {
  if (err.code === 1) return "near_error_denied"; // permission denied
  if (err.code === 3) return "near_error_timeout";
  return "near_error_unavail";
}

/** Why Near me can't start at all, or null when it can. Live app's order. */
function locateBlocker(): NearErrorKey | null {
  if (!navigator.onLine) return "offline_near";
  if (!("geolocation" in navigator)) return "near_error_unsupported";
  return null;
}

export default function PlaceBrowser({
  places,
  routeLang,
}: {
  places: Place[];
  /** The language of the page this browser is mounted on: "zh" on
   *  /zh/ (authoritative — the page boots Chinese), "en" on /. */
  routeLang: Lang;
}) {
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  // UI language. On /zh/ the server render is already Chinese and
  // stays so; on / the server render is English and the ?lang= /
  // stored choice is applied on mount, as before.
  const [lang, setLang] = useState<Lang>(routeLang);
  const t = STRINGS[lang];
  // Server render and first paint use Cards; the saved/phone default is
  // applied on mount to avoid a hydration mismatch.
  const [view, setView] = useState<ViewKey>("cards");
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    batchFor("cards")
  );
  // Saved places (device-local, hao-chi-saved-v1) and the open details
  // dialog. Both start empty on the server render and fill in on mount.
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Near me transient state. The location itself lives in
  // filters.origin — React state only, never persisted or sent
  // anywhere (the live app's privacy promise). These three cover the
  // in-flight requests and the last error; the status line is derived.
  const [locating, setLocating] = useState(false);
  const [sortLocating, setSortLocating] = useState(false);
  const [nearError, setNearError] = useState<NearErrorKey | null>(null);

  // Floating search button + panel (Jenny's design, as on the live
  // app). The panel is always mounted and renders the SAME controls
  // bound to the SAME state as the in-page set, so nothing resets on
  // open/close. panelCleared is per-session (reset on every open);
  // panelReopenAtTop carries the "reopen at the top" half across the
  // close → open gap; the sheet's scroll position is saved on close
  // and restored on open so it survives the panel being display:none.
  const [panelOpen, setPanelOpen] = useState(false);
  const [floatVisible, setFloatVisible] = useState(false);
  // The Contact & feedback form overlay. contactRequest carries
  // the prefill (category + reported place); its nonce bumps on
  // every open so the form re-applies the prefill even when
  // reopened for the same place. (About / Privacy / Terms are real
  // pages now — the footer links navigate to them.)
  const [contactRequest, setContactRequest] =
    useState<ContactOpenRequest | null>(null);
  const contactNonceRef = useRef(0);
  const panelClearedRef = useRef(false);
  const panelReopenAtTopRef = useRef(false);
  const savedSheetScrollRef = useRef(0);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const listTopRef = useRef<HTMLParagraphElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const panelSearchRef = useRef<HTMLInputElement | null>(null);

  // On mount: a saved Cards/Compact choice always wins; otherwise phones
  // (≤640px) default to Compact, matching the live app.
  useEffect(() => {
    let initial: ViewKey = "cards";
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "cards" || saved === "compact") {
        initial = saved;
      } else if (window.matchMedia("(max-width: 640px)").matches) {
        initial = "compact";
      }
    } catch {
      // storage unavailable: keep the Cards default
    }
    if (initial !== "cards") {
      setView(initial);
      setVisibleCount((count) => Math.max(count, batchFor(initial)));
    }
  }, []);

  // On mount: resolve the language. On /zh/ the path is
  // authoritative — the page booted Chinese (routeLang) and Chinese
  // is recorded as the stored preference. On / the existing
  // resolution applies: a ?lang= URL parameter wins over the stored
  // toggle choice (hao-chi-lang-v1), which wins over the English
  // default; the URL parameter applies to this visit only and does
  // not overwrite the stored choice.
  useEffect(() => {
    if (routeLang === "zh") {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, "zh");
      } catch {
        // storage unavailable: the page is still Chinese
      }
      return;
    }
    let initial: Lang = "en";
    try {
      initial =
        langFromSearch(window.location.search) ??
        parseStoredLang(window.localStorage.getItem(LANG_STORAGE_KEY)) ??
        "en";
    } catch {
      // storage/URL unavailable: keep the English default
    }
    if (initial !== "en") setLang(initial);
  }, [routeLang]);

  // Keep the html lang attribute in step with the toggle (the live app
  // uses zh-Hant for Chinese).
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);

  // On mount: load the saved set, and open the details dialog when the
  // URL carries a ?place=<legacy_id> deep link for a known place.
  useEffect(() => {
    try {
      setSavedIds(
        parseSavedIds(window.localStorage.getItem(SAVED_STORAGE_KEY))
      );
    } catch {
      // storage unavailable: no saved places
    }
    const linkedId = placeIdFromSearch(window.location.search);
    if (linkedId && places.some((p) => p.legacy_id === linkedId)) {
      setSelectedId(linkedId);
    }
  }, [places]);

  // Rewrite the URL in place when the details dialog opens/closes
  // (the ?place= deep-link form, kept for backwards compatibility —
  // opening such a link opens the dialog; see the mount effect).
  // The language no longer lives in the query string: it is the
  // path, and the toggle navigates (see LangSwitch).
  function syncUrl(place: string | null) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (place) params.set("place", place);
      else params.delete("place");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    } catch {
      // history unavailable: state still updates, the URL just won't
    }
  }

  function openDetails(place: Place) {
    setSelectedId(place.legacy_id);
    syncUrl(place.legacy_id);
  }

  function closeDetails() {
    setSelectedId(null);
    syncUrl(null);
  }

  // Open the one contact form overlay: generally (the contact
  // section — category Feedback, no place) or pre-filled from a
  // place's "Report a problem" (category Report a problem + place).
  // (The footer and info pages link to the /contact page instead.)
  function openContact(category: ContactCategoryKey, place: Place | null) {
    contactNonceRef.current += 1;
    setContactRequest({
      category,
      place,
      nonce: contactNonceRef.current,
    });
  }

  function toggleSave(place: Place) {
    setSavedIds((current) => {
      const next = toggleSavedId(current, place.legacy_id);
      try {
        window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: the choice just won't persist
      }
      return next;
    });
  }

  function chooseView(next: ViewKey) {
    setView(next);
    // Switching views keeps the places already shown.
    setVisibleCount((count) => Math.max(count, batchFor(next)));
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice just won't persist
    }
  }

  // Changing the tab, search, filters or sort starts the list over at the
  // current view's first batch.
  function updateFilters(patch: Partial<ListFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(batchFor(view));
  }

  function clearAll(fromPanel: boolean) {
    // A Clear all pressed while the panel is open marks this panel
    // session as cleared — the ✕ close then becomes a fresh start
    // (see planPanelClose). The in-page press never marks anything.
    if (fromPanel) {
      panelClearedRef.current = sessionClearedOnClearAll(
        panelOpen,
        panelClearedRef.current
      );
    }
    // DEFAULT_FILTERS carries no location, so Clear all also turns
    // Near me off and drops the visitor's position, as in the live app.
    setFilters(DEFAULT_FILTERS);
    setNearError(null);
    setVisibleCount(batchFor(view));
  }

  function openPanel() {
    if (panelOpen) return;
    panelClearedRef.current = false;
    setPanelOpen(true);
  }

  // Called ONLY from the panel's ✕ button — the panel has no other
  // close path (no backdrop tap, no Escape, no "See results").
  function closePanel() {
    if (!panelOpen) return;
    const plan = planPanelClose(panelClearedRef.current);
    panelClearedRef.current = false;
    if (plan.reopenAtTop) panelReopenAtTopRef.current = true;
    // Remember where the sheet was left, and blur anything focused
    // inside the panel before it hides, so the browser cannot yank
    // the page scroll toward a hidden input.
    savedSheetScrollRef.current = sheetRef.current?.scrollTop ?? 0;
    const ae = document.activeElement;
    if (
      ae instanceof HTMLElement &&
      panelRef.current?.contains(ae)
    ) {
      ae.blur();
    }
    setPanelOpen(false);
    if (plan.scrollOnClose) {
      // Fresh start: land back at the search area on desktop; on
      // phone there is no in-page search area in the flow, so land
      // on the result-count line above the results instead.
      const phone = window.matchMedia("(max-width: 640px)").matches;
      const target = phone
        ? listTopRef.current
        : (searchAreaRef.current ?? listTopRef.current);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Floating button visibility, mirroring the live app's
  // syncFloatBtn: hidden while the panel or the details dialog is
  // open; on phone (≤640px) otherwise always visible; on desktop
  // only once the in-page search area has scrolled fully off the
  // top of the screen (fallback: 700px of scroll, as there).
  useEffect(() => {
    function sync() {
      if (panelOpen || selectedId != null) {
        setFloatVisible(false);
        return;
      }
      if (window.matchMedia("(max-width: 640px)").matches) {
        setFloatVisible(true);
        return;
      }
      const el = searchAreaRef.current;
      const past = el
        ? el.getBoundingClientRect().bottom <= 4
        : window.scrollY > 700;
      setFloatVisible(past);
    }
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [panelOpen, selectedId]);

  // On panel open: restore the sheet's scroll position (or start at
  // the top when the previous session ended with Clear all + ✕),
  // then focus the panel's search box, as the live app does.
  useEffect(() => {
    if (!panelOpen) return;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.scrollTop = panelReopenAtTopRef.current
        ? 0
        : savedSheetScrollRef.current;
    }
    panelReopenAtTopRef.current = false;
    try {
      panelSearchRef.current?.focus({ preventScroll: true });
    } catch {
      // focus is a nicety, never required
    }
  }, [panelOpen]);

  // Near me: the location is requested ONLY on this tap, held in
  // filters.origin (memory only), and switching it on also selects
  // the Nearest sort, mirroring the live app.
  function startNearMe() {
    const blocked = locateBlocker();
    if (blocked) {
      setNearError(blocked);
      return;
    }
    setNearError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        updateFilters({
          origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          nearActive: true,
          sort: "nearest",
        });
      },
      (err) => {
        setLocating(false);
        setNearError(geoErrorKey(err));
      },
      GEO_OPTIONS
    );
  }

  // "Clear location": drops the position entirely. If the sort was
  // Nearest it falls back to Recommended order, as in the live app.
  function clearNear() {
    setNearError(null);
    setFilters((current) => ({
      ...current,
      origin: null,
      nearActive: false,
      sort: current.sort === "nearest" ? "recommended" : current.sort,
    }));
    setVisibleCount(batchFor(view));
  }

  function chooseSort(next: SortKey) {
    if (next !== "nearest" || filters.origin) {
      updateFilters({ sort: next });
      return;
    }
    // "Nearest" with no location yet: the live app asks for the
    // location for sorting only — Near me's radius filter stays off,
    // and a failure puts the sort back to Recommended order.
    const blocked = locateBlocker();
    if (blocked) {
      setNearError(blocked);
      return;
    }
    setNearError(null);
    updateFilters({ sort: "nearest" });
    setSortLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSortLocating(false);
        updateFilters({
          origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        setSortLocating(false);
        setNearError(geoErrorKey(err));
        setFilters((current) =>
          current.sort === "nearest"
            ? { ...current, sort: "recommended" }
            : current
        );
      },
      GEO_OPTIONS
    );
  }

  const tabCounts = useMemo(
    () => ({
      all: places.length,
      recommended: places.filter((p) => p.list_type === "recommended").length,
      want_to_try: places.filter((p) => p.list_type === "want_to_try").length,
    }),
    [places]
  );
  const kaohsiungCount = useMemo(
    () => places.filter((p) => p.city === "Kaohsiung").length,
    [places]
  );

  const cities = useMemo(() => distinctValues(places, "city"), [places]);
  const districts = useMemo(() => distinctValues(places, "district"), [places]);
  const cuisines = useMemo(() => distinctValues(places, "cuisine"), [places]);

  const displayed = useMemo(
    () => filterAndSortPlaces(places, filters, savedIds),
    [places, filters, savedIds]
  );
  const numbers = useMemo(
    () => assignDisplayNumbers(displayed),
    [displayed]
  );
  // Every place's distance from the visitor (null while no location is
  // known), for the card/row tags and the details dialog.
  const distances = useMemo(
    () =>
      new Map(
        places.map((place) => [
          place.legacy_id,
          placeDistanceKm(place, filters.origin),
        ])
      ),
    [places, filters.origin]
  );
  // The map draws exactly the displayed set, with the same numbers,
  // plus the visitor's own marker while a location is known. The
  // position joins the fitted bounds only while Near me filters by a
  // real range — see MapUserPoint in lib/map.ts.
  const markerSet = useMemo(
    () =>
      buildMapMarkers(
        displayed,
        numbers,
        filters.origin
          ? {
              ...filters.origin,
              fit: filters.nearActive && filters.radiusKm < ANY_DISTANCE_KM,
            }
          : null
      ),
    [displayed, numbers, filters.origin, filters.nearActive, filters.radiusKm]
  );

  // The Near me status line, derived the way the live app maintains
  // it: locating beats error beats the active found/none message,
  // and the privacy hint is the resting text.
  const nearStatus = locating
    ? { text: t.near_locating, mode: "" }
    : sortLocating
      ? { text: `${t.sort_need_loc} ${t.near_locating}`, mode: "" }
      : nearError
        ? { text: t[nearError], mode: "error" }
        : filters.nearActive
          ? displayed.length === 0 && filters.radiusKm < ANY_DISTANCE_KM
            ? { text: t.near_none(filters.radiusKm), mode: "on" }
            : {
                text: t.near_found(displayed.length, filters.radiusKm),
                mode: "on",
              }
          : { text: t.near_hint, mode: "" };
  const visible = displayed.slice(0, visibleCount);
  const hasMore = visibleCount < displayed.length;
  const selectedPlace =
    selectedId != null
      ? (places.find((p) => p.legacy_id === selectedId) ?? null)
      : null;

  const tabLabels: Record<TabKey, string> = {
    all: t.list_all,
    recommended: t.list_recommended,
    want_to_try: t.list_want,
  };

  function detailsLabel(place: Place): string {
    // Mirrors the live app's card aria-label: "Details: <name> — <gloss>".
    const food = glossFor(place, lang) ?? place.cuisine;
    return `${t.details}: ${place.name_zh}${food ? ` — ${food}` : ""}`;
  }

  function ratingText(place: Place): string {
    if (place.rating_value == null) return "";
    const base = `${t.google_rating} ${place.rating_value.toFixed(1)}`;
    return place.rating_count != null
      ? `${base} · ${place.rating_count.toLocaleString()} ${t.reviews_word}`
      : base;
  }

  function openOnKeyDown(place: Place) {
    return (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails(place);
      }
    };
  }

  // The floating button's badge: the result count while the set is
  // narrowed below the current tab's full set, hidden otherwise.
  // In the Saved view the comparison set is the tab's saved places
  // (v1's lastTabTotal applies the saved filter too), so merely
  // opening the Saved view shows no badge.
  const savedTabTotal = useMemo(
    () =>
      places.filter(
        (p) =>
          (filters.tab === "all" || p.list_type === filters.tab) &&
          savedIds.includes(p.legacy_id)
      ).length,
    [places, filters.tab, savedIds]
  );
  const badge = badgeCountFor(
    displayed.length,
    filters.savedOnly ? savedTabTotal : tabCounts[filters.tab]
  );

  function renderLangToggle() {
    // The toggle navigates between the path twins of the current
    // page now (LangSwitch); it no longer flips state in place.
    return <LangSwitch lang={lang} />;
  }

  // The old app's heart, carried over (Jenny's call): a circular
  // Save toggle on every card and compact row — outline ♡ until
  // saved, filled ♥ once it is, with the old app's red saved
  // treatment. Same hao-chi-saved-v1 behaviour as the details
  // Save (the one toggleSave); the accessible label is the
  // Save/Saved word plus the place's name, as on the old app. Its
  // clicks and keys stop here, so the entry's own open-details
  // handling never fires for them.
  function renderSaveHeart(place: Place) {
    const isSaved = savedIds.includes(place.legacy_id);
    return (
      <button
        type="button"
        className={isSaved ? "card-save is-saved" : "card-save"}
        aria-pressed={isSaved}
        aria-label={`${isSaved ? t.saved : t.save}: ${place.name_zh}`}
        title={isSaved ? t.saved : t.save}
        onClick={(event) => {
          event.stopPropagation();
          toggleSave(place);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {isSaved ? "♥" : "♡"}
      </button>
    );
  }

  function renderViewButtons() {
    return (
      <div className="toggle-buttons">
        <button
          type="button"
          className={view === "cards" ? "toggle active" : "toggle"}
          aria-pressed={view === "cards"}
          onClick={() => chooseView("cards")}
        >
          {t.view_cards}
        </button>
        <button
          type="button"
          className={view === "compact" ? "toggle active" : "toggle"}
          aria-pressed={view === "compact"}
          onClick={() => chooseView("compact")}
        >
          {t.view_compact}
        </button>
      </div>
    );
  }

  // The full search & filter control set: tabs, search box, the
  // City/District/Cuisine/Sort selects, the view toggle, the Saved
  // toggle and Near me.
  // Rendered twice — once in the page flow and once inside the
  // floating button's panel — both bound to the same state, exactly
  // as the live app's panel and in-page controls are two views of
  // one state. The panel copy omits the in-controls Clear all: the
  // panel's own actions row carries it, as on the live app.
  function renderControlSet(inPanel: boolean) {
    return (
      <>
        <div className="tabs" role="tablist" aria-label={t.list_label}>
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filters.tab === key}
              className={filters.tab === key ? "tab active" : "tab"}
              onClick={() => updateFilters({ tab: key })}
            >
              {tabLabels[key]} ({tabCounts[key]})
            </button>
          ))}
        </div>

        <div className="controls">
          <input
            type="search"
            className="search"
            placeholder={t.search_ph}
            aria-label={t.search_ph}
            value={filters.query}
            ref={inPanel ? panelSearchRef : undefined}
            onChange={(event) => updateFilters({ query: event.target.value })}
          />

          <label className="control">
            <span>{t.label_city}</span>
            <select
              value={filters.city}
              onChange={(event) => updateFilters({ city: event.target.value })}
            >
              <option value="">{t.all_cities}</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {cityLabel(lang, city)}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>{t.label_district}</span>
            <select
              value={filters.district}
              onChange={(event) =>
                updateFilters({ district: event.target.value })
              }
            >
              <option value="">{t.all_districts}</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {districtLabel(lang, district)}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>{t.label_cuisine}</span>
            <select
              value={filters.cuisine}
              onChange={(event) =>
                updateFilters({ cuisine: event.target.value })
              }
            >
              <option value="">{t.all_cuisines}</option>
              {cuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisineLabel(lang, cuisine)}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>{t.sort}</span>
            <select
              value={filters.sort}
              onChange={(event) => chooseSort(event.target.value as SortKey)}
            >
              <option value="recommended">{t.sort_default}</option>
              <option value="name">{t.sort_az}</option>
              <option value="rating">{t.sort_rating}</option>
              <option value="nearest">{t.sort_nearest}</option>
            </select>
          </label>

          <div className="control view-toggle" aria-label={t.label_view}>
            <span>{t.label_view}</span>
            {renderViewButtons()}
          </div>

          {inPanel ? null : (
            <button
              type="button"
              className="clear-all"
              onClick={() => clearAll(false)}
            >
              {t.clear_all}
            </button>
          )}
        </div>

        {/* The Saved view toggle (Phase B fix B-1, v1's saved-bar):
            a pill that lists only the device's saved places, with
            the saved count and v1's device-only note beside it.
            It is part of the shared control set, so the in-page
            controls and the floating panel's copy agree — and on
            phone, where the in-page area leaves the flow, the
            panel copy is the way in, exactly as v1's is. The
            hearts swap on aria-pressed, as v1's do. */}
        <div className="saved-bar">
          <button
            type="button"
            className="saved-toggle"
            aria-pressed={filters.savedOnly}
            onClick={() => updateFilters({ savedOnly: !filters.savedOnly })}
          >
            <span className="heart-off" aria-hidden="true">
              ♡
            </span>
            <span className="heart-on" aria-hidden="true">
              ♥
            </span>{" "}
            <span>{t.saved_view}</span>
            {savedIds.length ? <span>({savedIds.length})</span> : null}
          </button>
          <span className="saved-note">{t.saved_device_only}</span>
        </div>

        <div className="near-bar">
          <button
            type="button"
            className={filters.nearActive ? "near-btn active" : "near-btn"}
            aria-pressed={filters.nearActive}
            disabled={locating}
            onClick={startNearMe}
          >
            {locating ? t.near_locating : t.near_me}
          </button>
          {filters.nearActive ? (
            <>
              <label className="near-radius">
                <span>{t.near_within}</span>
                <select
                  aria-label={t.near_within}
                  value={filters.radiusKm}
                  onChange={(event) =>
                    updateFilters({ radiusKm: Number(event.target.value) })
                  }
                >
                  {NEAR_RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                  <option value={ANY_DISTANCE_KM}>{t.near_any}</option>
                </select>
              </label>
              <button type="button" className="near-clear" onClick={clearNear}>
                {t.near_clear}
              </button>
            </>
          ) : null}
        </div>
        <p
          className={
            nearStatus.mode
              ? `near-status is-${nearStatus.mode}`
              : "near-status"
          }
          role="status"
          aria-live="polite"
        >
          {nearStatus.text}
        </p>
      </>
    );
  }

  return (
    <div className="browser">
      <header className="hero">
        {/* The old site's signature banner photo, carrying the
            band the way the old site's top does: the title and
            counts sit on the photo itself, over a soft green→blue
            scrim, and the band's bottom edge fades into the page.
            The photo is self-hosted at /banner.jpg and precached
            by the service worker: it used to load cross-origin
            from the old site's address (the og:image URL), which
            the service worker never caches, so a cold home-screen
            launch often missed it until a reopen (Jenny's report,
            2026-11-23). Decorative: the title text beside it names
            the guide. If it cannot load (offline before a first
            online visit, say), the frame's gradient simply fills
            the band. */}
        <div className="hero-media" aria-hidden="true">
          <img className="hero-photo" src="/banner.jpg" alt="" />
        </div>
        <div className="hero-body">
          <div className="hero-top">
            <h1>
              Hao Chi Taiwan{" "}
              <span className="hero-title-zh">好吃台灣</span>
            </h1>
            {renderLangToggle()}
          </div>
          <p className="counts">
            {places.length} {t.stat_total} · {tabCounts.recommended}{" "}
            {t.stat_recommended} · {tabCounts.want_to_try} {t.stat_want} ·{" "}
            {kaohsiungCount} {t.stat_khh}
          </p>
          {/* v1's hero intro paragraph (Phase B fix B-7), under
              the title and counts; its numbers are the live list
              totals, interpolated in the string itself. */}
          <p className="hero-lede">
            {t.lede(tabCounts.recommended, tabCounts.want_to_try)}
          </p>
        </div>
      </header>

      {/* The in-page search area. On phone (≤640px) it leaves the
          page flow entirely (CSS) and lives only in the floating
          button's panel; on desktop it stays visible and the
          floating button is scroll-gated on this block. */}
      <div className="search-area in-page" ref={searchAreaRef}>
        {renderControlSet(false)}
      </div>

      <p className="result-count" aria-live="polite" ref={listTopRef}>
        {filters.savedOnly
          ? t.saved_showing(displayed.length)
          : t.showing(displayed.length)}
      </p>

      {/* Phone only (≤640px, CSS): the view and language toggles stay
          reachable beside the count line while the search area lives
          in the panel. Bound to the same state as everywhere else. */}
      <div className="phone-toolbar">
        <div className="view-toggle" aria-label={t.label_view}>
          {renderViewButtons()}
        </div>
        {renderLangToggle()}
      </div>

      {displayed.length === 0 ? (
        <p className="empty">
          {filters.savedOnly
            ? t.saved_empty
            : filters.nearActive && filters.radiusKm < ANY_DISTANCE_KM
              ? t.near_none(filters.radiusKm)
              : t.empty}
        </p>
      ) : view === "cards" ? (
        <ul className="place-list cards">
          {visible.map((place) => (
            <li
              key={place.legacy_id}
              className="place card clickable"
              role="button"
              tabIndex={0}
              aria-label={detailsLabel(place)}
              onClick={() => openDetails(place)}
              onKeyDown={openOnKeyDown(place)}
            >
              <div className="place-head">
                <h3 className="place-name-zh">{place.name_zh}</h3>
                {savedIds.includes(place.legacy_id) ? (
                  <span className="saved-marker">{t.saved}</span>
                ) : null}
                {renderSaveHeart(place)}
              </div>
              <p className="place-name-en">{place.name_en}</p>
              {glossFor(place, lang) ? (
                <p className="place-gloss">{glossFor(place, lang)}</p>
              ) : null}
              <p className="place-meta">
                {[place.cuisine, place.district, cityLabel(lang, place.city ?? "")]
                  .filter(Boolean)
                  .join(" · ")}
                {/* The place's number in the current view, as quiet
                    text ending the meta line — never a badge, and
                    never up by the heart, where it could read as a
                    save count (Jenny, 2026-11-22). */}
                <span className="place-no">
                  {" · "}
                  {t.place_no(numbers.get(place.legacy_id) ?? 0)}
                </span>
              </p>
              {/* The v1 tag row (Jenny, 2026-11-22): the cuisine
                  chip, then the Google rating chip — the rating's
                  composed text is unchanged, only its dress: a
                  small quiet pill instead of a plain muted line.
                  Either chip shows alone when the other is absent. */}
              {place.cuisine || place.rating_value != null ? (
                <p className="tag-row">
                  {place.cuisine ? (
                    <span className="tag">{place.cuisine}</span>
                  ) : null}
                  {place.rating_value != null ? (
                    <span className="tag rating">{ratingText(place)}</span>
                  ) : null}
                </p>
              ) : null}
              {distances.get(place.legacy_id) != null ? (
                <p className="place-dist">
                  <span className="dist-tag">
                    {formatDist(distances.get(place.legacy_id) ?? null)}
                  </span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="place-list compact">
          {visible.map((place) => (
            <li
              key={place.legacy_id}
              className="place row clickable"
              role="button"
              tabIndex={0}
              aria-label={detailsLabel(place)}
              onClick={() => openDetails(place)}
              onKeyDown={openOnKeyDown(place)}
            >
              <span className="row-names">
                <span className="place-name-zh">{place.name_zh}</span>
                <span className="place-name-en">{place.name_en}</span>
                {/* The food line under the names, as on the old
                    app's rows: the gloss in the current language
                    (Chinese where a translation is loaded) when the
                    place has one, otherwise its cuisine (the same
                    fallback detailsLabel uses). */}
                {glossFor(place, lang) || place.cuisine ? (
                  <span className="row-food">
                    {glossFor(place, lang) || place.cuisine}
                    {/* The current-view number, flowing on the left
                        right after the food text — not right-aligned
                        and not beside the heart (Jenny, 2026-11-22). */}
                    <span className="place-no">
                      {" · "}
                      {t.place_no(numbers.get(place.legacy_id) ?? 0)}
                    </span>
                  </span>
                ) : null}
              </span>
              {distances.get(place.legacy_id) != null ? (
                <span className="dist-tag">
                  {formatDist(distances.get(place.legacy_id) ?? null)}
                </span>
              ) : null}
              {savedIds.includes(place.legacy_id) ? (
                <span className="saved-marker">{t.saved}</span>
              ) : null}
              {renderSaveHeart(place)}
              {/* The rating as the same chip as on cards — but on
                  its OWN line under the food line (the .row-tags
                  wrapper takes the full row width), never sharing
                  the names line: at phone widths the full-text chip
                  beside the heart crushed the names into a narrow
                  column (Jenny's screenshot, 2026-11-22). */}
              {place.rating_value != null ? (
                <span className="row-tags">
                  <span className="tag rating">{ratingText(place)}</span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {displayed.length > 0 ? (
        <div className="batch-area">
          <p className="batch-count">
            {hasMore
              ? t.showingOf(visible.length, displayed.length)
              : t.showingAll(displayed.length)}
          </p>
          {hasMore ? (
            <button
              type="button"
              className="show-more"
              onClick={() =>
                setVisibleCount((count) => count + batchFor(view))
              }
            >
              {t.show_more}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* The map sits BELOW the list, as on the old site (Jenny's
          arrangement): hero → controls → list → map → contact.
          Its behaviour is unchanged — pins follow the filtered
          set, fit on set change only, a pin tap opens details. */}
      <section className="map-section" aria-label={t.map_h}>
        <h2 className="map-heading">{t.map_h}</h2>
        <p className="map-sub">{t.map_sub}</p>
        <PlaceMap markerSet={markerSet} onSelect={openDetails} />
      </section>

      {/* Contact & feedback section, as on the live app: a heading,
          the invitation text, and the button that opens the form
          (plus the plain email line beside it). */}
      <section className="contact-section" aria-labelledby="contactH">
        <h2 id="contactH">{t.contact_h}</h2>
        <p className="contact-sub">{t.contact_sub}</p>
        <div className="contact-card">
          <button
            type="button"
            className="contact-open-btn"
            onClick={() => openContact("feedback", null)}
          >
            {t.contact_btn}
          </button>
          <span className="contact-email-line">
            <span>{t.contact_email_label}</span>{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
        </div>
      </section>

      <SiteFooter lang={lang} />

      {selectedPlace ? (
        <PlaceDetails
          place={selectedPlace}
          lang={lang}
          isSaved={savedIds.includes(selectedPlace.legacy_id)}
          distanceKm={distances.get(selectedPlace.legacy_id) ?? null}
          visitorOrigin={filters.origin}
          onToggleSave={toggleSave}
          onReport={(place) => openContact("problem", place)}
          suspended={contactRequest != null}
          onClose={closeDetails}
        />
      ) : null}

      <ContactForm
        lang={lang}
        request={contactRequest}
        onClose={() => setContactRequest(null)}
      />

      {/* Floating search button (Jenny's design): the one floating
          control over the list. On desktop it appears once the
          in-page search area has scrolled off screen; on phone it is
          always visible. The badge carries the result count while
          the set is narrowed, so an active filter is never invisible
          while the panel is closed. */}
      <button
        type="button"
        className="float-search"
        hidden={!floatVisible}
        aria-label="Search & filters / 搜尋與篩選"
        onClick={openPanel}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        {badge != null ? <span className="float-badge">{badge}</span> : null}
      </button>

      {/* Search & filter panel: the same controls, bound to the same
          state, so the panel always shows the search exactly as the
          visitor last left it. The ✕ is the ONLY way to close it —
          scrolling, tapping the backdrop and pressing Escape do not
          dismiss it (deliberately no handlers for those here). The ✕
          sits outside the scrolling sheet, pinned in the corner. */}
      <div
        className={panelOpen ? "spanel open" : "spanel"}
        role="dialog"
        aria-modal="false"
        aria-labelledby="searchPanelTitle"
        aria-hidden={!panelOpen}
        ref={panelRef}
      >
        <div className="sheetwrap searchpanelwrap">
          <button
            type="button"
            className="panel-close"
            aria-label={t.close}
            onClick={closePanel}
          >
            ✕
          </button>
          <div className="sheet search-sheet" ref={sheetRef}>
            <h2 id="searchPanelTitle">{t.search_filters}</h2>
            <p className="panel-count" role="status">
              {t.panel_showing(displayed.length, places.length)}
            </p>
            <div className="search-panel-body">{renderControlSet(true)}</div>
            <div className="search-panel-actions">
              <button
                type="button"
                className="clear-all panel-clear"
                onClick={() => clearAll(true)}
              >
                {t.clear_all}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
