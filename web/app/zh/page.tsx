import type { Metadata } from "next";
import { getPlaces } from "@/lib/data";
import { homeMetadata } from "@/lib/routes";
import PlaceBrowser from "../PlaceBrowser";

// The Chinese home page: the same list as /, in Chinese from the
// first server render. The /zh/ path is authoritative for language
// here — PlaceBrowser boots in Chinese and records it as the
// stored preference (see lib/routes.ts). Metadata is the live
// site's Chinese variant, exactly as its /zh/ twin serves today.

export const metadata: Metadata = homeMetadata("zh");

// ISR, as on /: admin edits show up within about a minute.
export const revalidate = 60;

export default async function ZhHomePage() {
  const places = await getPlaces();

  return (
    <main className="page">
      <PlaceBrowser places={places} routeLang="zh" />
    </main>
  );
}
