import type { Metadata } from "next";
import { contactMetadata } from "@/lib/routes";
import ContactPageClient from "../ContactPageClient";

// The Contact & feedback form at a real address. The same form
// also stays available as the in-app overlay (contact section,
// Report a problem) — this page is its shareable home.

export const metadata: Metadata = contactMetadata("en");

export default function ContactPage() {
  return (
    <main className="page">
      <ContactPageClient lang="en" />
    </main>
  );
}
