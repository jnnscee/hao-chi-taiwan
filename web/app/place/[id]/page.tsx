import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlace, getPlaces } from "@/lib/data";
import { placeMetadata } from "@/lib/routes";
import PlacePageClient from "../../PlacePageClient";

// A place's own page, English. Statically generated for every
// legacy_id in the data; an unknown id is a proper 404
// (dynamicParams off, plus notFound() as a belt-and-braces).

export const dynamicParams = false;

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
