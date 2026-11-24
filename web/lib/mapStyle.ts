// Style logic for the trial vector map (MapLibre GL JS with
// OpenFreeMap's OpenMapTiles vector tiles — OpenStreetMap data,
// served as vectors instead of the borrowed raster pictures the
// Leaflet map used). Kept free of MapLibre and React imports so the
// behaviour can be unit-checked in plain node, like lib/map.ts.
//
// Three jobs:
//  1. Language: the base style's labels combine the romanised and
//     local names (OpenMapTiles' name:latin / name:nonlatin pair).
//     The app instead shows ONE name per label, following the app's
//     own language: English prefers name:en, then the romanised
//     name:latin, then the local name; Chinese prefers the local
//     name (which in Taiwan IS the Chinese name), then English.
//  2. Themes: the base style (OpenFreeMap "positron", a calm light
//     style) is repainted by overriding paint properties layer by
//     layer — the geometry, label placement and zoom behaviour stay
//     the base style's. Two palettes (Jenny, 2026-11-24): "night",
//     the app's dark theme, and "day", a soft pastel theme she
//     asked to try because a light map may be friendlier for
//     visitors with bad eyesight. The visitor switches between
//     them with the map's own day/night button; the choice is
//     remembered on the device (MAP_THEME_STORAGE_KEY) and DAY is
//     the first-visit default. Switching repaints the LIVE style
//     in place — no reload, no camera change.
//  3. Day-mode label sizes: in the day theme the main place and
//     road labels are nudged a little larger (LABEL_SIZE_BOOST),
//     because the day theme exists for legibility. The night theme
//     restores the base style's sizes exactly. A layer whose
//     text-size is neither a plain number nor an expression (a
//     legacy function object) is left alone in both themes.

import type { Lang } from "./i18n";

/** The map's two looks. "day" is the pastel palette; "night" is
 * the app's dark palette. */
export type MapTheme = "day" | "night";

/** Device-storage key for the visitor's day/night choice — named
 * with the app's other hao-chi-*-v1 keys and disclosed on the
 * Privacy page's device-storage list. */
export const MAP_THEME_STORAGE_KEY = "hao-chi-map-theme-v1";

/** First-visit default: the day (pastel) look Jenny asked to try;
 * the toggle makes the comparison with night instant. */
export const DEFAULT_MAP_THEME: MapTheme = "day";

/** Read a stored theme value: only "night" opts out of the day
 * default — anything missing or unrecognised is a day visitor. */
export function parseStoredMapTheme(value: string | null): MapTheme {
  return value === "night" ? "night" : "day";
}

/** How much larger the day theme draws the main place/road labels,
 * in px at the size the base style specifies. */
export const LABEL_SIZE_BOOST = 1.5;

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

/** The pastel (day) palette: soft, light, friendly fills — but
 * legibility-first, because the theme exists for eyesight. Land,
 * water and green space are unmistakably different tints at a
 * glance; roads are white with soft casings except the major
 * hierarchy, which wears gentle yellow (primary) and orange
 * (motorway) so it reads instantly; and NO text is ever
 * pastel-on-pastel — labels are deep slate ink on a clean white
 * halo. */
export const PASTEL = {
  ground: "#f3f6ee",
  land: "#edf3e2",
  water: "#b9daea",
  waterLine: "#93c3dc",
  waterText: "#20608c",
  park: "#cfe8c8",
  wood: "#bfe0b0",
  residential: "#e9efe0",
  building: "#efe6da",
  buildingOutline: "#ddd0ba",
  aeroway: "#e7ebdf",
  aerowayLine: "#d3dac6",
  roadArea: "#fafbf6",
  road: "#ffffff",
  roadMajor: "#f8d67c",
  roadMotorway: "#f6b26b",
  roadCasing: "#d3d9c8",
  roadMajorCasing: "#e6d09a",
  railway: "#bcc5b0",
  boundary: "#9aa78f",
  ink: "#2e3a33",
  labelSecondary: "#46544a",
  labelFaint: "#5c6d60",
  halo: "#ffffff",
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
export function nightPaintOverrides(
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

/**
 * The pastel (day) paint overrides for one base-style layer, in
 * the same shape as the night rules. The base style is already a
 * light style, so the fills mostly confirm and separate the soft
 * tints; the real work is the roads' hierarchy and the labels —
 * deep ink text on a white halo, never pastel-on-pastel.
 */
export function pastelPaintOverrides(
  layer: StyleLayerInfo
): Record<string, unknown> {
  const { id, type, sourceLayer } = layer;

  if (type === "background") {
    return { "background-color": PASTEL.ground };
  }
  if (type === "raster") {
    // The low-zoom shaded relief is drawn for a light style
    // already; leave it at the base paint.
    return {};
  }

  if (type === "fill") {
    switch (sourceLayer) {
      case "water":
        return { "fill-color": PASTEL.water };
      case "park":
        return { "fill-color": PASTEL.park };
      case "landcover":
        if (id.includes("wood")) return { "fill-color": PASTEL.wood };
        if (id.includes("ice") || id.includes("glacier")) {
          return { "fill-color": "#eef4f8" };
        }
        return { "fill-color": PASTEL.land };
      case "landuse":
        return { "fill-color": PASTEL.residential };
      case "building":
        return {
          "fill-color": PASTEL.building,
          "fill-outline-color": PASTEL.buildingOutline,
        };
      case "aeroway":
        return { "fill-color": PASTEL.aeroway };
      case "transportation":
        // Piers and road areas: near-white, like the roads.
        return { "fill-color": PASTEL.roadArea };
      default:
        return {};
    }
  }

  if (type === "line") {
    switch (sourceLayer) {
      case "waterway":
        return { "line-color": PASTEL.waterLine };
      case "boundary":
        return { "line-color": PASTEL.boundary };
      case "aeroway":
        return { "line-color": PASTEL.aerowayLine };
      case "transportation":
      case "transportation_name": {
        const major =
          id.includes("motorway") ||
          id.includes("trunk") ||
          id.includes("primary") ||
          id.includes("major");
        if (id.includes("casing")) {
          return {
            "line-color": major ? PASTEL.roadMajorCasing : PASTEL.roadCasing,
          };
        }
        if (id.includes("subtle")) {
          return { "line-color": "rgba(120, 135, 115, 0.35)" };
        }
        if (id.includes("dashline")) return { "line-color": PASTEL.boundary };
        if (id.includes("railway")) return { "line-color": PASTEL.railway };
        if (id.includes("motorway")) return { "line-color": PASTEL.roadMotorway };
        if (major) return { "line-color": PASTEL.roadMajor };
        return { "line-color": PASTEL.road };
      }
      default:
        return {};
    }
  }

  if (type === "symbol") {
    if (sourceLayer === "water_name" || sourceLayer === "waterway") {
      return {
        "text-color": PASTEL.waterText,
        "text-halo-color": PASTEL.halo,
        "text-halo-width": 1.4,
      };
    }
    if (sourceLayer === "place") {
      const strong = id.includes("city") || id.includes("capital");
      return {
        "text-color": strong
          ? PASTEL.ink
          : id.includes("country")
            ? PASTEL.labelSecondary
            : id.includes("state")
              ? PASTEL.labelFaint
              : PASTEL.ink,
        "text-halo-color": PASTEL.halo,
        "text-halo-width": 1.4,
        "text-halo-blur": 0,
      };
    }
    // Road names, airport and any other name labels: deep slate,
    // a step softer than the place ink, on the same white halo.
    return {
      "text-color": PASTEL.labelSecondary,
      "text-halo-color": PASTEL.halo,
      "text-halo-width": 1.4,
      "text-halo-blur": 0,
    };
  }

  return {};
}

/** The paint overrides for one layer in the chosen theme. */
export function paintOverridesFor(
  layer: StyleLayerInfo,
  theme: MapTheme
): Record<string, unknown> {
  return theme === "night"
    ? nightPaintOverrides(layer)
    : pastelPaintOverrides(layer);
}

/** The night overrides under their original name — the night
 * theme's callers and tests predate the theme split. */
export function darkPaintOverrides(
  layer: StyleLayerInfo
): Record<string, unknown> {
  return nightPaintOverrides(layer);
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

/** The base style's own text-size per label layer, remembered the
 * first time a target is seen: getStyle() reflects overrides once
 * applied, so without this record a day→night→day round trip would
 * wrap the day boost around itself and grow the labels each time.
 * Keyed by target (the map) so a remount starts clean. */
const baseTextSizes = new WeakMap<object, Map<string, unknown>>();

/** Is this symbol layer one of the main place/road name labels
 * whose size the day theme boosts? */
function isBoostedLabelLayer(layer: StyleLayerInfo): boolean {
  return (
    layer.type === "symbol" &&
    (layer.sourceLayer === "place" ||
      layer.sourceLayer === "transportation_name")
  );
}

/**
 * The text-size to set for one boosted label layer in a theme:
 * the base size in night; the base size + LABEL_SIZE_BOOST in day
 * (a plain number grows directly; an expression is wrapped in a
 * "+" so it grows at every zoom). Returns undefined when the layer
 * has no usable base size — a legacy function object or nothing —
 * and the layer then keeps whatever size it has in both themes.
 */
export function boostedTextSize(
  baseSize: unknown,
  theme: MapTheme
): unknown {
  if (theme === "night") return baseSize;
  if (typeof baseSize === "number") return baseSize + LABEL_SIZE_BOOST;
  if (Array.isArray(baseSize)) return ["+", baseSize, LABEL_SIZE_BOOST];
  return undefined;
}

/**
 * Repaint the loaded base style in the chosen theme: paint
 * overrides on every recognised layer, plus the label-size
 * treatment (day boosts the main labels, night restores the base
 * sizes). Layers the rules don't recognise keep their base paint.
 * A layer whose property rejects an override (style drift in the
 * hosted base style) must not sink the rest, so each property is
 * applied on its own. Pure live-style changes — no reload, no
 * camera change.
 */
export function applyMapPaint(map: StyleTarget, theme: MapTheme): void {
  const style = map.getStyle();
  if (!style) return;
  let bases = baseTextSizes.get(map);
  if (!bases) {
    bases = new Map();
    baseTextSizes.set(map, bases);
  }
  for (const layer of style.layers) {
    const info: StyleLayerInfo = {
      id: layer.id,
      type: layer.type,
      sourceLayer: layer["source-layer"],
    };
    const overrides = paintOverridesFor(info, theme);
    for (const [name, value] of Object.entries(overrides)) {
      try {
        map.setPaintProperty(layer.id, name, value);
      } catch {
        /* one layer's drift never blocks the others */
      }
    }
    if (isBoostedLabelLayer(info)) {
      if (!bases.has(layer.id)) {
        bases.set(layer.id, layer.layout?.["text-size"]);
      }
      const size = boostedTextSize(bases.get(layer.id), theme);
      if (size !== undefined) {
        try {
          map.setLayoutProperty(layer.id, "text-size", size);
        } catch {
          /* a drifted layer keeps its size */
        }
      }
    }
  }
}

/** The night repaint under its original name. */
export function applyDarkPaint(map: StyleTarget): void {
  applyMapPaint(map, "night");
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
