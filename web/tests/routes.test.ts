// Address helpers for lib/routes.ts: the EN/中文 toggle navigates
// between path twins, and the router's "/index" alias for the root
// route must never leak into a link (it produced /zh/index, a 404 —
// the toggle bug Jenny caught in the design fix batch).

import { describe, expect, it } from "vitest";
import {
  contactPath,
  homePath,
  infoPath,
  langFromPathname,
  normalizePathname,
  placePath,
  placeUrl,
  twinPath,
} from "../lib/routes";

describe("path builders", () => {
  it("home, place, info and contact paths in both languages", () => {
    expect(homePath("en")).toBe("/");
    expect(homePath("zh")).toBe("/zh");
    expect(placePath("en", "r6")).toBe("/place/r6");
    expect(placePath("zh", "r6")).toBe("/zh/place/r6");
    expect(infoPath("en", "privacy")).toBe("/privacy");
    expect(infoPath("zh", "privacy")).toBe("/zh/privacy");
    expect(contactPath("en")).toBe("/contact");
    expect(contactPath("zh")).toBe("/zh/contact");
  });

  it("placeUrl is the one absolute, language-matched place address", () => {
    expect(placeUrl("https://hao-chi-taiwan-next.vercel.app", "en", "r6")).toBe(
      "https://hao-chi-taiwan-next.vercel.app/place/r6"
    );
    expect(placeUrl("https://hao-chi-taiwan-next.vercel.app", "zh", "41")).toBe(
      "https://hao-chi-taiwan-next.vercel.app/zh/place/41"
    );
  });
});

describe("normalizePathname and langFromPathname", () => {
  it("the /index aliases fold back to the home paths", () => {
    expect(normalizePathname("/index")).toBe("/");
    expect(normalizePathname("/zh/index")).toBe("/zh");
    expect(normalizePathname("/place/r6")).toBe("/place/r6");
    expect(normalizePathname("/")).toBe("/");
  });

  it("language comes from the path, aliases included", () => {
    expect(langFromPathname("/")).toBe("en");
    expect(langFromPathname("/index")).toBe("en");
    expect(langFromPathname("/zh")).toBe("zh");
    expect(langFromPathname("/zh/index")).toBe("zh");
    expect(langFromPathname("/zh/place/r6")).toBe("zh");
    expect(langFromPathname("/place/r6")).toBe("en");
  });
});

describe("twinPath pairs, both directions", () => {
  const pairs: Array<[string, string]> = [
    ["/", "/zh"],
    ["/place/r6", "/zh/place/r6"],
    ["/place/41", "/zh/place/41"],
    ["/privacy", "/zh/privacy"],
    ["/about", "/zh/about"],
    ["/terms", "/zh/terms"],
    ["/contact", "/zh/contact"],
    ["/admin", "/zh/admin"],
  ];

  it("every page twins to the other language and back", () => {
    for (const [en, zh] of pairs) {
      expect(twinPath(en, "zh"), `${en} -> zh`).toBe(zh);
      expect(twinPath(zh, "en"), `${zh} -> en`).toBe(en);
    }
  });

  it("asking for the current language returns the normalised path unchanged", () => {
    expect(twinPath("/place/r6", "en")).toBe("/place/r6");
    expect(twinPath("/zh/place/r6", "zh")).toBe("/zh/place/r6");
    expect(twinPath("/", "en")).toBe("/");
    expect(twinPath("/zh", "zh")).toBe("/zh");
  });

  it("the /index aliases twin correctly (the original toggle bug)", () => {
    expect(twinPath("/index", "zh")).toBe("/zh");
    expect(twinPath("/index", "en")).toBe("/");
    expect(twinPath("/zh/index", "en")).toBe("/");
    expect(twinPath("/zh/index", "zh")).toBe("/zh");
  });
});
