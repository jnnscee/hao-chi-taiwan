"use client";

import { Analytics } from "@vercel/analytics/next";

// Layer 1 of the stats Jenny approved on 2026-11-24: Vercel Web
// Analytics — cookieless, aggregate visit counts (pages viewed,
// how visitors arrive, country). It records nothing that
// identifies a visitor, and the Privacy page says exactly that.
//
// The /admin area is Jenny's own workspace, not visitor traffic:
// beforeSend drops every event whose URL is under /admin, so her
// own editing sessions never enter the counts. (The component
// has to live in a client wrapper like this one because
// beforeSend is a function prop, which a server component
// cannot pass down.)
export default function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const { pathname } = new URL(event.url);
          if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            return null;
          }
        } catch {
          // An unparseable URL is not worth dropping the event for.
        }
        return event;
      }}
    />
  );
}
