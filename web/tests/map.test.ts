// Map marker invariants for lib/map.ts: the pins are drawn from the
// same displayed array and the same numbers map as the list, so a
// pin's number can never disagree with the place's list number.

import { describe, expect, it } from "vitest";
import {
  NUMBERED_PIN_LIMIT,
  TAIWAN_BOUNDS,
  buildMapMarkers,
  fitBounds,
  markerBounds,
  markerSetSignature,
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
});
