import { supabase } from "@/lib/supabase";

// Phase 2 rebuild skeleton: the home page is a server component that reads
// every place from Supabase and renders the two lists in the same order and
// name arrangement as the live app (Chinese name as the heading, English
// name as the sub-line, gloss beneath). No search, filters or map yet.

type Place = {
  legacy_id: string;
  list_type: "recommended" | "want_to_try";
  name_zh: string;
  name_en: string;
  gloss: string | null;
};

function legacyNumber(legacyId: string): number {
  const n = parseInt(legacyId.replace(/^r/, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

async function getPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from("places")
    .select("legacy_id, list_type, name_zh, name_en, gloss")
    .range(0, 999);

  if (error) {
    throw new Error(`Failed to load places: ${error.message}`);
  }
  return (data ?? []) as Place[];
}

function PlaceItem({ place }: { place: Place }) {
  return (
    <li className="place">
      <h3 className="place-name-zh">{place.name_zh}</h3>
      <p className="place-name-en">{place.name_en}</p>
      {place.gloss ? <p className="place-gloss">{place.gloss}</p> : null}
    </li>
  );
}

export default async function HomePage() {
  const places = await getPlaces();

  const recommended = places
    .filter((p) => p.list_type === "recommended")
    .sort((a, b) => legacyNumber(a.legacy_id) - legacyNumber(b.legacy_id));

  const wantToTry = places
    .filter((p) => p.list_type === "want_to_try")
    .sort((a, b) => a.name_en.localeCompare(b.name_en));

  return (
    <main className="page">
      <header className="hero">
        <h1>Hao Chi Taiwan 好吃台灣</h1>
        <p className="counts">
          {places.length} places · {recommended.length} Recommended ·{" "}
          {wantToTry.length} Want to Try
        </p>
      </header>

      <section>
        <h2>Recommended</h2>
        <ul className="place-list">
          {recommended.map((place) => (
            <PlaceItem key={place.legacy_id} place={place} />
          ))}
        </ul>
      </section>

      <section>
        <h2>Want to Try</h2>
        <ul className="place-list">
          {wantToTry.map((place) => (
            <PlaceItem key={place.legacy_id} place={place} />
          ))}
        </ul>
      </section>
    </main>
  );
}
