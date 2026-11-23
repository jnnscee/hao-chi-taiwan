// List logic invariants for lib/places.ts, against the real 242-place
// snapshot. These are the counts every slice harness proved by hand
// (list controls, language toggle, Near me) — now permanent.

import { describe, expect, it } from "vitest";
import {
  ANY_DISTANCE_KM,
  DEFAULT_FILTERS,
  NEAR_RADIUS_OPTIONS,
  SEARCH_FIELDS,
  assignDisplayNumbers,
  batchFor,
  distanceKm,
  distinctValues,
  filterAndSortPlaces,
  formatDist,
  matchesQuery,
  placeDistanceKm,
  type ListFilters,
} from "../lib/places";
import { places } from "./helpers";

const view = (overrides: Partial<ListFilters> = {}) =>
  filterAndSortPlaces(places, { ...DEFAULT_FILTERS, ...overrides });

describe("fixture sanity", () => {
  it("holds the full snapshot: 242 places, 45 Recommended, 197 Want to Try", () => {
    expect(places).toHaveLength(242);
    expect(places.filter((p) => p.list_type === "recommended")).toHaveLength(45);
    expect(places.filter((p) => p.list_type === "want_to_try")).toHaveLength(197);
    expect(new Set(places.map((p) => p.legacy_id)).size).toBe(242);
  });
});

describe("tabs, search and dropdown filters", () => {
  it("tabs split 242 / 45 / 197", () => {
    expect(view({ tab: "all" })).toHaveLength(242);
    expect(view({ tab: "recommended" })).toHaveLength(45);
    expect(view({ tab: "want_to_try" })).toHaveLength(197);
  });

  it('search "noodle" finds exactly 14', () => {
    expect(view({ query: "noodle" })).toHaveLength(14);
  });

  it("Zuoying district holds 93 and Kaohsiung city 196", () => {
    expect(view({ district: "Zuoying" })).toHaveLength(93);
    expect(view({ city: "Kaohsiung" })).toHaveLength(196);
  });

  it('"Hot pot" cuisine holds exactly 4', () => {
    expect(view({ cuisine: "Hot pot" })).toHaveLength(4);
  });

  it("dropdown value sets match the data inventory (10 cities, 33 districts, 86 cuisines)", () => {
    expect(distinctValues(places, "city")).toHaveLength(10);
    expect(distinctValues(places, "district")).toHaveLength(33);
    expect(distinctValues(places, "cuisine")).toHaveLength(86);
  });

  it("filters compose: Zuoying + noodle is a subset of both", () => {
    const both = view({ district: "Zuoying", query: "noodle" });
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThanOrEqual(14);
    expect(both.every((p) => p.district === "Zuoying")).toBe(true);
  });
});

describe("matchesQuery / SEARCH_FIELDS (shared with the admin manager)", () => {
  it("SEARCH_FIELDS is the agreed nine fields", () => {
    expect([...SEARCH_FIELDS].sort()).toEqual(
      [
        "address_en",
        "address_zh",
        "city",
        "cuisine",
        "district",
        "gloss",
        "name_en",
        "name_rom",
        "name_zh",
      ].sort()
    );
  });

  it("empty or blank query matches everything", () => {
    expect(places.every((p) => matchesQuery(p, ""))).toBe(true);
    expect(places.every((p) => matchesQuery(p, "   "))).toBe(true);
  });

  it("is case-insensitive and scans gloss, cuisine and addresses, not just names", () => {
    const marugame = places.find((p) => p.legacy_id === "3")!;
    expect(matchesQuery(marugame, "UDON")).toBe(true); // cuisine/gloss
    expect(matchesQuery(marugame, "zuoying")).toBe(true); // district/address
    expect(matchesQuery(marugame, "definitely-not-there")).toBe(false);
  });

  it("a Chinese query matches Chinese fields", () => {
    const hits = places.filter((p) => matchesQuery(p, "火鍋"));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((p) => SEARCH_FIELDS.some((f) => String(p[f] ?? "").includes("火鍋")))).toBe(true);
  });
});

describe("positional numbering (Jenny's rule: numbers follow the view)", () => {
  it("assigns 1..N contiguously over the unfiltered view", () => {
    const displayed = view();
    const numbers = assignDisplayNumbers(displayed);
    displayed.forEach((p, i) => expect(numbers.get(p.legacy_id)).toBe(i + 1));
  });

  it("noodle renumbers 1..14", () => {
    const displayed = view({ query: "noodle" });
    const numbers = assignDisplayNumbers(displayed);
    expect(displayed.map((p) => numbers.get(p.legacy_id))).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1)
    );
  });

  it("A–Z sort renumbers by position, starting from the alphabetically first name", () => {
    const displayed = view({ sort: "name" });
    const numbers = assignDisplayNumbers(displayed);
    const names = displayed.map((p) => p.name_en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(numbers.get(displayed[0].legacy_id)).toBe(1);
    expect(numbers.get(displayed[displayed.length - 1].legacy_id)).toBe(242);
  });

  it("rating sort also renumbers positionally, highest first, unrated last", () => {
    const displayed = view({ sort: "rating" });
    const numbers = assignDisplayNumbers(displayed);
    expect(numbers.get(displayed[0].legacy_id)).toBe(1);
    const ratings = displayed.map((p) => p.rating_value);
    const firstNull = ratings.indexOf(null);
    if (firstNull >= 0) {
      expect(ratings.slice(firstNull).every((r) => r === null)).toBe(true);
    }
    const rated = ratings.filter((r): r is number => r !== null);
    expect(rated).toEqual([...rated].sort((a, b) => b - a));
  });

  it("batching continues the count across Show more (numbers come from the full view)", () => {
    const displayed = view({ query: "noodle" });
    const numbers = assignDisplayNumbers(displayed);
    const secondCardsBatch = displayed.slice(batchFor("cards"), batchFor("cards") * 2);
    expect(secondCardsBatch.map((p) => numbers.get(p.legacy_id))).toEqual([11, 12, 13, 14]);
    expect(batchFor("cards")).toBe(10);
    expect(batchFor("compact")).toBe(15);
  });
});

describe("Near me distances from Zuoying HSR (22.6871, 120.3056)", () => {
  const origin = { lat: 22.6871, lng: 120.3056 };

  it("radius counts are 19 / 99 / 127 / 192 / 196 for 1 / 3 / 5 / 10 / 25 km", () => {
    const expected: Record<number, number> = { 1: 19, 3: 99, 5: 127, 10: 192, 25: 196 };
    for (const radius of NEAR_RADIUS_OPTIONS) {
      expect(
        view({ origin, nearActive: true, radiusKm: radius }),
        `radius ${radius} km`
      ).toHaveLength(expected[radius]);
    }
  });

  it('"Any distance" filters nothing out', () => {
    expect(view({ origin, nearActive: true, radiusKm: ANY_DISTANCE_KM })).toHaveLength(242);
  });

  it("Nearest sort puts r184 Wang Yan Ka Fei first", () => {
    const sorted = view({ origin, sort: "nearest" });
    expect(sorted[0].legacy_id).toBe("r184");
    const distances = sorted.map((p) => placeDistanceKm(p, origin));
    const known = distances.filter((d): d is number => d !== null);
    expect(known).toEqual([...known].sort((a, b) => a - b));
  });

  it("Nearest without a location falls back to Recommended order", () => {
    const withOrigin = view({ origin: null, sort: "nearest" });
    const recommended = view({ sort: "recommended" });
    expect(withOrigin.map((p) => p.legacy_id)).toEqual(recommended.map((p) => p.legacy_id));
  });

  it("haversine sanity: 0.01° of latitude is ~1.112 km; formatDist follows the live formats", () => {
    expect(distanceKm(22.6871, 120.3056, 22.6971, 120.3056)).toBeCloseTo(1.112, 2);
    expect(distanceKm(22.6871, 120.3056, 22.6871, 120.3056)).toBe(0);
    expect(formatDist(0.85)).toBe("850 m");
    expect(formatDist(1.24)).toBe("1.2 km");
    expect(formatDist(12.4)).toBe("12 km");
    expect(formatDist(null)).toBe("");
  });
});
