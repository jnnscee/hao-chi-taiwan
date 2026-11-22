import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../InfoPageView";

// The Terms page at a real address (it was an overlay before the
// real-addresses slice). Text: lib/pages.ts, as approved.

export const metadata: Metadata = infoMetadata("en", "terms");

export default function TermsPage() {
  return (
    <main className="page">
      <InfoPageView lang="en" page="terms" />
    </main>
  );
}
