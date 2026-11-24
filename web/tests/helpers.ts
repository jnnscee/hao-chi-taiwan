// Shared fixture loading for the test suite.
//
// places.json is a SNAPSHOT of the Supabase `places` table (the same
// columns, in the same shape lib/data.ts's fetch produces), exported
// 2026-11-22 and refreshed 2026-11-23 for the gloss_zh column (the
// 45 Recommended translations; null elsewhere) and again the same day
// for the B-5 hours_checked_on backfill (200 places carry a checked
// date: 181× 2026-11-18, 19× 2026-11-20 — Jenny's final scope was the
// 197 Want to Try dates plus the pre-existing 41–45; the blanket
// 2026-11-18 stamps briefly placed on Recommended 1–10 were reverted
// the same day, in the data and here). It is deliberately a snapshot, not a live read: the
// tests must be deterministic in CI, where there are no Supabase
// credentials. Refresh it — in the same commit — whenever a bulk
// data change lands in the repo; single edits Jenny makes through
// /admin change the database only and never touch this file (the
// counts asserted below describe the snapshot, and a bulk refresh
// updates them deliberately, never silently).

import type { Place } from "../lib/places";
import fixture from "./fixtures/places.json";

export const places = fixture as unknown as Place[];

/** A minimal Place with overridable fields, for composition tests. */
export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    legacy_id: "r999",
    list_type: "want_to_try",
    name_zh: "測試店",
    name_en: "Test Place",
    name_rom: null,
    gloss: null,
    gloss_zh: null,
    cuisine: null,
    rating_value: null,
    rating_count: null,
    city: "Kaohsiung",
    district: "Zuoying",
    address_en: "1 Test Rd, Zuoying District, Kaohsiung",
    address_zh: null,
    lat: 22.68,
    lng: 120.3,
    maps_url: "https://maps.example/full",
    maps_short_url: "https://maps.example/short",
    phone: null,
    website: null,
    instagram: null,
    instagram_handle: null,
    facebook: null,
    hours: null,
    hours_note: null,
    hours_checked_on: null,
    visitor_notes: null,
    cash_only: false,
    temporarily_closed: false,
    ...overrides,
  };
}
