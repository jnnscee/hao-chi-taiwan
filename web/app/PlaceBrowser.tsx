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

const VIEW_STORAGE_KEY = "hao-chi-view-v1"; // same key as the live app

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "recommended", label: "Recommended" },
  { key: "want_to_try", label: "Want to Try" },
];

export default function PlaceBrowser({ places }: { places: Place[] }) {
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  // Server render and first paint use Cards; the saved/phone default is
  // applied on mount to avoid a hydration mismatch.
  const [view, setView] = useState<ViewKey>("cards");
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    batchFor("cards")
  );

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

  return (
    <div className="browser">
      <div className="tabs" role="tablist" aria-label="Place lists">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab.key}
            className={filters.tab === tab.key ? "tab active" : "tab"}
            onClick={() => updateFilters({ tab: tab.key })}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      <div className="controls">
        <input
          type="search"
          className="search"
          placeholder="Search places…"
          aria-label="Search places"
          value={filters.query}
          onChange={(event) => updateFilters({ query: event.target.value })}
        />

        <label className="control">
          <span>City</span>
          <select
            value={filters.city}
            onChange={(event) => updateFilters({ city: event.target.value })}
          >
            <option value="">All cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>District</span>
          <select
            value={filters.district}
            onChange={(event) =>
              updateFilters({ district: event.target.value })
            }
          >
            <option value="">All districts</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>Cuisine</span>
          <select
            value={filters.cuisine}
            onChange={(event) =>
              updateFilters({ cuisine: event.target.value })
            }
          >
            <option value="">All cuisines</option>
            {cuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>Sort</span>
          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilters({ sort: event.target.value as SortKey })
            }
          >
            <option value="recommended">Recommended order</option>
            <option value="name">Name A–Z</option>
            <option value="rating">Highest Google rating</option>
          </select>
        </label>

        <div className="control view-toggle" aria-label="List style">
          <span>View</span>
          <div className="toggle-buttons">
            <button
              type="button"
              className={view === "cards" ? "toggle active" : "toggle"}
              aria-pressed={view === "cards"}
              onClick={() => chooseView("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              className={view === "compact" ? "toggle active" : "toggle"}
              aria-pressed={view === "compact"}
              onClick={() => chooseView("compact")}
            >
              Compact
            </button>
          </div>
        </div>

        <button type="button" className="clear-all" onClick={clearAll}>
          Clear all
        </button>
      </div>

      <p className="result-count" aria-live="polite">
        {displayed.length} {displayed.length === 1 ? "place" : "places"}
      </p>

      {displayed.length === 0 ? (
        <p className="empty">No places match.</p>
      ) : view === "cards" ? (
        <ul className="place-list cards">
          {visible.map((place) => (
            <li key={place.legacy_id} className="place card">
              <div className="place-head">
                <span className="place-number">
                  {numbers.get(place.legacy_id)}
                </span>
                <h3 className="place-name-zh">{place.name_zh}</h3>
              </div>
              <p className="place-name-en">{place.name_en}</p>
              {place.gloss ? (
                <p className="place-gloss">{place.gloss}</p>
              ) : null}
              <p className="place-meta">
                {[place.cuisine, place.district, place.city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {place.rating_value != null ? (
                <p className="place-rating">
                  Google rating {place.rating_value.toFixed(1)}
                  {place.rating_count != null
                    ? ` (${place.rating_count.toLocaleString()})`
                    : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="place-list compact">
          {visible.map((place) => (
            <li key={place.legacy_id} className="place row">
              <span className="place-number">
                {numbers.get(place.legacy_id)}
              </span>
              <span className="row-names">
                <span className="place-name-zh">{place.name_zh}</span>
                <span className="place-name-en">{place.name_en}</span>
              </span>
              {place.rating_value != null ? (
                <span className="place-rating">
                  {place.rating_value.toFixed(1)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          className="show-more"
          onClick={() =>
            setVisibleCount((count) => count + batchFor(view))
          }
        >
          Show more ({displayed.length - visibleCount} more)
        </button>
      ) : null}
    </div>
  );
}
