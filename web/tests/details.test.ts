// Pure-helper invariants for lib/details.ts: directions, deep-link
// parsing, the saved set, the "Last checked" label and the calendar
// link — the composition the details slice's harness proved by hand.

import { describe, expect, it } from "vitest";
import {
  calendarUrl,
  directionsUrl,
  lastCheckedLabel,
  lastCheckedText,
  parseSavedIds,
  placeIdFromSearch,
  toggleSavedId,
} from "../lib/details";
import { makePlace } from "./helpers";

describe("directionsUrl", () => {
  it("prefers coordinates", () => {
    const place = makePlace({ lat: 22.6871, lng: 120.3056 });
    expect(directionsUrl(place)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent("22.6871,120.3056")
    );
  });

  it("falls back to the English address, then the English name", () => {
    const byAddress = makePlace({ lat: null, lng: null });
    expect(directionsUrl(byAddress)).toContain(
      encodeURIComponent("1 Test Rd, Zuoying District, Kaohsiung")
    );
    const byName = makePlace({ lat: null, lng: null, address_en: null });
    expect(directionsUrl(byName)).toContain(encodeURIComponent("Test Place"));
  });
});

describe("placeIdFromSearch (legacy ?place= deep links)", () => {
  it("extracts the id and ignores other parameters", () => {
    expect(placeIdFromSearch("?place=r12&x=1")).toBe("r12");
    expect(placeIdFromSearch("?place=41")).toBe("41");
  });

  it("returns null when there is no usable id", () => {
    expect(placeIdFromSearch("?x=1")).toBeNull();
    expect(placeIdFromSearch("?place=")).toBeNull();
    expect(placeIdFromSearch("")).toBeNull();
  });
});

describe("the saved set", () => {
  it("parseSavedIds tolerates anything unusable", () => {
    expect(parseSavedIds(null)).toEqual([]);
    expect(parseSavedIds("")).toEqual([]);
    expect(parseSavedIds("not json")).toEqual([]);
    expect(parseSavedIds('{"a":1}')).toEqual([]);
    expect(parseSavedIds('["1","r2",3,null]')).toEqual(["1", "r2"]);
  });

  it("toggleSavedId adds, removes, and never mutates its input", () => {
    const start = ["r1"];
    expect(toggleSavedId(start, "r2")).toEqual(["r1", "r2"]);
    expect(toggleSavedId(start, "r1")).toEqual([]);
    expect(start).toEqual(["r1"]);
  });
});

describe("last checked labels", () => {
  it("formats an ISO date as 'Nov 2026'", () => {
    expect(lastCheckedLabel("2026-11-20")).toBe("Nov 2026");
    expect(lastCheckedLabel("2026-01-05")).toBe("Jan 2026");
  });

  it("rejects missing and invalid dates", () => {
    expect(lastCheckedLabel(null)).toBeNull();
    expect(lastCheckedLabel("")).toBeNull();
    expect(lastCheckedLabel("2026-13-01")).toBeNull();
    expect(lastCheckedLabel("2026-00-10")).toBeNull();
    expect(lastCheckedLabel("Nov 2026")).toBeNull();
  });

  it("composes the full line in both languages, in the live app's wording", () => {
    expect(lastCheckedText("2026-11-20", "en")).toBe("Last checked Nov 2026");
    expect(lastCheckedText("2026-11-20", "zh")).toBe("最後確認：2026 年 11 月");
    expect(lastCheckedText(null, "en")).toBeNull();
  });
});

describe("calendarUrl", () => {
  it("builds a 1-hour Asia/Taipei template event carrying the place's page link", () => {
    const place = makePlace();
    const url = new URL(
      calendarUrl(place, "https://example.com/place/r999", new Date("2026-11-22T10:30:00Z"))
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("ctz")).toBe("Asia/Taipei");
    expect(url.searchParams.get("text")).toBe("Test Place");
    expect(url.searchParams.get("location")).toBe(
      "1 Test Rd, Zuoying District, Kaohsiung"
    );
    expect(url.searchParams.get("details")).toBe(
      "View in Hao Chi Taiwan: https://example.com/place/r999"
    );
    const dates = url.searchParams.get("dates")!;
    expect(dates).toMatch(/^\d{8}T\d{6}\/\d{8}T\d{6}$/);
    // 10:30 UTC = 18:30 Taipei; the event starts at the next whole
    // hour (19:00 Taipei) and runs exactly one hour.
    expect(dates.startsWith("20261122T190000")).toBe(true);
    expect(dates.endsWith("20261122T200000")).toBe(true);
  });
});
