// Language-table coverage for lib/i18n.ts: every district, cuisine
// and city value that actually occurs in the data must have a real
// Chinese label — a miss would silently fall back to the English
// value in the 中文 dropdowns (the language slice's zero-miss rule).

import { describe, expect, it } from "vitest";
import {
  STRINGS,
  cityLabel,
  cuisineLabel,
  districtLabel,
  langFromSearch,
  parseStoredLang,
} from "../lib/i18n";
import { distinctValues } from "../lib/places";
import { places } from "./helpers";

describe("Chinese labels cover every value in the data", () => {
  it("all 33 districts have a Chinese label that is actually applied", () => {
    for (const district of distinctValues(places, "district")) {
      const label = STRINGS.zh.district_names[district];
      expect(label, `district ${district}`).toBeTruthy();
      expect(districtLabel("zh", district)).toBe(label);
      expect(label).not.toBe(district);
    }
  });

  it("all 86 cuisines have a Chinese label that is actually applied", () => {
    for (const cuisine of distinctValues(places, "cuisine")) {
      const label = STRINGS.zh.cuisine_names[cuisine];
      expect(label, `cuisine ${cuisine}`).toBeTruthy();
      expect(cuisineLabel("zh", cuisine)).toBe(label);
      expect(label).not.toBe(cuisine);
    }
  });

  it("all 10 cities have a Chinese label that is actually applied", () => {
    for (const city of distinctValues(places, "city")) {
      const label = STRINGS.zh.city_names[city];
      expect(label, `city ${city}`).toBeTruthy();
      expect(cityLabel("zh", city)).toBe(label);
      expect(label).not.toBe(city);
    }
  });

  it("English labels resolve to the values themselves", () => {
    for (const city of distinctValues(places, "city")) {
      expect(cityLabel("en", city)).toBe(STRINGS.en.city_names[city] ?? city);
    }
    for (const district of distinctValues(places, "district")) {
      expect(districtLabel("en", district)).toBe(
        STRINGS.en.district_names[district] ?? district
      );
    }
  });

  it("unknown values fall back to themselves in both languages", () => {
    expect(districtLabel("zh", "Nowhere District")).toBe("Nowhere District");
    expect(cuisineLabel("en", "Unknown cuisine")).toBe("Unknown cuisine");
  });

  it("the quiet number wording: EN 'No. 12', ZH '第 12 家'", () => {
    expect(STRINGS.en.place_no(12)).toBe("No. 12");
    expect(STRINGS.zh.place_no(12)).toBe("第 12 家");
  });
});

describe("language resolution helpers", () => {
  it("langFromSearch reads only an explicit en/zh", () => {
    expect(langFromSearch("?lang=zh")).toBe("zh");
    expect(langFromSearch("?lang=en&place=r6")).toBe("en");
    expect(langFromSearch("?lang=fr")).toBeNull();
    expect(langFromSearch("")).toBeNull();
  });

  it("parseStoredLang accepts only en/zh", () => {
    expect(parseStoredLang("zh")).toBe("zh");
    expect(parseStoredLang("en")).toBe("en");
    expect(parseStoredLang("ZH")).toBeNull();
    expect(parseStoredLang(null)).toBeNull();
    expect(parseStoredLang("{broken")).toBeNull();
  });
});
