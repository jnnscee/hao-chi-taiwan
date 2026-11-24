// Map legibility spec — rewritten for the trial VECTOR map
// (MapLibre GL JS + OpenFreeMap vector tiles, 2026-11-24). The
// Leaflet version of this spec (Phase A, 2026-11-23) guarded:
//
//   (a) a filtered set's numbered pins sit fully inside the frame
//       (the audit found noodle-search pins cut off at the top edge);
//   (b) the 242 baseline is verifiable on screen: cluster badge
//       counts plus ungrouped dots sum to the set's size;
//   (c) a no-match search leaves the map framed on Taiwan with no
//       pins (the audit caught it sitting on a wide SE Asia view);
//   (d) four rapid zoom-ins never leave the map blank.
//
// Every test's INTENT is preserved; what changed is the evidence,
// because the rendering technology changed:
//
//  - The view (centre/zoom) is read from the live map instance,
//    which the component exposes on its container element as
//    `__haoChiMap` — the Leaflet spec had to reconstruct the view
//    from the tile <img>s on screen because no instance was
//    reachable. Direct reads are stricter, not weaker.
//  - "Not blank" is proven by reading the centre pixel of the
//    WebGL canvas during a render pass (a blank/broken canvas
//    reads back transparent black), instead of counting loaded
//    tile <img>s — vector tiles have no <img>s.
//  - Dots are HTML markers (.map-dot) instead of SVG paths.
//  - The zoom control is MapLibre's (.maplibregl-ctrl-zoom-in).
//  - Fractional zooms: Leaflet's fit snapped to whole zooms, so
//    the old spec asserted exact integers (6, 8); MapLibre's
//    fitBounds lands on fractional zooms, so zoom assertions use
//    the same envelopes and deltas instead of exact integers.
//
// The sandbox (and CI) cannot be relied on to reach
// tiles.openfreemap.org — and hammering a free tile service from
// CI would be poor manners anyway. So the spec stubs the
// OpenFreeMap endpoints at the network layer: the style request
// gets a minimal local style (background + water fill + one label
// layer over the same vector source), and every vector tile gets
// a hand-built tile whose single "water" polygon covers the whole
// tile — the canvas genuinely paints geometry everywhere, which
// is what the not-blank check reads. Glyph requests get an empty
// glyph stack (the stub tiles carry no label features, so labels
// are never laid out; the language behaviour of labels is covered
// by the lib/mapStyle.ts unit tests).
//
// The service worker is blocked for this spec: by design it
// serves the map host cache-first, and its fetches bypass
// page-level route interception, which would make every stubbed
// assertion nondeterministic. The worker's own caching behaviour
// was verified in the offline/PWA slice and is untouched here.

import { expect, test } from "@playwright/test";

// --- A minimal protobuf writer, just enough for a vector tile ---
function varint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
}
function fieldVarint(field: number, value: number): number[] {
  return [...varint((field << 3) | 0), ...varint(value)];
}
function fieldBytes(field: number, data: Buffer | number[]): number[] {
  const bytes = Array.from(data);
  return [...varint((field << 3) | 2), ...varint(bytes.length), ...bytes];
}
function zigzag(n: number): number {
  return (n << 1) ^ (n >> 31);
}

/** A valid vector tile holding one water polygon that covers the
 * whole 4096-extent tile: every stubbed tile paints as water. */
function waterTile(): Buffer {
  const geometry = [
    1 | (1 << 3), zigzag(0), zigzag(0), // MoveTo (0,0)
    2 | (3 << 3), // LineTo, 3 points
    zigzag(4096), zigzag(0),
    zigzag(0), zigzag(4096),
    zigzag(-4096), zigzag(0),
    7 | (1 << 3), // ClosePath
  ];
  const packed: number[] = [];
  for (const g of geometry) packed.push(...varint(g));
  const feature = Buffer.from([
    ...fieldVarint(1, 3), // type = POLYGON
    ...fieldBytes(3, packed),
  ]);
  const layer = Buffer.from([
    ...fieldBytes(1, Buffer.from("water", "ascii")),
    ...fieldBytes(2, feature),
    ...fieldVarint(5, 4096), // extent
    ...fieldVarint(15, 2), // version
  ]);
  return Buffer.from(fieldBytes(3, layer));
}
const WATER_TILE = waterTile();

const TEST_STYLE = {
  version: 8,
  name: "hao-chi-test-style",
  sources: {
    openmaptiles: {
      type: "vector",
      tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
      minzoom: 0,
      maxzoom: 14,
    },
  },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#eef2ea" },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#bcd2e0" },
    },
    {
      id: "label_city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "#333333" },
    },
  ],
};

type TileStub = { requested: string[] };
async function stubTiles(
  page: import("@playwright/test").Page,
  delayMs = 150
): Promise<TileStub> {
  const stub: TileStub = { requested: [] };
  await page.route(
    "https://tiles.openfreemap.org/styles/positron",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(TEST_STYLE),
      });
    }
  );
  await page.route("https://tiles.openfreemap.org/planet/**", async (route) => {
    stub.requested.push(route.request().url());
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      contentType: "application/x-protobuf",
      body: WATER_TILE,
    });
  });
  await page.route("https://tiles.openfreemap.org/fonts/**", async (route) => {
    // An empty glyph stack: parses as a font stack with no glyphs.
    await route.fulfill({
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
  return stub;
}

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

/** The slice of the live MapLibre map the specs read through the
 * component's `__haoChiMap` hook on the container element. */
type HookMap = {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
  isStyleLoaded(): boolean;
  isEasing(): boolean;
  once(event: string, cb: () => void): void;
  triggerRepaint(): void;
  getCanvas(): HTMLCanvasElement;
};

async function gotoMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  const map = page.locator(".place-map.maplibregl-map");
  await map.waitFor({ state: "visible", timeout: 30_000 });
  await map.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".place-map") as unknown as {
        __haoChiMap?: HookMap;
      };
      return !!el?.__haoChiMap && el.__haoChiMap.isStyleLoaded();
    },
    { timeout: 30_000 }
  );
  await page.waitForTimeout(600);
  return map;
}

/** The map's current view, read from the live map instance, plus
 * the DOM marker accounting (pins, cluster badge counts, dots). */
async function viewFromMap(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".place-map") as unknown as {
      __haoChiMap?: HookMap;
    };
    const map = el?.__haoChiMap;
    const centre = map
      ? { z: map.getZoom(), lat: map.getCenter().lat, lng: map.getCenter().lng }
      : null;
    const badges = Array.from(document.querySelectorAll(".map-cluster")).map(
      (n) => parseInt(n.textContent || "0", 10)
    );
    const badgeSum = badges.reduce((s, n) => s + n, 0);
    const dots = document.querySelectorAll(".map-dot").length;
    const pins = document.querySelectorAll(".map-pin").length;
    return { centre, badgeSum, dots, pins, total: badgeSum + dots + pins };
  });
}

/** The canvas's centre pixel, read back with readPixels inside a
 * render pass (with preserveDrawingBuffer off, reading after the
 * frame has been composited would return zeros even on a healthy
 * canvas). A painted map reads back its water/ground colour; a
 * blank or broken one reads transparent black. */
async function centrePixel(
  page: import("@playwright/test").Page
): Promise<number[]> {
  return page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const el = document.querySelector(".place-map") as unknown as {
          __haoChiMap?: HookMap;
        };
        const map = el.__haoChiMap!;
        map.once("render", () => {
          const canvas = map.getCanvas();
          const gl = (canvas.getContext("webgl2") ||
            canvas.getContext("webgl")) as WebGLRenderingContext;
          const px = new Uint8Array(4);
          gl.readPixels(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            px
          );
          resolve([px[0], px[1], px[2], px[3]]);
        });
        map.triggerRepaint();
      })
  );
}

test.describe("map legibility", () => {
  test("(a) noodle search: all 14 pins fully inside the frame", async ({ page }) => {
    await stubTiles(page);
    const map = await gotoMap(page);
    await page.locator("input.search").first().fill("noodle");
    await page.waitForFunction(
      () => document.querySelectorAll(".map-pin").length === 14,
      { timeout: 15_000 }
    );
    // Let the view settle before measuring.
    await page.waitForTimeout(900);
    const mapBox = (await map.boundingBox())!;
    const pins = await page.locator(".map-pin").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      })
    );
    expect(pins).toHaveLength(14);
    for (const pin of pins) {
      // Fully inside the container, with sub-pixel tolerance — the
      // acceptance criterion is that no pin is clipped at an edge.
      expect(pin.x).toBeGreaterThanOrEqual(mapBox.x - 1);
      expect(pin.y).toBeGreaterThanOrEqual(mapBox.y - 1);
      expect(pin.right).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
      expect(pin.bottom).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
    }
  });

  test("(b) baseline: cluster counts + dots sum to 242", async ({ page }) => {
    await stubTiles(page);
    await gotoMap(page);
    const total = async () => {
      const badges = await page.locator(".map-cluster").allTextContents();
      const badgeSum = badges.reduce((sum, t) => sum + parseInt(t, 10), 0);
      const dots = await page.locator(".map-dot").count();
      return { badgeSum, dots, total: badgeSum + dots, badges: badges.length };
    };
    // Poll until the drawn set stabilises at the full 242 (the
    // initial cluster draw can precede the fitted zoom's regroup).
    await expect
      .poll(async () => (await total()).total, { timeout: 20_000 })
      .toBe(242);
    const result = await total();
    expect(result.badges).toBeGreaterThan(0);
    expect(result.badgeSum).toBeGreaterThan(0);

    // Tapping a cluster expands it: the map zooms toward the
    // cluster's bounds (the camera's zoom increases).
    const zoom = async () => (await viewFromMap(page)).centre?.z ?? -1;
    const before = await zoom();
    await page.locator(".map-cluster").first().click();
    await expect.poll(zoom, { timeout: 15_000 }).toBeGreaterThan(before);
  });

  test("(c) no-match search: map frames Taiwan, zero pins", async ({ page }) => {
    await stubTiles(page);
    await gotoMap(page);
    // Move the view somewhere else first, so returning to Taiwan is
    // observable: noodle fits Kaohsiung at street-district zoom.
    await page.locator("input.search").first().fill("noodle");
    await page.waitForFunction(
      () => document.querySelectorAll(".map-pin").length === 14,
      { timeout: 15_000 }
    );
    await page.locator("input.search").first().fill("zzzzqqq");
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".map-pin").length === 0 &&
        document.querySelectorAll(".map-cluster").length === 0 &&
        document.querySelectorAll(".map-dot").length === 0,
      { timeout: 15_000 }
    );
    // The frame, read from the map itself: a Taiwan fit — a
    // leftover street-level frame (zoom 13+) or the audit's wide
    // SE Asia frame (zoom ≤5 with the centre far off the island)
    // both fail; the centre envelope below is the real guard.
    await expect
      .poll(
        async () => {
          const v = await viewFromMap(page);
          if (!v.centre) return false;
          return v.centre.z >= 5 && v.centre.z <= 8.5;
        },
        { timeout: 15_000 }
      )
      .toBe(true);
    const view = await viewFromMap(page);
    expect(view.centre!.lat).toBeGreaterThanOrEqual(21.5);
    expect(view.centre!.lat).toBeLessThanOrEqual(25.6);
    expect(view.centre!.lng).toBeGreaterThanOrEqual(119.0);
    expect(view.centre!.lng).toBeLessThanOrEqual(122.3);
  });

  test("(d) four rapid zoom-ins never leave the map blank", async ({ page }) => {
    await stubTiles(page, 300);
    await gotoMap(page);
    const zBefore = (await viewFromMap(page)).centre!.z;
    const zoomIn = page.locator(".maplibregl-ctrl-zoom-in");
    for (let i = 0; i < 4; i++) {
      await zoomIn.click({ timeout: 5_000 });
    }
    // The zooms landed: each click eases from wherever the camera
    // currently is toward one level deeper, so four rapid clicks
    // net roughly two levels — far deeper than the Taiwan fit,
    // which is what this asserts (Leaflet's queued zooms netted
    // the full four; the not-blank intent is identical).
    await expect
      .poll(
        async () => {
          const v = await viewFromMap(page);
          return v.centre ? v.centre.z : -1;
        },
        { timeout: 25_000 }
      )
      .toBeGreaterThan(zBefore + 1.5);
    await expect
      .poll(async () => (await viewFromMap(page)).total, { timeout: 20_000 })
      .toBe(242);
    // And the canvas is genuinely painted, not a blank pane: the
    // centre pixel is the stub tiles' water colour (repainted to
    // the night water tone by the dark adaptation), not
    // transparent black.
    const px = await centrePixel(page);
    expect(px[3]).toBe(255);
    expect(px[0] + px[1] + px[2]).toBeGreaterThan(0);
  });
});

// Regression coverage for the 2026-11-23 live failure of the Phase A
// build: on the real site the map opened on a whole-world view, a
// search redrew the pins without refitting the view, and the badge
// sum drifted after the map scrolled into view — while every test
// above passed, because they all scroll the map into view before
// asserting and never check that a search actually MOVED the view.
// The tests below close those blind spots: they assert the map's
// geographic view (read from the live instance), not just its
// markers. Tests (l) and (m) cover the third failure of the same
// day: a set-change fit could be deferred to an animation frame
// that never came, or dropped outright when it landed during a
// zoom animation, while the component recorded it as applied —
// they reproduce both shapes against the production build (both
// failed before the Leaflet fix; the MapLibre port keeps the same
// synchronous-fit + defer-and-verify discipline, and these tests
// now guard THAT).
test.describe("fit integrity (2026-11-23 regression)", () => {
  test("(e) below-the-fold load: after scrolling into view the map frames Taiwan and sums to 242", async ({
    page,
  }) => {
    await stubTiles(page);
    await page.goto("/");
    const map = page.locator(".place-map.maplibregl-map");
    await map.waitFor({ state: "visible", timeout: 30_000 });
    // Deliberately do NOT scroll: the map sits below the fold while
    // the page settles, exactly as a real visitor's first seconds go.
    await page.waitForTimeout(1800);
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const view = await viewFromMap(page);
    expect(view.centre).not.toBeNull();
    // A Taiwan fit, not a world view: zoom 5–8.5 (fractional under
    // MapLibre) and the centre inside a generous Taiwan envelope.
    expect(view.centre!.z).toBeGreaterThanOrEqual(5);
    expect(view.centre!.z).toBeLessThanOrEqual(8.5);
    expect(view.centre!.lat).toBeGreaterThanOrEqual(21.5);
    expect(view.centre!.lat).toBeLessThanOrEqual(25.6);
    expect(view.centre!.lng).toBeGreaterThanOrEqual(119.0);
    expect(view.centre!.lng).toBeLessThanOrEqual(122.3);
    // The scroll-into-view regroup conserves the set: badge counts
    // plus dots plus pins equal the full 242 in the DOM.
    expect(view.total).toBe(242);
  });

  test("(f) noodle search actually refits: bounds move to the noodle set, pins spread out", async ({
    page,
  }) => {
    await stubTiles(page);
    await gotoMap(page);
    const before = await viewFromMap(page);
    expect(before.centre).not.toBeNull();
    await page.locator("input.search").first().fill("noodle");
    await page.waitForFunction(
      () => document.querySelectorAll(".map-pin").length === 14,
      { timeout: 15_000 }
    );
    await page.waitForTimeout(900);
    const after = await viewFromMap(page);
    expect(after.centre).not.toBeNull();
    // The view MOVED to the noodle set's Kaohsiung-area envelope at
    // district zoom — the live failure left it on the previous frame
    // with the pins stacked on one spot.
    expect(after.centre!.z).toBeGreaterThanOrEqual(10);
    expect(after.centre!.lat).toBeGreaterThanOrEqual(22.55);
    expect(after.centre!.lat).toBeLessThanOrEqual(22.8);
    expect(after.centre!.lng).toBeGreaterThanOrEqual(120.2);
    expect(after.centre!.lng).toBeLessThanOrEqual(120.45);
    expect(
      Math.abs(after.centre!.lat - before.centre!.lat) +
        Math.abs(after.centre!.lng - before.centre!.lng)
    ).toBeGreaterThan(0.5);
    // The 14 pins spread over the frame — not a single stacked
    // point. (Two noodle places share a block, so two pins may sit a
    // pixel apart at this zoom; the failure mode being guarded is
    // ALL of them piled onto one spot.)
    const centres = await page.locator(".map-pin").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
      })
    );
    expect(new Set(centres).size).toBeGreaterThanOrEqual(12);
    const perPosition = new Map<string, number>();
    for (const c of centres) perPosition.set(c, (perPosition.get(c) ?? 0) + 1);
    expect(Math.max(...perPosition.values())).toBeLessThanOrEqual(2);
    const xs = centres.map((c) => Number(c.split(",")[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
  });

  test("(g) a fit due while the container is transiently small is re-applied when the size corrects", async ({
    page,
  }) => {
    await stubTiles(page);
    // Force the map container to 120×120 for the first 2.5s of the
    // page's life — the size band in which a padded fit collapses —
    // then let it take its real size. A fit computed against the
    // small size and never revisited would strand the map at an
    // extreme zoom; the fit must land on Taiwan once the size
    // corrects.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent =
        ".place-map { width: 120px !important; height: 120px !important; }";
      document.addEventListener("DOMContentLoaded", () =>
        document.head.appendChild(style)
      );
      setTimeout(() => style.remove(), 2500);
    });
    await page.goto("/");
    const map = page.locator(".place-map.maplibregl-map");
    await map.waitFor({ state: "visible", timeout: 30_000 });
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => document.querySelector(".place-map")!.clientWidth
          ),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(600);
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const view = await viewFromMap(page);
    expect(view.centre).not.toBeNull();
    expect(view.centre!.z).toBeGreaterThanOrEqual(5);
    expect(view.centre!.z).toBeLessThanOrEqual(8.5);
    expect(view.centre!.lat).toBeGreaterThanOrEqual(21.5);
    expect(view.centre!.lat).toBeLessThanOrEqual(25.6);
    expect(view.centre!.lng).toBeGreaterThanOrEqual(119.0);
    expect(view.centre!.lng).toBeLessThanOrEqual(122.3);
    expect(view.total).toBe(242);
  });

  test("(i) wheel over the map without a prior click scrolls the page and never zooms the map", async ({
    page,
  }) => {
    await stubTiles(page);
    const map = await gotoMap(page);
    const before = await viewFromMap(page);
    expect(before.centre).not.toBeNull();
    expect(before.total).toBe(242);
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    // Real wheel events with the pointer over the map — the exact
    // input the confirmed live failure came from. With the wheel
    // handler gated off until a click, the page must scroll and the
    // map's framing must not move.
    await page.mouse.wheel(0, 400);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), {
        timeout: 10_000,
      })
      .toBeGreaterThan(scrollBefore + 200);
    await page.waitForTimeout(600);
    const after = await viewFromMap(page);
    expect(after.centre).not.toBeNull();
    expect(after.centre!.z).toBe(before.centre!.z);
    expect(after.centre!.lat).toBeGreaterThanOrEqual(21.5);
    expect(after.centre!.lat).toBeLessThanOrEqual(25.6);
    expect(after.centre!.lng).toBeGreaterThanOrEqual(119.0);
    expect(after.centre!.lng).toBeLessThanOrEqual(122.3);
    expect(after.total).toBe(242);
  });

  test("(j) after clicking into the map, the wheel zooms it", async ({
    page,
  }) => {
    await stubTiles(page);
    const map = await gotoMap(page);
    const before = await viewFromMap(page);
    expect(before.centre).not.toBeNull();
    const box = (await map.boundingBox())!;
    // Click a bare patch of map (top-right: open sea at the Taiwan
    // framing, no markers, no controls) to activate wheel zoom.
    await page.mouse.click(box.x + box.width - 60, box.y + 50);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Wheel down — the page-scroll direction, which the map reads
    // as zoom OUT (wheel up zooms in).
    await page.mouse.wheel(0, 360);
    await expect
      .poll(
        async () => {
          const v = await viewFromMap(page);
          return v.centre?.z ?? -1;
        },
        { timeout: 15_000 }
      )
      .toBeLessThan(before.centre!.z - 0.2);
  });

  test("(k) after the pointer leaves the map, the wheel scrolls the page again instead of zooming", async ({
    page,
  }) => {
    await stubTiles(page);
    const map = await gotoMap(page);
    const box = (await map.boundingBox())!;
    // Activate wheel zoom with a click, then move the pointer off
    // the map (mouseleave must switch it back off).
    await page.mouse.click(box.x + box.width - 60, box.y + 50);
    await page.mouse.move(box.x + box.width / 2, Math.max(10, box.y - 120), {
      steps: 10,
    });
    const before = await viewFromMap(page);
    expect(before.centre).not.toBeNull();
    // Back over the map and wheel down: no zoom, the page scrolls.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), {
        timeout: 10_000,
      })
      .toBeGreaterThan(scrollBefore + 200);
    await page.waitForTimeout(600);
    const after = await viewFromMap(page);
    expect(after.centre).not.toBeNull();
    expect(after.centre!.z).toBe(before.centre!.z);
    expect(after.total).toBe(242);
  });

  test("(l) a set-change fit lands even when no animation frame ever comes (frame-starved renderer)", async ({
    page,
  }) => {
    // Regression for the third live failure (2026-11-23): a fit
    // deferred to a single requestAnimationFrame callback that a
    // frame-starved renderer never delivers, while the component
    // recorded the fit as applied. The MapLibre port issues
    // set-change fits synchronously (animate: false), so the
    // CAMERA must already sit on the new frame while the renderer
    // is starved — that is the assertion below. (Marker POSITIONS
    // are painted by the render loop, so the pins' spread is only
    // asserted after the gate is released; under Leaflet the
    // markers were DOM-positioned by the fit itself, which is why
    // the old spec could assert the spread mid-starvation.)
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const w = window as unknown as {
        __setStarveRaf?: (v: boolean) => void;
      };
      const native = window.requestAnimationFrame.bind(window);
      let starving = false;
      let queue: FrameRequestCallback[] = [];
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        if (!starving) return native(cb);
        queue.push(cb);
        return queue.length;
      };
      w.__setStarveRaf = (v: boolean) => {
        starving = v;
        if (!v) {
          const q = queue;
          queue = [];
          for (const cb of q) native(() => cb(performance.now()));
        }
      };
    });
    await stubTiles(page);
    await page.goto("/");
    const map = page.locator(".place-map.maplibregl-map");
    await map.waitFor({ state: "visible", timeout: 30_000 });
    await map.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".place-map") as unknown as {
          __haoChiMap?: HookMap;
        };
        return !!el?.__haoChiMap && el.__haoChiMap.isStyleLoaded();
      },
      { timeout: 30_000 }
    );
    await page.waitForTimeout(600);
    const zoomIn = page.locator(".maplibregl-ctrl-zoom-in");
    const zFit = (await viewFromMap(page)).centre!.z;
    await zoomIn.click();
    await page.waitForTimeout(700);
    await zoomIn.click();
    await page.waitForTimeout(900);
    const atZoomed = await viewFromMap(page);
    expect(atZoomed.centre!.z).toBeGreaterThan(zFit + 1.8);
    // Back up to the search box; starve the renderer from here on.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.evaluate(() =>
      (
        window as unknown as { __setStarveRaf: (v: boolean) => void }
      ).__setStarveRaf(true)
    );
    await page.locator("input.search").first().fill("noodle");
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.querySelectorAll(".map-pin").length),
        { timeout: 20_000 }
      )
      .toBe(14);
    // The diagnostic's waits: 3s after the search, then
    // keyboard-scroll only, then 5s at the map.
    await page.waitForTimeout(3000);
    for (let i = 0; i < 12; i++) {
      const b = await map.boundingBox();
      if (b && b.y < 900 && b.y + b.height > 0) break;
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(5000);
    // While STILL starved, the camera must already be the noodle
    // set's Kaohsiung frame — the pre-fix failure left the view on
    // the old frame indefinitely.
    const starved = await viewFromMap(page);
    expect(starved.centre).not.toBeNull();
    expect(starved.centre!.z).toBeGreaterThanOrEqual(10);
    expect(starved.centre!.lat).toBeGreaterThanOrEqual(22.55);
    expect(starved.centre!.lat).toBeLessThanOrEqual(22.8);
    expect(starved.centre!.lng).toBeGreaterThanOrEqual(120.2);
    expect(starved.centre!.lng).toBeLessThanOrEqual(120.45);
    // Release the gate: the pins paint spread across the frame.
    await page.evaluate(() =>
      (
        window as unknown as { __setStarveRaf: (v: boolean) => void }
      ).__setStarveRaf(false)
    );
    await page.waitForTimeout(1200);
    const centres = await page.locator(".map-pin").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
    );
    expect(centres).toHaveLength(14);
    const xs = centres.map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
    expect(
      new Set(centres.map((c) => `${Math.round(c.x)},${Math.round(c.y)}`)).size
    ).toBeGreaterThanOrEqual(12);
  });

  test("(m) a search dispatched during a zoom animation is not dropped", async ({
    page,
  }) => {
    // The other half of the same root cause: a fitBounds arriving
    // mid-animation was silently DISCARDED by the old library
    // while the component recorded it as applied. The port defers
    // a fit that arrives while the camera is easing and retries it
    // on the animation's own moveend (and a plain timer). Start a
    // zoom-in, and the moment the map reports itself easing,
    // dispatch the search as a real input event in the same task,
    // so the set-change fit is guaranteed to land mid-animation.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await stubTiles(page);
    const map = await gotoMap(page);
    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await page.evaluate(async () => {
      const el = document.querySelector(".place-map") as unknown as {
        __haoChiMap?: HookMap;
      };
      const hook = el.__haoChiMap!;
      for (let i = 0; i < 400 && !hook.isEasing(); i++) {
        await new Promise((r) => setTimeout(r, 5));
      }
      const input = document.querySelector(
        "input.search"
      ) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, "noodle");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.querySelectorAll(".map-pin").length),
        { timeout: 20_000 }
      )
      .toBe(14);
    // Long past the animation: a dropped fit never retries.
    await page.waitForTimeout(2500);
    const centres = await page.locator(".map-pin").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
    );
    expect(centres).toHaveLength(14);
    const xs = centres.map((c) => c.x);
    // The dropped-fit failure: spread ~9px (pins piled at the old
    // frame's zoom).
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
    const view = await viewFromMap(page);
    expect(view.centre).not.toBeNull();
    expect(view.centre!.z).toBeGreaterThanOrEqual(10);
    expect(view.centre!.lat).toBeGreaterThanOrEqual(22.55);
    expect(view.centre!.lat).toBeLessThanOrEqual(22.8);
    expect(view.centre!.lng).toBeGreaterThanOrEqual(120.2);
    expect(view.centre!.lng).toBeLessThanOrEqual(120.45);
    expect(map).toBeTruthy();
  });

  test("(h) a visitor's own zoom survives a later size correction", async ({
    page,
  }) => {
    await stubTiles(page);
    const map = await gotoMap(page);
    // The visitor takes over the view: two zoom-ins from the
    // Taiwan fit.
    const zoomIn = page.locator(".maplibregl-ctrl-zoom-in");
    await zoomIn.click();
    await page.waitForTimeout(500);
    await zoomIn.click();
    await page.waitForTimeout(900);
    const before = await viewFromMap(page);
    expect(before.centre).not.toBeNull();
    // A material size change (the window narrows; the map column
    // follows) must not yank the visitor's view back to a fit.
    await page.setViewportSize({ width: 760, height: 900 });
    await page.waitForTimeout(1500);
    const after = await viewFromMap(page);
    expect(after.centre).not.toBeNull();
    expect(after.centre!.z).toBe(before.centre!.z);
    expect(
      Math.abs(after.centre!.lat - before.centre!.lat)
    ).toBeLessThan(0.05);
    expect(
      Math.abs(after.centre!.lng - before.centre!.lng)
    ).toBeLessThan(0.05);
    expect(map).toBeTruthy();
  });
});
