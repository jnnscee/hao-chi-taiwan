// Style logic for the trial vector map (MapLibre GL JS with
// OpenFreeMap's OpenMapTiles vector tiles — OpenStreetMap data,
// served as vectors instead of the borrowed raster pictures the
// Leaflet map used). Kept free of MapLibre and React imports so the
// behaviour can be unit-checked in plain node, like lib/map.ts.
//
// Two jobs:
//  1. Language: the base style's labels combine the romanised and
//     local names (OpenMapTiles' name:latin / name:nonlatin pair).
//     The app instead shows ONE name per label, following the app's
//     own language: English prefers name:en, then the romanised
//     name:latin, then the local name; Chinese prefers the local
//     name (which in Taiwan IS the Chinese name), then English.
//  2. Night adaptation: the base style (OpenFreeMap "positron", a
//     calm light style) is repainted toward the app's night palette
//     by overriding paint properties layer by layer — the geometry,
//     label placement and zoom behaviour stay the base style's.

import type { Lang } from "./i18n";

/** The app's night palette (globals.css tokens), as literals —
 * MapLibre paint properties cannot read CSS variables. */
export const NIGHT = {
  ground: "#131715",
  surface: "#1d2320",
  raised: "#232a26",
  line: "#39413c",
  ink: "#f0ede3",
  muted: "#a9b3a6",
  faded: "#8d988c",
  water: "#14313d",
  waterLine: "#1e4256",
  waterText: "#7cc7ea",
  wood: "#1e2f24",
  park: "#1d2f26",
  land: "#182420",
  residential: "#1a211c",
  road: "#414d44",
  roadCasing: "#0b0e0c",
  boundary: "#4b574f",
} as const;

/**
 * Does this style layer's text-field draw a place/road NAME (as
 * opposed to, say, a highway shield's `ref`)? Only name labels get
 * their text-field rewritten per language; shields and one-way
 * arrows keep the base style's field untouched.
 */
export function isNameLabelField(textField: unknown): boolean {
  if (textField == null) return false;
  return JSON.stringify(textField).includes("name");
}

/**
 * The text-field expression for one language. OpenMapTiles features
 * carry `name` (local), `name:en`, `name:latin` (romanised) and
 * `name:nonlatin` properties; a coalesce over the preferred order
 * gives every label its best available name in that language.
 */
export function labelTextField(lang: Lang): unknown {
  return lang === "zh"
    ? ["coalesce", ["get", "name"], ["get", "name:en"]]
    : [
        "coalesce",
        ["get", "name:en"],
        ["get", "name:latin"],
        ["get", "name"],
      ];
}

export type StyleLayerInfo = {
  id: string;
  type: string;
  sourceLayer?: string;
};

/**
 * The night-palette paint overrides for one base-style layer, keyed
 * by MapLibre paint property. Tasteful rather than exhaustive: the
 * land/water/road/label colours that decide whether the map reads
 * as the app's night theme; minor layers the rules don't recognise
 * keep the base style's paint (positron's are quiet greys, which
 * sit acceptably on the dark ground for a trial).
 */
export function darkPaintOverrides(
  layer: StyleLayerInfo
): Record<string, unknown> {
  const { id, type, sourceLayer } = layer;

  if (type === "background") {
    return { "background-color": NIGHT.ground };
  }
  if (type === "raster") {
    // The low-zoom natural-earth shaded relief: keep it as a faint
    // texture over the night ground instead of a pale slab.
    return { "raster-opacity": 0.3 };
  }

  if (type === "fill") {
    switch (sourceLayer) {
      case "water":
        return { "fill-color": NIGHT.water };
      case "park":
        return { "fill-color": NIGHT.park };
      case "landcover":
        if (id.includes("wood")) return { "fill-color": NIGHT.wood };
        if (id.includes("ice") || id.includes("glacier")) {
          return { "fill-color": "#2a3430" };
        }
        return { "fill-color": NIGHT.land };
      case "landuse":
        return { "fill-color": NIGHT.residential };
      case "building":
        return {
          "fill-color": NIGHT.raised,
          "fill-outline-color": NIGHT.ground,
        };
      case "aeroway":
        return { "fill-color": NIGHT.surface };
      case "transportation":
        // Piers and road areas take the ground tone.
        return { "fill-color": "#171c19" };
      default:
        return {};
    }
  }

  if (type === "line") {
    switch (sourceLayer) {
      case "waterway":
        return { "line-color": NIGHT.waterLine };
      case "boundary":
        return { "line-color": NIGHT.boundary };
      case "aeroway":
        return { "line-color": NIGHT.line };
      case "transportation":
      case "transportation_name":
        if (id.includes("casing")) return { "line-color": NIGHT.roadCasing };
        if (id.includes("subtle")) {
          return { "line-color": "rgba(169, 179, 166, 0.30)" };
        }
        if (id.includes("dashline")) return { "line-color": NIGHT.boundary };
        if (id.includes("railway")) return { "line-color": "#333c36" };
        return { "line-color": NIGHT.road };
      default:
        return {};
    }
  }

  if (type === "symbol") {
    if (sourceLayer === "water_name" || sourceLayer === "waterway") {
      return {
        "text-color": NIGHT.waterText,
        "text-halo-color": NIGHT.ground,
        "text-halo-width": 1.4,
      };
    }
    if (sourceLayer === "place") {
      const strong = id.includes("city") || id.includes("capital");
      return {
        "text-color": strong
          ? NIGHT.ink
          : id.includes("country")
            ? NIGHT.muted
            : id.includes("state")
              ? NIGHT.faded
              : "#ccd2c6",
        "text-halo-color": NIGHT.ground,
        "text-halo-width": 1.2,
        "text-halo-blur": 0,
      };
    }
    // Road names, airport and any other name labels: the muted
    // tone with a ground halo, legible without shouting.
    return {
      "text-color": NIGHT.muted,
      "text-halo-color": NIGHT.ground,
      "text-halo-width": 1.2,
      "text-halo-blur": 0,
    };
  }

  return {};
}

/** The slice of a MapLibre map the appliers below need — kept
 * structural so lib/mapStyle.ts stays MapLibre-free. */
export type StyleTarget = {
  getStyle(): {
    layers: Array<{
      id: string;
      type: string;
      "source-layer"?: string;
      layout?: Record<string, unknown>;
    }>;
  } | undefined;
  setPaintProperty(layerId: string, name: string, value: unknown): unknown;
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown;
};

/** Repaint the loaded base style toward the night palette. Layers
 * the rules don't recognise keep their base paint. A layer whose
 * paint rejects an override (style drift in the hosted base style)
 * must not sink the rest, so each layer is applied on its own. */
export function applyDarkPaint(map: StyleTarget): void {
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    const overrides = darkPaintOverrides({
      id: layer.id,
      type: layer.type,
      sourceLayer: layer["source-layer"],
    });
    for (const [name, value] of Object.entries(overrides)) {
      try {
        map.setPaintProperty(layer.id, name, value);
      } catch {
        /* one layer's drift never blocks the others */
      }
    }
  }
}

/** Rewrite every name label's text-field for the app's language.
 * Pure layout changes on the live style — no style reload, no tile
 * reload beyond the labels MapLibre re-lays-out itself. */
export function applyLabelLanguage(map: StyleTarget, lang: Lang): void {
  const style = map.getStyle();
  if (!style) return;
  const field = labelTextField(lang);
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (!isNameLabelField(layer.layout?.["text-field"])) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field", field);
    } catch {
      /* a drifted layer keeps the base style's labels */
    }
  }
}

