// Shared place type and the pure list logic (tabs, search, filters, sort,
// numbering) for the rebuild. Kept free of React and Supabase imports so the
// behaviour can be unit-checked in plain node against the real data.

export type Place = {
  legacy_id: string;
  list_type: "recommended" | "want_to_try";
  name_zh: string;
  name_en: string;
  name_rom: string | null;
  gloss: string | null;
  cuisine: string | null;
  rating_value: number | null;
  rating_count: number | null;
  city: string | null;
  district: string | null;
  address_en: string | null;
  address_zh: string | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  maps_short_url: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  instagram_handle: string | null;
  facebook: string | null;
  hours: string | null;
  hours_note: string | null;
  hours_checked_on: string | null; // ISO date, e.g. "2026-11-20"
  visitor_notes: string | null;
  cash_only: boolean;
  temporarily_closed: boolean;
};

export type TabKey = "all" | "recommended" | "want_to_try";
export type SortKey = "recommended" | "name" | "rating" | "nearest";
export type ViewKey = "cards" | "compact";

/** A latitude/longitude pair — a place's position or the visitor's. */
export type LatLng = { lat: number; lng: number };

export type ListFilters = {
  tab: TabKey;
  query: string;
  city: string; // "" = all
  district: string; // "" = all
  cuisine: string; // "" = all
  sort: SortKey;
  /**
   * The visitor's location while Near me / Nearest sorting is in play.
   * Held in memory (React state) only: never persisted, never sent
   * anywhere — the live app's published privacy promise. null = unknown.
   */
  origin: LatLng | null;
  /** True while the Near me radius filter is switched on. */
  nearActive: boolean;
  /** Near me range in km; ANY_DISTANCE_KM means "any distance". */
  radiusKm: number;
};

export const DEFAULT_FILTERS: ListFilters = {
  tab: "all",
  query: "",
  city: "",
  district: "",
  cuisine: "",
  sort: "recommended",
  origin: null,
  nearActive: false,
  radiusKm: 5,
};

/** Near me range choices (km), the live app's set. */
export const NEAR_RADIUS_OPTIONS: number[] = [1, 3, 5, 10, 25];

/** The radius select's "Any distance" value, as in the live app. */
export const ANY_DISTANCE_KM = 9999;

export const BATCH_CARDS = 10;
export const BATCH_COMPACT = 15;

export function batchFor(view: ViewKey): number {
  return view === "cards" ? BATCH_CARDS : BATCH_COMPACT;
}

/** Numeric part of a legacy id: "12" -> 12, "r34" -> 34. */
export function legacyNumber(legacyId: string): number {
  const n = parseInt(legacyId.replace(/^r/, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

const SEARCH_FIELDS: Array<keyof Place> = [
  "name_zh",
  "name_en",
  "name_rom",
  "gloss",
  "cuisine",
  "city",
  "district",
  "address_en",
  "address_zh",
];

function matchesQuery(place: Place, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return SEARCH_FIELDS.some((field) => {
    const value = place[field];
    return typeof value === "string" && value.toLowerCase().includes(q);
  });
}

function byName(a: Place, b: Place): number {
  return a.name_en.localeCompare(b.name_en);
}

/**
 * "Recommended order": Recommended places first in legacy order (1–45),
 * then Want to Try by name A–Z. Within a single-list tab this reduces to
 * legacy order (Recommended) or name A–Z (Want to Try).
 */
function byRecommendedOrder(a: Place, b: Place): number {
  if (a.list_type !== b.list_type) {
    return a.list_type === "recommended" ? -1 : 1;
  }
  if (a.list_type === "recommended") {
    return legacyNumber(a.legacy_id) - legacyNumber(b.legacy_id);
  }
  return byName(a, b);
}

function byRating(a: Place, b: Place): number {
  const av = a.rating_value;
  const bv = b.rating_value;
  if (av == null && bv == null) return byName(a, b);
  if (av == null) return 1; // nulls last
  if (bv == null) return -1;
  if (bv !== av) return bv - av;
  return byName(a, b);
}

const SORTERS: Record<
  Exclude<SortKey, "nearest">,
  (a: Place, b: Place) => number
> = {
  recommended: byRecommendedOrder,
  name: byName,
  rating: byRating,
};

/**
 * Great-circle distance in km between two points — the live app's
 * haversine (Earth radius 6371 km), lifted as-is.
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** A place's distance from the visitor, or null when either is unknown. */
export function placeDistanceKm(place: Place, origin: LatLng | null): number | null {
  if (!origin || place.lat == null || place.lng == null) return null;
  return distanceKm(origin.lat, origin.lng, place.lat, place.lng);
}

/**
 * The live app's distance format, in both languages: metres under 1 km
 * ("850 m"), one decimal under 10 km ("1.2 km"), whole km above that.
 */
export function formatDist(km: number | null): string {
  if (km == null || !isFinite(km)) return "";
  if (km < 1) return Math.round(km * 1000) + " m";
  return (km < 10 ? km.toFixed(1) : Math.round(km)) + " km";
}

/**
 * Apply tab, search, dropdown and Near me radius filters, then sort.
 * Pure: input untouched. The radius filter layers on top of the other
 * filters exactly as the live app does, and — also as there — a place
 * with no coordinates is never dropped by it (its distance is unknown,
 * not large). "Nearest" needs the visitor's location; without one it
 * falls back to Recommended order.
 */
export function filterAndSortPlaces(
  places: Place[],
  filters: ListFilters
): Place[] {
  const distances = new Map<string, number | null>(
    places.map((place) => [
      place.legacy_id,
      placeDistanceKm(place, filters.origin),
    ])
  );
  const filtered = places.filter((place) => {
    if (filters.tab !== "all" && place.list_type !== filters.tab) return false;
    if (filters.city && place.city !== filters.city) return false;
    if (filters.district && place.district !== filters.district) return false;
    if (filters.cuisine && place.cuisine !== filters.cuisine) return false;
    if (!matchesQuery(place, filters.query)) return false;
    if (filters.nearActive && filters.radiusKm < ANY_DISTANCE_KM) {
      const d = distances.get(place.legacy_id);
      if (d != null && d > filters.radiusKm) return false;
    }
    return true;
  });
  if (filters.sort === "nearest") {
    if (!filters.origin) return filtered.sort(byRecommendedOrder);
    return filtered.sort((a, b) => {
      const da = distances.get(a.legacy_id);
      const db = distances.get(b.legacy_id);
      if (da == null && db == null) return byName(a, b);
      if (da == null) return 1; // unknown distance last
      if (db == null) return -1;
      if (da !== db) return da - db;
      return byName(a, b);
    });
  }
  return filtered.sort(SORTERS[filters.sort]);
}

/**
 * Display numbers, keyed by legacy_id. Recommended places always carry
 * their legacy number (1–45). Want to Try places are numbered 1..N in the
 * order they appear in the displayed list (which is A–Z under the default
 * and Name sorts), matching the live app.
 */
export function assignDisplayNumbers(displayed: Place[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let wantToTryCount = 0;
  for (const place of displayed) {
    if (place.list_type === "recommended") {
      numbers.set(place.legacy_id, legacyNumber(place.legacy_id));
    } else {
      wantToTryCount += 1;
      numbers.set(place.legacy_id, wantToTryCount);
    }
  }
  return numbers;
}

/** Sorted distinct non-empty values of a field, for the filter dropdowns. */
export function distinctValues(
  places: Place[],
  field: "city" | "district" | "cuisine"
): string[] {
  const values = new Set<string>();
  for (const place of places) {
    const value = place[field];
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}
