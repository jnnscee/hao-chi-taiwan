import type { MetadataRoute } from "next";

/**
 * The web app manifest (served at /manifest.webmanifest, linked
 * into the head by Next). Icons are the generated routes — see
 * app/icon.tsx and app/icons/[name]/route.ts — covering 192 and
 * 512 plus a maskable 512, so the guide is installable without any
 * binary icon files in the repo.
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
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
