// Map legibility spec (Phase A, 2026-11-23).
//
// Guards the audit findings against the interactive map:
//   (a) a filtered set's numbered pins sit fully inside the frame
//       (the audit found noodle-search pins cut off at the top edge);
//   (b) the 242 baseline is verifiable on screen: cluster badge
//       counts plus ungrouped dots sum to the set's size;
//   (c) a no-match search leaves the map framed on Taiwan with no
//       pins (the audit caught it sitting on a wide SE Asia view);
//   (d) four rapid zoom-ins never leave the map blank: once settled,
//       every tile is loaded and the tiles cover the container.
//
// The sandbox (and CI) cannot be relied on to reach
// tile.openstreetmap.org — in this environment the browser's proxy
// refuses it outright — and hammering the real tile service from CI
// would breach its usage policy anyway. So the spec stubs the tile
// endpoint at the network layer with a locally drawn PNG (with a
// small artificial latency, closer to real tiles than an instant
// reply). The framing assertion in (c) reads the z/x/y of the tile
// <img>s the map ends up showing.
//
// The service worker is blocked for this spec: by design it serves
// tiles cache-first, and its fetches bypass page-level route
// interception (in this sandbox they fail through the proxy while
// stubbed page requests succeed), which would make every tile
// assertion nondeterministic. The worker's own caching behaviour
// was verified in the offline/PWA slice and is untouched here.

import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";

// --- A 256×256 PNG tile, drawn in-process (green land-ish fill with
// a darker border, so tiles are distinguishable in screenshots). ---
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function tilePng(): Buffer {
  const size = 256;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = row + 1 + x * 3;
      const border = x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
      raw[o] = border ? 90 : 173;
      raw[o + 1] = border ? 120 : 199;
      raw[o + 2] = border ? 90 : 165;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const TILE_PNG = tilePng();

type TileStub = { requested: string[] };
async function stubTiles(
  page: import("@playwright/test").Page,
  delayMs = 150
): Promise<TileStub> {
  const stub: TileStub = { requested: [] };
  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    stub.requested.push(route.request().url());
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ contentType: "image/png", body: TILE_PNG });
  });
  return stub;
}

/** Parse a tile URL's z/x/y and return its geographic bounds. */
function tileBounds(url: string) {
  const parts = url.split("/");
  const z = Number(parts[3]);
  const x = Number(parts[4]);
  const y = Number(parts[5].replace(".png", ""));
  const n = 2 ** z;
  const lngWest = (x / n) * 360 - 180;
  const lngEast = ((x + 1) / n) * 360 - 180;
  const latOf = (ty: number) => {
    const m = Math.PI - (2 * Math.PI * ty) / n;
    return (Math.atan(Math.sinh(m)) * 180) / Math.PI;
  };
  return { z, west: lngWest, east: lngEast, north: latOf(y), south: latOf(y + 1) };
}

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

async function gotoMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  const map = page.locator(".place-map.leaflet-container");
  await map.waitFor({ state: "visible", timeout: 30_000 });
  await map.scrollIntoViewIfNeeded();
  await page.waitForSelector(".leaflet-tile-loaded", { timeout: 30_000 });
  await page.waitForTimeout(600);
  return map;
}

/** The map's current view, reconstructed from the tile <img> under
 * the container's centre (its z/x/y give the zoom and the centre's
 * coordinates), plus the DOM marker accounting. */
async function viewFromTiles(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const container = document.querySelector(".place-map")!;
    const cr = container.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let centre: { z: number; lat: number; lng: number } | null = null;
    for (const t of Array.from(
      document.querySelectorAll(".leaflet-tile")
    ) as HTMLImageElement[]) {
      const r = t.getBoundingClientRect();
      if (cx >= r.left && cx < r.right && cy >= r.top && cy < r.bottom) {
        const parts = t.src.split("/");
        const z = Number(parts[3]);
        const x = Number(parts[4]);
        const y = Number(parts[5].replace(".png", ""));
        const size = 256 * 2 ** z;
        const px = (x + (cx - r.left) / r.width) * 256;
        const py = (y + (cy - r.top) / r.height) * 256;
        centre = {
          z,
          lng: (px / size) * 360 - 180,
          lat:
            (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * py) / size)) *
              180) /
            Math.PI,
        };
        break;
      }
    }
    const badges = Array.from(document.querySelectorAll(".map-cluster")).map(
      (el) => parseInt(el.textContent || "0", 10)
    );
    const badgeSum = badges.reduce((s, n) => s + n, 0);
    const dots = document.querySelectorAll(
      ".leaflet-overlay-pane path.leaflet-interactive"
    ).length;
    const pins = document.querySelectorAll(".map-pin").length;
    return { centre, badgeSum, dots, pins, total: badgeSum + dots + pins };
  });
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
    // Let the fit animation finish before measuring.
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
      const dots = await page
        .locator(".leaflet-overlay-pane path.leaflet-interactive")
        .count();
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
    // cluster's bounds (the tiles on screen move to a deeper zoom).
    const maxTileZoom = async () =>
      page.locator(".leaflet-tile").evaluateAll((els) =>
        Math.max(
          ...els.map((el) =>
            Number((el as HTMLImageElement).src.split("/")[3])
          )
        )
      );
    const before = await maxTileZoom();
    await page.locator(".map-cluster").first().click();
    await expect
      .poll(maxTileZoom, { timeout: 15_000 })
      .toBeGreaterThan(before);
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
        document.querySelectorAll(".map-cluster").length === 0,
      { timeout: 15_000 }
    );
    expect(
      await page.locator(".leaflet-overlay-pane path.leaflet-interactive").count()
    ).toBe(0);
    // Evidence for the frame: the tile <img>s the map ends up
    // showing. (Network requests are not usable evidence here —
    // Leaflet and the browser serve a return to a recent view from
    // cache without new requests.) Once the refit settles, every
    // tile on screen sits at a Taiwan-fit zoom inside a generous
    // Taiwan envelope; a leftover street-level frame (zoom 13+) or
    // the audit's wide SE Asia frame (zoom ≤5, tiles reaching far
    // west/south) both fail this.
    const domTiles = async () =>
      page.locator(".leaflet-tile").evaluateAll((els) =>
        els.map((el) => (el as HTMLImageElement).src)
      );
    await expect
      .poll(
        async () => {
          const srcs = await domTiles();
          if (srcs.length < 4) return false;
          return srcs.every((src) => {
            const z = tileBounds(src).z;
            return z >= 6 && z <= 8;
          });
        },
        { timeout: 15_000 }
      )
      .toBe(true);
    for (const src of await domTiles()) {
      const b = tileBounds(src);
      expect(b.west).toBeGreaterThanOrEqual(108);
      expect(b.east).toBeLessThanOrEqual(133);
      expect(b.south).toBeGreaterThanOrEqual(12);
      expect(b.north).toBeLessThanOrEqual(35);
    }
  });

  test("(d) four rapid zoom-ins never leave the map blank", async ({ page }) => {
    await stubTiles(page, 300);
    const map = await gotoMap(page);
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    for (let i = 0; i < 4; i++) {
      await zoomIn.click({ timeout: 5_000 });
    }
    // Once settled, every tile on screen is loaded and together the
    // tiles cover (nearly) the whole container — no bare pane.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const tiles = Array.from(
              document.querySelectorAll(".leaflet-tile")
            ) as HTMLImageElement[];
            if (tiles.length === 0) return 0;
            const loaded = tiles.filter(
              (t) => t.complete && t.naturalWidth > 0
            ).length;
            return loaded / tiles.length;
          }),
        { timeout: 25_000 }
      )
      .toBe(1);
    const coverage = await page.evaluate(() => {
      const container = document
        .querySelector(".place-map")!
        .getBoundingClientRect();
      const tiles = Array.from(
        document.querySelectorAll(".leaflet-tile")
      ) as HTMLImageElement[];
      let covered = 0;
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        const w =
          Math.min(r.right, container.right) - Math.max(r.left, container.left);
        const h =
          Math.min(r.bottom, container.bottom) - Math.max(r.top, container.top);
        if (w > 0 && h > 0) covered += w * h;
      }
      return covered / (container.width * container.height);
    });
    expect(coverage).toBeGreaterThan(0.95);
    expect(map).toBeTruthy();
  });
});

// Regression coverage for the 2026-11-23 live failure of the Phase A
// build: on the real site the map opened on a whole-world view, a
// search redrew the pins without refitting the view, and the badge
// sum drifted after the map scrolled into view — while every test
// above passed, because they all scroll the map into view before
// asserting and never check that a search actually MOVED the view.
// The tests below close those blind spots: they assert the map's
// geographic bounds (reconstructed from the tiles on screen), not
// just its markers. Tests (l) and (m) cover the third failure of
// the same day: Leaflet's animated fitBounds could defer a
// set-change fit to an animation frame that never came, or drop it
// outright when a zoom animation was in flight, while the
// component recorded it as applied — they reproduce both shapes
// against the production build (both failed before the fix).
test.describe("fit integrity (2026-11-23 regression)", () => {
  test("(e) below-the-fold load: after scrolling into view the map frames Taiwan and sums to 242", async ({
    page,
  }) => {
    await stubTiles(page);
    await page.goto("/");
    const map = page.locator(".place-map.leaflet-container");
    await map.waitFor({ state: "visible", timeout: 30_000 });
    // Deliberately do NOT scroll: the map sits below the fold while
    // the page settles, exactly as a real visitor's first seconds go.
    await page.waitForTimeout(1800);
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const view = await viewFromTiles(page);
    expect(view.centre).not.toBeNull();
    // A Taiwan fit, not a world view: zoom 5–8 and the centre inside
    // a generous Taiwan envelope.
    expect(view.centre!.z).toBeGreaterThanOrEqual(5);
    expect(view.centre!.z).toBeLessThanOrEqual(8);
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
    const before = await viewFromTiles(page);
    expect(before.centre).not.toBeNull();
    await page.locator("input.search").first().fill("noodle");
    await page.waitForFunction(
      () => document.querySelectorAll(".map-pin").length === 14,
      { timeout: 15_000 }
    );
    await page.waitForTimeout(900);
    const after = await viewFromTiles(page);
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
    // page's life — the size band in which a padded fit collapses to
    // a near-world zoom — then let it take its real size. The
    // pre-fix code computed the fit against the small size and
    // stranded the map there (Leaflet's size corrections only pan,
    // never refit); the fit must land on Taiwan once the size
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
    const map = page.locator(".place-map.leaflet-container");
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
    const view = await viewFromTiles(page);
    expect(view.centre).not.toBeNull();
    expect(view.centre!.z).toBeGreaterThanOrEqual(5);
    expect(view.centre!.z).toBeLessThanOrEqual(8);
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
    const before = await viewFromTiles(page);
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
    const after = await viewFromTiles(page);
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
    const before = await viewFromTiles(page);
    expect(before.centre).not.toBeNull();
    const box = (await map.boundingBox())!;
    // Click a bare patch of map (top-right: open sea at the Taiwan
    // framing, no markers, no controls) to activate wheel zoom.
    await page.mouse.click(box.x + box.width - 60, box.y + 50);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Wheel down — the page-scroll direction, which Leaflet reads
    // as zoom OUT (wheel up zooms in).
    await page.mouse.wheel(0, 360);
    await expect
      .poll(
        async () => {
          const v = await viewFromTiles(page);
          return v.centre?.z ?? -1;
        },
        { timeout: 15_000 }
      )
      .toBeLessThan(before.centre!.z);
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
    const before = await viewFromTiles(page);
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
    const after = await viewFromTiles(page);
    expect(after.centre).not.toBeNull();
    expect(after.centre!.z).toBe(before.centre!.z);
    expect(after.total).toBe(242);
  });

  test("(l) a set-change fit lands even when no animation frame ever comes (animated-band deferral)", async ({
    page,
  }) => {
    // Regression for the third live failure (2026-11-23): Leaflet's
    // ANIMATED fitBounds, inside its animated band (zoom delta <=
    // zoomAnimationThreshold = 4, zoom origin within one screen),
    // defers the entire view change to a single
    // requestAnimationFrame callback — and the component recorded
    // the fit as applied, so no retry ever fired when the frame
    // never came (a frame-starved renderer: occluded or
    // agent-driven browser, composited scrolling). From the Taiwan
    // fit (zoom 6) the noodle fit (zoom 12, delta 6) is synchronous
    // and could never show this; at zoom 8 (delta 4) it can. So:
    // zoom in twice first, scroll back up, starve rAF, then run the
    // diagnostic's Experiment 1 sequence. The rAF gate is installed
    // before any page script runs (Leaflet captures
    // window.requestAnimationFrame at module load).
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
    const map = page.locator(".place-map.leaflet-container");
    await map.waitFor({ state: "visible", timeout: 30_000 });
    await map.scrollIntoViewIfNeeded();
    await page.waitForSelector(".leaflet-tile-loaded", { timeout: 30_000 });
    await page.waitForTimeout(600);
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    await zoomIn.click();
    await page.waitForTimeout(700);
    await zoomIn.click();
    await page.waitForTimeout(900);
    const atEight = await viewFromTiles(page);
    expect(atEight.centre?.z).toBe(8);
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
    // While STILL starved, the pins must already be spread across
    // the frame — the pre-fix code left them piled on one spot
    // (measured spread 16px) until a frame happened to arrive.
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
    // And the frame is the noodle set's Kaohsiung frame (checked
    // after releasing the gate so tiles can paint).
    await page.evaluate(() =>
      (
        window as unknown as { __setStarveRaf: (v: boolean) => void }
      ).__setStarveRaf(false)
    );
    await page.waitForTimeout(1200);
    const view = await viewFromTiles(page);
    expect(view.centre).not.toBeNull();
    expect(view.centre!.z).toBeGreaterThanOrEqual(10);
    expect(view.centre!.lat).toBeGreaterThanOrEqual(22.55);
    expect(view.centre!.lat).toBeLessThanOrEqual(22.8);
    expect(view.centre!.lng).toBeGreaterThanOrEqual(120.2);
    expect(view.centre!.lng).toBeLessThanOrEqual(120.45);
  });

  test("(m) a search dispatched during a zoom animation is not dropped", async ({
    page,
  }) => {
    // The other half of the same root cause: Leaflet's
    // _tryAnimatedZoom returns "handled" immediately when a zoom
    // animation is already in flight, silently DISCARDING a
    // fitBounds that arrives mid-animation — while the component
    // recorded it as applied (the live diagnostic's pins redrew,
    // the view completed the OLD animation and stayed). Start a
    // zoom-in, and the moment Leaflet's own leaflet-zoom-anim class
    // shows the animation is running, dispatch the search as a real
    // input event in the same task, so the set-change fit is
    // guaranteed to land mid-animation.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await stubTiles(page);
    const map = await gotoMap(page);
    await page.locator(".leaflet-control-zoom-in").click();
    await page.evaluate(async () => {
      const pane = document.querySelector(".leaflet-map-pane");
      for (
        let i = 0;
        i < 400 && !pane?.classList.contains("leaflet-zoom-anim");
        i++
      ) {
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
    // Long past the animation's 250ms: a dropped fit never retries.
    await page.waitForTimeout(2500);
    const centres = await page.locator(".map-pin").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
    );
    expect(centres).toHaveLength(14);
    const xs = centres.map((c) => c.x);
    // Pre-fix: spread ~9px (pins piled at the old frame's zoom).
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
    const view = await viewFromTiles(page);
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
    // The visitor takes over the view: two zoom-ins from the Taiwan
    // fit (zoom 6 → 8).
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    await zoomIn.click();
    await page.waitForTimeout(500);
    await zoomIn.click();
    await page.waitForTimeout(900);
    const before = await viewFromTiles(page);
    expect(before.centre).not.toBeNull();
    expect(before.centre!.z).toBe(8);
    // A material size change (the window narrows; the map column
    // follows) must not yank the visitor's view back to a fit.
    await page.setViewportSize({ width: 760, height: 900 });
    await page.waitForTimeout(1500);
    const after = await viewFromTiles(page);
    expect(after.centre).not.toBeNull();
    expect(after.centre!.z).toBe(8);
    expect(
      Math.abs(after.centre!.lat - before.centre!.lat)
    ).toBeLessThan(0.05);
    expect(
      Math.abs(after.centre!.lng - before.centre!.lng)
    ).toBeLessThan(0.05);
    expect(map).toBeTruthy();
  });
});
