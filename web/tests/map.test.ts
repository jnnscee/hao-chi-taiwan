// Map marker invariants for lib/map.ts: the pins are drawn from the
// same displayed array and the same numbers map as the list, so a
// pin's number can never disagree with the place's list number.

import { describe, expect, it } from "vitest";
import {
  CLUSTER_RADIUS_PX,
  NUMBERED_PIN_LIMIT,
  TAIWAN_BOUNDS,
  buildMapMarkers,
  clusterMarkers,
  fitBounds,
  frameBounds,
  markerBounds,
  markerSetSignature,
  projectToPixels,
  unprojectFromPixels,
} from "../lib/map";
import {
  DEFAULT_FILTERS,
  assignDisplayNumbers,
  filterAndSortPlaces,
} from "../lib/places";
import { places } from "./helpers";

describe("buildMapMarkers", () => {
  it("the full 242 render as dots, none missing coordinates", () => {
    const displayed = filterAndSortPlaces(places, DEFAULT_FILTERS);
    const set = buildMapMarkers(displayed, assignDisplayNumbers(displayed));
    expect(set.markers).toHaveLength(242);
    expect(set.missingCoords).toHaveLength(0);
    expect(set.markers.every((m) => m.kind === "dot")).toBe(true);
  });

  it("the noodle set renders 14 numbered pins whose numbers equal the list numbers", () => {
    const displayed = filterAndSortPlaces(places, {
      ...DEFAULT_FILTERS,
      query: "noodle",
    });
    const numbers = assignDisplayNumbers(displayed);
    const set = buildMapMarkers(displayed, numbers);
    expect(set.markers).toHaveLength(14);
    expect(set.markers.every((m) => m.kind === "numbered")).toBe(true);
    for (const marker of set.markers) {
      expect(marker.number).toBe(numbers.get(marker.place.legacy_id));
    }
    expect(set.markers.map((m) => m.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1)
    );
  });

  it("the numbered/dot threshold is exact at the limit", () => {
    const at = places.slice(0, NUMBERED_PIN_LIMIT);
    const over = places.slice(0, NUMBERED_PIN_LIMIT + 1);
    expect(
      buildMapMarkers(at, assignDisplayNumbers(at)).markers.every(
        (m) => m.kind === "numbered"
      )
    ).toBe(true);
    expect(
      buildMapMarkers(over, assignDisplayNumbers(over)).markers.every(
        (m) => m.kind === "dot"
      )
    ).toBe(true);
  });

  it("a place with no coordinates stays in the list but off the map", () => {
    const noCoords = { ...places[0], lat: null, lng: null };
    const displayed = [noCoords, ...places.slice(1, 5)];
    const set = buildMapMarkers(displayed, assignDisplayNumbers(displayed));
    expect(set.missingCoords.map((p) => p.legacy_id)).toEqual([noCoords.legacy_id]);
    expect(set.markers).toHaveLength(4);
  });
});

describe("bounds and set identity", () => {
  it("markerBounds covers every marker; fitBounds matches when the user point is not fitted", () => {
    const displayed = filterAndSortPlaces(places, {
      ...DEFAULT_FILTERS,
      query: "noodle",
    });
    const set = buildMapMarkers(displayed, assignDisplayNumbers(displayed), {
      lat: 22.6871,
      lng: 120.3056,
      fit: false,
    });
    const bounds = markerBounds(set.markers)!;
    for (const m of set.markers) {
      expect(m.lat).toBeGreaterThanOrEqual(bounds.south);
      expect(m.lat).toBeLessThanOrEqual(bounds.north);
      expect(m.lng).toBeGreaterThanOrEqual(bounds.west);
      expect(m.lng).toBeLessThanOrEqual(bounds.east);
    }
    expect(fitBounds(set)).toEqual(bounds);
    expect(markerBounds([])).toBeNull();
  });

  it("a fitted user point extends the bounds; an unfitted one never changes the signature", () => {
    const displayed = filterAndSortPlaces(places, {
      ...DEFAULT_FILTERS,
      query: "noodle",
    });
    const numbers = assignDisplayNumbers(displayed);
    const plain = buildMapMarkers(displayed, numbers);
    const sortOnly = buildMapMarkers(displayed, numbers, {
      lat: 22.6871,
      lng: 120.3056,
      fit: false,
    });
    const fitted = buildMapMarkers(displayed, numbers, {
      lat: 22.6871,
      lng: 120.3056,
      fit: true,
    });
    expect(markerSetSignature(sortOnly)).toBe(markerSetSignature(plain));
    expect(markerSetSignature(fitted)).not.toBe(markerSetSignature(plain));
    const bounds = fitBounds(fitted)!;
    expect(bounds.south).toBeLessThanOrEqual(22.6871);
    expect(bounds.north).toBeGreaterThanOrEqual(22.6871);
  });

  it("the whole-Taiwan fallback frame contains every place", () => {
    for (const p of places) {
      expect(p.lat!).toBeGreaterThanOrEqual(TAIWAN_BOUNDS.south);
      expect(p.lat!).toBeLessThanOrEqual(TAIWAN_BOUNDS.north);
      expect(p.lng!).toBeGreaterThanOrEqual(TAIWAN_BOUNDS.west);
      expect(p.lng!).toBeLessThanOrEqual(TAIWAN_BOUNDS.east);
    }
  });

  it("an empty set frames whole Taiwan; a fitted user point still frames the user", () => {
    const empty = buildMapMarkers([], new Map());
    expect(frameBounds(empty)).toEqual(TAIWAN_BOUNDS);
    const userOnly = buildMapMarkers([], new Map(), {
      lat: 22.6871,
      lng: 120.3056,
      fit: true,
    });
    expect(frameBounds(userOnly)).toEqual({
      south: 22.6871,
      west: 120.3056,
      north: 22.6871,
      east: 120.3056,
    });
    const noodle = buildMapMarkers(
      filterAndSortPlaces(places, { ...DEFAULT_FILTERS, query: "noodle" }),
      assignDisplayNumbers(
        filterAndSortPlaces(places, { ...DEFAULT_FILTERS, query: "noodle" })
      )
    );
    expect(frameBounds(noodle)).toEqual(markerBounds(noodle.markers));
  });
});

describe("clustering for large sets", () => {
  const all = filterAndSortPlaces(places, DEFAULT_FILTERS);
  const allSet = buildMapMarkers(all, assignDisplayNumbers(all));

  it("projection round-trips and matches the known Mercator scale", () => {
    // At zoom 0 the world is one 256px tile: the origin sits centred.
    expect(projectToPixels(0, 0, 0)).toEqual({ x: 128, y: 128 });
    for (const p of places.slice(0, 25)) {
      const px = projectToPixels(p.lat!, p.lng!, 12);
      const back = unprojectFromPixels(px.x, px.y, 12);
      expect(back.lat).toBeCloseTo(p.lat!, 9);
      expect(back.lng).toBeCloseTo(p.lng!, 9);
    }
  });

  it("cluster counts sum to the set size at whole-Taiwan zooms, every place grouped exactly once", () => {
    for (const zoom of [7, 8, 9]) {
      const groups = clusterMarkers(allSet.markers, zoom);
      expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(242);
      const seen = groups.flatMap((g) => g.markers.map((m) => m.place.legacy_id));
      expect(new Set(seen).size).toBe(242);
      // The Kaohsiung mass must actually cluster (badges exist), and
      // grouping must be deterministic for the same input.
      expect(groups.some((g) => g.count > 1)).toBe(true);
      expect(clusterMarkers(allSet.markers, zoom)).toEqual(groups);
    }
  });

  it("a >60 filtered set clusters with summing counts (Zuoying, 93)", () => {
    const displayed = filterAndSortPlaces(places, {
      ...DEFAULT_FILTERS,
      district: "Zuoying",
    });
    expect(displayed).toHaveLength(93);
    const set = buildMapMarkers(displayed, assignDisplayNumbers(displayed));
    const groups = clusterMarkers(set.markers, 11);
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(93);
  });

  it("clusters separate as the visitor zooms in", () => {
    const whole = clusterMarkers(allSet.markers, 8);
    const street = clusterMarkers(allSet.markers, 15);
    expect(street.length).toBeGreaterThan(whole.length);
    expect(street.reduce((sum, g) => sum + g.count, 0)).toBe(242);
  });

  it("group centres sit among their members", () => {
    for (const group of clusterMarkers(allSet.markers, 8)) {
      const bounds = markerBounds(group.markers)!;
      expect(group.lat).toBeGreaterThanOrEqual(bounds.south - 0.01);
      expect(group.lat).toBeLessThanOrEqual(bounds.north + 0.01);
      expect(group.lng).toBeGreaterThanOrEqual(bounds.west - 0.01);
      expect(group.lng).toBeLessThanOrEqual(bounds.east + 0.01);
    }
  });

  it("the ≤60 path never clusters: noodle stays 14 individual numbered markers", () => {
    const displayed = filterAndSortPlaces(places, {
      ...DEFAULT_FILTERS,
      query: "noodle",
    });
    const numbers = assignDisplayNumbers(displayed);
    const set = buildMapMarkers(displayed, numbers);
    expect(set.markers).toHaveLength(14);
    expect(set.markers.every((m) => m.kind === "numbered")).toBe(true);
    // The component only calls clusterMarkers in dot mode; even if it
    // did, the numbered markers keep their list numbers untouched.
    for (const marker of set.markers) {
      expect(marker.number).toBe(numbers.get(marker.place.legacy_id));
    }
    expect(CLUSTER_RADIUS_PX).toBeGreaterThan(0);
  });
});
