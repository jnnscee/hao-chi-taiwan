import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlace, getPlaces } from "@/lib/data";
import { placeMetadata } from "@/lib/routes";
import PlacePageClient from "../../../PlacePageClient";

// A place's own page, Chinese — the /zh/ twin of /place/<id>,
// statically generated for every legacy_id; unknown ids 404.

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
  return placeMetadata(place, "zh");
}

export default async function ZhPlacePage({ params }: Props) {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) notFound();

  return (
    <main className="page">
      <PlacePageClient place={place} lang="zh" />
    </main>
  );
}
