// Server-side place data for the rebuild's pages. Reads the
// Supabase `places` table with the publishable key (RLS-guarded,
// SELECT-only for the public) — the same single fetch the home
// page has always done, now shared by the home pages, the 242 × 2
// static place pages and the info pages' build.
//
// The fetch is cached at module level for CACHE_TTL_MS only. That
// is long enough for one build worker to render its burst of
// static pages from a single fetch, and short enough that the
// pages' ISR window (60 s, see the page files) always re-reads
// the table when it regenerates — so a place Jenny edits in
// /admin shows up on the public pages within about a minute,
// with no redeploy. (An unbounded memo would keep serving the
// build-time snapshot from a warm server process forever.)
// Server-only: never import this from a client component.

import { supabase } from "./supabase";
import type { Place } from "./places";

const CACHE_TTL_MS = 30_000;

const PLACE_COLUMNS =
  "legacy_id, list_type, name_zh, name_en, name_rom, gloss, cuisine, " +
  "rating_value, rating_count, city, district, address_en, address_zh, " +
  "lat, lng, maps_url, maps_short_url, phone, website, instagram, " +
  "instagram_handle, facebook, hours, hours_note, hours_checked_on, " +
  "visitor_notes, cash_only, temporarily_closed";

async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from("places")
    .select(PLACE_COLUMNS)
    .range(0, 999);

  if (error) {
    throw new Error(`Failed to load places: ${error.message}`);
  }
  return (data ?? []) as unknown as Place[];
}

let placesCache: { at: number; promise: Promise<Place[]> } | null = null;

/** Every place, in the table's own order. */
export function getPlaces(): Promise<Place[]> {
  if (!placesCache || Date.now() - placesCache.at > CACHE_TTL_MS) {
    placesCache = { at: Date.now(), promise: fetchPlaces() };
  }
  return placesCache.promise;
}

/** One place by its stable legacy_id, or null when there is none. */
export async function getPlace(legacyId: string): Promise<Place | null> {
  const places = await getPlaces();
  return places.find((p) => p.legacy_id === legacyId) ?? null;
}
