import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlace, getPlaces } from "@/lib/data";
import { placeMetadata } from "@/lib/routes";
import PlacePageClient from "../../PlacePageClient";

// A place's own page, English. Statically generated for every
// legacy_id in the data at build time; a place Jenny adds later
// in /admin renders on its first visit instead (dynamicParams
// stays at its default), and an unknown id is a proper 404 via
// notFound(). ISR revalidation keeps edits fresh: a save in
// /admin shows up here within about a minute, no redeploy.

export const revalidate = 60;

export async function generateStaticParams() {
  const places = await getPlaces();
  return places.map((p) => ({ id: p.legacy_id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) return {};
  return placeMetadata(place, "en");
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) notFound();

  return (
    <main className="page">
      <PlacePageClient place={place} lang="en" />
    </main>
  );
}
