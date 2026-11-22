import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../InfoPageView";

// The About page at a real address (it was an overlay before the
// real-addresses slice). Text: lib/pages.ts, as approved.

export const metadata: Metadata = infoMetadata("en", "about");

export default function AboutPage() {
  return (
    <main className="page">
      <InfoPageView lang="en" page="about" />
    </main>
  );
}
