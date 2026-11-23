/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The service worker script itself must never be served
        // stale: the browser's update check has to see a new
        // sw.js as soon as one is deployed.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        // The static site's security header set (its vercel.json),
        // carried over by the engineering-backbone audit
        // (2026-11-22) — minus the Content-Security-Policy, which
        // is deliberately NOT copied: the static site's policy
        // assumes a single self-contained page, while the rebuild
        // is a Next.js app whose bootstrap uses inline scripts,
        // whose map loads OpenStreetMap tiles, whose banner/og
        // image is (interim) served from the main Vercel address
        // and which talks to Supabase. A CSP written for it has to
        // be drafted and proven against the running app (map,
        // admin sign-in, offline worker) rather than inherited —
        // it is a documented deferred item in the audit, not an
        // oversight. (Vercel already serves HSTS on these domains.)
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
