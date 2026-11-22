import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../InfoPageView";

// The Privacy page at a real address (it was an overlay before the
// real-addresses slice). Text: lib/pages.ts — the live wording,
// minimally adapted to stay true of the rebuild.

export const metadata: Metadata = infoMetadata("en", "privacy");

export default function PrivacyPage() {
  return (
    <main className="page">
      <InfoPageView lang="en" page="privacy" />
    </main>
  );
}
