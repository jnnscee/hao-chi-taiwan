// Phone-width layout regression spec.
//
// Guards the breakage Jenny screenshotted on 2026-11-22: at phone
// widths the compact row's full-text rating chip shared the names'
// single flex line, so chip + heart crushed the names block into a
// ~100px column (every word on its own line), and the hero title —
// a fixed 1.9rem, wider than a phone hero — broke inside the
// Chinese name. The desktop live check structurally cannot see
// either failure; this spec runs at real phone viewports.
//
// Assertions per viewport (390px and 360px, mobile + touch):
//   (a) the first compact row's names block is wide (> 200px) —
//       it was ~100px in the broken layout;
//   (b) the hero h1 renders on ONE line;
//   (c) no horizontal overflow;
//   (d) the rating chip sits BELOW the food line (its own line),
//       not squeezed onto the names line beside the heart;
//   (e) the hero intro stays inside the banner's sky — the
//       2026-11-25 redesign puts the title and intro in the
//       taller artwork's sky band (its top ~27%); the intro's
//       bottom edge must stay within the top 30% of the photo
//       frame, not drift down over the skyline and stalls.

import { expect, test } from "@playwright/test";

for (const width of [390, 360]) {
  test.describe(`phone layout at ${width}px`, () => {
    test.use({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    test("compact rows and hero survive phone width", async ({ page }) => {
      await page.goto("/");
      // Phone default (no saved view choice) is Compact at <= 640px.
      const firstRow = page.locator(".place-list.compact .place").first();
      await firstRow.waitFor({ state: "visible", timeout: 30_000 });
      // Let the view settle (fonts, the client-side view switch).
      await page.waitForTimeout(500);

      // (a) The names block keeps the row's width.
      const namesWidth = await firstRow
        .locator(".row-names")
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(namesWidth, `.row-names width at ${width}px`).toBeGreaterThan(200);

      // (b) The hero title is one line: its height is within one
      // line-height (a wrapped title would be ~two).
      const hero = await page.locator(".hero h1").evaluate((el) => {
        const style = getComputedStyle(el);
        const lineHeight =
          parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.02;
        return { height: el.offsetHeight, lineHeight };
      });
      expect(hero.height, `hero h1 height at ${width}px`).toBeLessThan(
        hero.lineHeight * 1.5
      );

      // (c) Nothing overflows horizontally.
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(scrollWidth, `scrollWidth at ${width}px`).toBeLessThanOrEqual(width);

      // (d) The rating chip starts below the food line.
      const foodTop = await firstRow
        .locator(".row-food")
        .evaluate((el) => el.getBoundingClientRect().top);
      const chipTop = await firstRow
        .locator(".row-tags .tag.rating")
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(chipTop, `rating chip below food line at ${width}px`).toBeGreaterThan(
        foodTop
      );

      // (e) The hero intro stays inside the banner's sky: its
      // bottom edge, measured from the photo frame's top, stays
      // within the frame's top 30% (the sky is its top ~27%).
      const sky = await page.evaluate(() => {
        const media = document
          .querySelector(".hero-media")!
          .getBoundingClientRect();
        const lede = document
          .querySelector(".hero-lede")!
          .getBoundingClientRect();
        return { ledeBottom: lede.bottom - media.top, mediaHeight: media.height };
      });
      expect(
        sky.ledeBottom,
        `hero intro bottom within the sky at ${width}px`
      ).toBeLessThanOrEqual(sky.mediaHeight * 0.3);
    });
  });
}
