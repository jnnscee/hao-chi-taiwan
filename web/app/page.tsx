import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/places";
import PlaceBrowser from "./PlaceBrowser";

// Phase 2 rebuild: the home page is a server component that reads every
// place from Supabase and hands the full set to the client-side list
// controls (tabs, search, filters, sort, Cards/Compact) in PlaceBrowser.

const PLACE_COLUMNS =
  "legacy_id, list_type, name_zh, name_en, name_rom, gloss, cuisine, " +
  "rating_value, rating_count, city, district, address_en, address_zh";

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

  const recommendedCount = places.filter(
    (p) => p.list_type === "recommended"
  ).length;
  const wantToTryCount = places.length - recommendedCount;

  return (
    <main className="page">
      <header className="hero">
        <h1>Hao Chi Taiwan 好吃台灣</h1>
        <p className="counts">
          {places.length} places · {recommendedCount} Recommended ·{" "}
          {wantToTryCount} Want to Try
        </p>
      </header>

      <PlaceBrowser places={places} />
    </main>
  );
}
