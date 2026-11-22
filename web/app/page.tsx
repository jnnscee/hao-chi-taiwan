import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/places";
import PlaceBrowser from "./PlaceBrowser";

// Phase 2 rebuild: the home page is a server component that reads every
// place from Supabase and hands the full set to the client-side browser
// (hero + language toggle, tabs, search, filters, sort, Cards/Compact)
// in PlaceBrowser.

const PLACE_COLUMNS =
  "legacy_id, list_type, name_zh, name_en, name_rom, gloss, cuisine, " +
  "rating_value, rating_count, city, district, address_en, address_zh, " +
  "lat, lng, maps_url, maps_short_url, phone, website, instagram, " +
  "instagram_handle, facebook, hours, hours_note, hours_checked_on, " +
  "visitor_notes, cash_only, temporarily_closed";

async function getPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from("places")
    .select(PLACE_COLUMNS)
    .range(0, 999);

  if (error) {
    throw new Error(`Failed to load places: ${error.message}`);
  }
  return (data ?? []) as unknown as Place[];
}

export default async function HomePage() {
  const places = await getPlaces();

  return (
    <main className="page">
      <PlaceBrowser places={places} />
    </main>
  );
}
