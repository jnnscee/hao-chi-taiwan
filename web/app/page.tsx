import type { Metadata } from "next";
import { getPlaces } from "@/lib/data";
import { homeMetadata } from "@/lib/routes";
import PlaceBrowser from "./PlaceBrowser";

// Phase 2 rebuild: the home page is a server component that reads
// every place from Supabase and hands the full set to the client-
// side browser (hero + language toggle, tabs, search, filters,
// sort, Cards/Compact) in PlaceBrowser. Its metadata is the live
// site's English variant; the Chinese twin lives at /zh/.

export const metadata: Metadata = homeMetadata("en");

// ISR: regenerate at most every 60 s so edits Jenny makes in
// /admin reach the public list without a redeploy.
export const revalidate = 60;

export default async function HomePage() {
  const places = await getPlaces();

  return (
    <main className="page">
      <PlaceBrowser places={places} routeLang="en" />
    </main>
  );
}
