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

  it("the Phase B restorations carry v1's exact wording (B-1, B-2, B-7)", () => {
    // B-1, the Saved view.
    expect(STRINGS.en.saved_view).toBe("Saved");
    expect(STRINGS.zh.saved_view).toBe("已收藏");
    expect(STRINGS.en.saved_device_only).toBe("Saved on this device only");
    expect(STRINGS.zh.saved_device_only).toBe("只存在這台裝置上");
    expect(STRINGS.en.saved_empty).toBe(
      "No saved places yet — tap Save on any place and it will show up here."
    );
    expect(STRINGS.zh.saved_empty).toBe(
      "還沒有收藏的店 — 在任何一家店點「收藏」，就會出現在這裡。"
    );
    expect(STRINGS.en.saved_showing(1)).toBe("Showing your 1 saved place");
    expect(STRINGS.en.saved_showing(3)).toBe("Showing your 3 saved places");
    expect(STRINGS.zh.saved_showing(3)).toBe("共 3 家已收藏的店");
    // B-2, the directions modes and hint.
    expect(STRINGS.en.dir_transit).toBe("MRT / Bus");
    expect(STRINGS.en.dir_walking).toBe("Walking");
    expect(STRINGS.en.dir_biking).toBe("Biking");
    expect(STRINGS.en.dir_driving).toBe("Driving / Taxi");
    expect(STRINGS.zh.dir_transit).toBe("捷運 / 公車");
    expect(STRINGS.zh.dir_walking).toBe("步行");
    expect(STRINGS.zh.dir_biking).toBe("騎車");
    expect(STRINGS.zh.dir_driving).toBe("開車 / 計程車");
    // B-7, the hero intro, with the live counts interpolated.
    expect(STRINGS.en.lede(45, 197)).toBe(
      "Jenny's food guide to Taiwan — 45 places she has tried, tested and recommends, plus 197 more she wants to try. Most are in Kaohsiung, from mom-and-pop stalls to old favourites."
    );
    expect(STRINGS.zh.lede(45, 197)).toBe(
      "Jenny 的台灣美食指南 — 45 家她親自吃過、真心推薦的店，加上 197 家她想去試試的店。大部分都在高雄，從小吃攤到老字號都有。"
    );
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
