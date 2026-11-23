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
        // The security header set: the static site's set (its
        // vercel.json) plus the Content-Security-Policy, drafted
        // for this app and added at Phase A (Jenny's go-ahead,
        // 2026-11-23) after having been deliberately deferred by
        // the engineering-backbone audit (2026-11-22) until it
        // could be proven against the running app. What the
        // policy has to allow, and why:
        //  - script/style 'unsafe-inline': Next's bootstrap
        //    streams inline scripts, and Leaflet positions tiles
        //    and markers with inline styles.
        //  - img-src: the self-hosted banner and icons ('self',
        //    data:), OpenStreetMap tiles, and Supabase storage
        //    (admin place photos).
        //  - connect-src: Supabase (place data + auth) and the
        //    map tiles again — the service worker fetches tiles
        //    itself, and a worker's fetches answer to connect-src.
        //  - Everything else stays home: fonts are the device's
        //    own, the worker and manifest are same-origin, no
        //    objects, no framing.
        // (Vercel already serves HSTS on these domains.)
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.supabase.co; connect-src 'self' https://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
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
