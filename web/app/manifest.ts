import type { MetadataRoute } from "next";

/**
 * The web app manifest (served at /manifest.webmanifest, linked
 * into the head by Next). Icons are the generated routes — see
 * app/icon.tsx and app/icons/[name]/route.ts — covering 192 and
 * 512 plus a maskable 512, all rendered from the one master
 * artwork (public/icon-master.png; see app/iconImage.tsx).
 *
 * Every icon src carries the artwork version as ?v=2 (the "v2"
 * of ICON_ARTWORK_VERSION in app/iconImage.tsx): the icon
 * routes answer with a year-long immutable cache header, so an
 * unversioned src would keep an installed app on the previous
 * artwork. The query is ignored by the routes themselves. The
 * /icon src is versioned the same way for consistency — the
 * ?<hash> Next puts on /icon in the page head does not apply
 * here, since the manifest names the route directly. Bump ?v=
 * with the artwork version.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hao Chi Taiwan",
    short_name: "Hao Chi Taiwan",
    description:
      "Jenny's personal guide to small restaurants, cafés and street-food spots across Taiwan — works offline once loaded.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#131715",
    theme_color: "#131715",
    icons: [
      {
        src: "/icons/192?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
