// Style-logic invariants for lib/mapStyle.ts: the trial vector
// map's labels follow the app language and its base style is
// repainted toward the night palette — decided here, in pure
// functions, so the component only applies what's computed.

import { describe, expect, it } from "vitest";
import {
  NIGHT,
  applyDarkPaint,
  applyLabelLanguage,
  darkPaintOverrides,
  isNameLabelField,
  labelTextField,
  type StyleTarget,
} from "../lib/mapStyle";

describe("isNameLabelField", () => {
  it("recognises the base style's combined name fields", () => {
    // OpenFreeMap positron/liberty label layers combine the
    // romanised and local names like this.
    expect(
      isNameLabelField([
        "case",
        ["has", "name:nonlatin"],
        ["concat", ["get", "name:latin"], " ", ["get", "name:nonlatin"]],
        ["coalesce", ["get", "name:latin"], ["get", "name"]],
      ])
    ).toBe(true);
    expect(isNameLabelField("{name}")).toBe(true);
  });

  it("leaves shields and arrows alone", () => {
    expect(isNameLabelField(["to-string", ["get", "ref"]])).toBe(false);
    expect(isNameLabelField(undefined)).toBe(false);
    expect(isNameLabelField(null)).toBe(false);
  });
});

describe("labelTextField", () => {
  it("English prefers name:en, then the romanised name, then local", () => {
    expect(labelTextField("en")).toEqual([
      "coalesce",
      ["get", "name:en"],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
  });

  it("Chinese prefers the local name, then English", () => {
    expect(labelTextField("zh")).toEqual([
      "coalesce",
      ["get", "name"],
      ["get", "name:en"],
    ]);
  });
});

describe("darkPaintOverrides", () => {
  it("paints the ground, water and parks in the night palette", () => {
    expect(darkPaintOverrides({ id: "background", type: "background" })).toEqual(
      { "background-color": NIGHT.ground }
    );
    expect(
      darkPaintOverrides({ id: "water", type: "fill", sourceLayer: "water" })
    ).toEqual({ "fill-color": NIGHT.water });
    expect(
      darkPaintOverrides({ id: "park", type: "fill", sourceLayer: "park" })
    ).toEqual({ "fill-color": NIGHT.park });
  });

  it("keeps road hierarchy: dark casings under lighter inners", () => {
    expect(
      darkPaintOverrides({
        id: "highway_major_casing",
        type: "line",
        sourceLayer: "transportation",
      })
    ).toEqual({ "line-color": NIGHT.roadCasing });
    expect(
      darkPaintOverrides({
        id: "highway_major_inner",
        type: "line",
        sourceLayer: "transportation",
      })
    ).toEqual({ "line-color": NIGHT.road });
  });

  it("labels get light text on a ground halo; water labels the app blue", () => {
    const city = darkPaintOverrides({
      id: "label_city",
      type: "symbol",
      sourceLayer: "place",
    });
    expect(city["text-color"]).toBe(NIGHT.ink);
    expect(city["text-halo-color"]).toBe(NIGHT.ground);
    const water = darkPaintOverrides({
      id: "water_name_point_label",
      type: "symbol",
      sourceLayer: "water_name",
    });
    expect(water["text-color"]).toBe(NIGHT.waterText);
  });

  it("fades the low-zoom shaded relief instead of leaving a pale slab", () => {
    expect(
      darkPaintOverrides({ id: "ne2_shaded", type: "raster" })
    ).toEqual({ "raster-opacity": 0.3 });
  });

  it("unrecognised layers keep the base paint", () => {
    expect(
      darkPaintOverrides({ id: "whatever", type: "fill", sourceLayer: "housenumber" })
    ).toEqual({});
  });
});

/** A fake StyleTarget recording every property set. */
type FakeLayer = {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
};

function fakeTarget(layers: FakeLayer[]) {
  const paint: Array<[string, string, unknown]> = [];
  const layout: Array<[string, string, unknown]> = [];
  const target: StyleTarget = {
    getStyle: () => ({ layers }),
    setPaintProperty: (id, name, value) => {
      paint.push([id, name, value]);
    },
    setLayoutProperty: (id, name, value) => {
      layout.push([id, name, value]);
    },
  };
  return { target, paint, layout };
}

describe("the appliers", () => {
  const layers = [
    { id: "background", type: "background" },
    { id: "water", type: "fill", "source-layer": "water" },
    {
      id: "label_city",
      type: "symbol",
      "source-layer": "place",
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
      },
    },
    {
      id: "highway-shield-non-us",
      type: "symbol",
      "source-layer": "transportation_name",
      layout: { "text-field": ["to-string", ["get", "ref"]] },
    },
  ];

  it("applyDarkPaint repaints every recognised layer", () => {
    const { target, paint } = fakeTarget(layers);
    applyDarkPaint(target);
    expect(paint).toContainEqual(["background", "background-color", NIGHT.ground]);
    expect(paint).toContainEqual(["water", "fill-color", NIGHT.water]);
    expect(paint).toContainEqual(["label_city", "text-color", NIGHT.ink]);
  });

  it("applyLabelLanguage rewrites name labels only, never shields", () => {
    const { target, layout } = fakeTarget(layers);
    applyLabelLanguage(target, "zh");
    expect(layout).toEqual([
      ["label_city", "text-field", labelTextField("zh")],
    ]);
  });
});
