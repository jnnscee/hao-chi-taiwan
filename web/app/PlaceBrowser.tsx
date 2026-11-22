"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assignDisplayNumbers,
  batchFor,
  distinctValues,
  filterAndSortPlaces,
  DEFAULT_FILTERS,
  type ListFilters,
  type Place,
  type SortKey,
  type TabKey,
  type ViewKey,
} from "@/lib/places";
import {
  SAVED_STORAGE_KEY,
  parseSavedIds,
  placeIdFromSearch,
  toggleSavedId,
} from "@/lib/details";
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

const VIEW_STORAGE_KEY = "hao-chi-view-v1"; // same key as the live app

const TAB_KEYS: TabKey[] = ["all", "recommended", "want_to_try"];

export default function PlaceBrowser({ places }: { places: Place[] }) {
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  // UI language. Server render and first paint are English; the URL /
  // stored choice is applied on mount, like the view default below.
  const [lang, setLang] = useState<Lang>("en");
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

  // On mount: resolve the language — a ?lang= URL parameter wins over
  // the stored toggle choice (hao-chi-lang-v1), which wins over the
  // English default. The URL parameter applies to this visit only; it
  // does not overwrite the stored choice.
  useEffect(() => {
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
  }, []);

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

  // Rewrite the URL in place, preserving whichever of ?place= / ?lang=
  // is not being changed.
  function syncUrl(patch: { place?: string | null; lang?: Lang }) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (patch.place !== undefined) {
        if (patch.place) params.set("place", patch.place);
        else params.delete("place");
      }
      if (patch.lang !== undefined) params.set("lang", patch.lang);
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

  function chooseLang(next: Lang) {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice just won't persist
    }
    syncUrl({ lang: next });
  }

  function openDetails(place: Place) {
    setSelectedId(place.legacy_id);
    syncUrl({ place: place.legacy_id });
  }

  function closeDetails() {
    setSelectedId(null);
    syncUrl({ place: null });
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

  function clearAll() {
    setFilters(DEFAULT_FILTERS);
    setVisibleCount(batchFor(view));
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
    () => filterAndSortPlaces(places, filters),
    [places, filters]
  );
  const numbers = useMemo(
    () => assignDisplayNumbers(displayed),
    [displayed]
  );
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
    const food = place.gloss ?? place.cuisine;
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

  return (
    <div className="browser">
      <header className="hero">
        <div className="hero-top">
          <h1>Hao Chi Taiwan 好吃台灣</h1>
          <div className="langtoggle" role="group" aria-label="Language / 語言">
            <button
              type="button"
              aria-pressed={lang === "en"}
              className={lang === "en" ? "lang-btn active" : "lang-btn"}
              onClick={() => chooseLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              aria-pressed={lang === "zh"}
              className={lang === "zh" ? "lang-btn active" : "lang-btn"}
              onClick={() => chooseLang("zh")}
            >
              中文
            </button>
          </div>
        </div>
        <p className="counts">
          {places.length} {t.stat_total} · {tabCounts.recommended}{" "}
          {t.stat_recommended} · {tabCounts.want_to_try} {t.stat_want} ·{" "}
          {kaohsiungCount} {t.stat_khh}
        </p>
      </header>

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
            onChange={(event) =>
              updateFilters({ sort: event.target.value as SortKey })
            }
          >
            <option value="recommended">{t.sort_default}</option>
            <option value="name">{t.sort_az}</option>
            <option value="rating">{t.sort_rating}</option>
          </select>
        </label>

        <div className="control view-toggle" aria-label={t.label_view}>
          <span>{t.label_view}</span>
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
        </div>

        <button type="button" className="clear-all" onClick={clearAll}>
          {t.clear_all}
        </button>
      </div>

      <p className="result-count" aria-live="polite">
        {t.showing(displayed.length)}
      </p>

      {displayed.length === 0 ? (
        <p className="empty">{t.empty}</p>
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
                <span className="place-number">
                  {numbers.get(place.legacy_id)}
                </span>
                <h3 className="place-name-zh">{place.name_zh}</h3>
                {savedIds.includes(place.legacy_id) ? (
                  <span className="saved-marker">{t.saved}</span>
                ) : null}
              </div>
              <p className="place-name-en">{place.name_en}</p>
              {place.gloss ? (
                <p className="place-gloss">{place.gloss}</p>
              ) : null}
              <p className="place-meta">
                {[place.cuisine, place.district, cityLabel(lang, place.city ?? "")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {place.rating_value != null ? (
                <p className="place-rating">{ratingText(place)}</p>
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
              <span className="place-number">
                {numbers.get(place.legacy_id)}
              </span>
              <span className="row-names">
                <span className="place-name-zh">{place.name_zh}</span>
                <span className="place-name-en">{place.name_en}</span>
              </span>
              {savedIds.includes(place.legacy_id) ? (
                <span className="saved-marker">{t.saved}</span>
              ) : null}
              {place.rating_value != null ? (
                <span className="place-rating">
                  {place.rating_value.toFixed(1)}
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

      {selectedPlace ? (
        <PlaceDetails
          place={selectedPlace}
          lang={lang}
          isSaved={savedIds.includes(selectedPlace.legacy_id)}
          onToggleSave={toggleSave}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
}
