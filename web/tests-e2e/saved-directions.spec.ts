// Phase B restoration spec (2026-11-23): the Saved view (B-1),
// the directions travel-mode picker (B-2) and the hero intro
// paragraph (B-7), driven on the production build the way a
// visitor uses them.
//
// The Saved flow runs the full round trip the parity walk found
// missing: save two places from their cards, open the Saved view
// and see exactly those two under v1's count line, unsave one
// from inside the view and watch the list and the count update,
// then unsave the last one and land on v1's saved empty state.
// The phone run repeats the toggle from the floating panel's copy
// of the controls (on phone the in-page controls leave the flow,
// so the panel copy is the only way in) and checks the hero —
// intro paragraph included — still fits the width.

import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("saved view: save two, see exactly those two, unsave one, count updates", async ({
    page,
  }) => {
    await page.goto("/");
    const cards = page.locator(".place-list.cards .place");
    await cards.first().waitFor({ state: "visible", timeout: 30_000 });

    // Save the first two cards by their hearts, remembering names.
    const names: string[] = [];
    for (const i of [0, 1]) {
      names.push(
        await cards.nth(i).locator(".place-name-zh").innerText()
      );
      await cards.nth(i).locator(".card-save").click();
    }

    // The toggle carries the saved count; pressing it lists only
    // the saved places, under v1's "Showing your N saved places".
    const toggle = page.locator(".search-area.in-page .saved-toggle");
    await expect(toggle).toContainText("(2)");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".result-count")).toHaveText(
      "Showing your 2 saved places"
    );
    await expect(cards).toHaveCount(2);
    const shown = await page
      .locator(".place-list.cards .place .place-name-zh")
      .allInnerTexts();
    expect([...shown].sort()).toEqual([...names].sort());

    // Unsave one from inside the view: it leaves the list and the
    // count line follows (singular wording at one).
    await page
      .locator(".place-list.cards .place .card-save")
      .first()
      .click();
    await expect(cards).toHaveCount(1);
    await expect(page.locator(".result-count")).toHaveText(
      "Showing your 1 saved place"
    );
    await expect(toggle).toContainText("(1)");

    // Unsave the last one: v1's saved empty state.
    await page
      .locator(".place-list.cards .place .card-save")
      .first()
      .click();
    await expect(cards).toHaveCount(0);
    await expect(page.locator(".empty")).toHaveText(
      "No saved places yet — tap Save on any place and it will show up here."
    );
  });

  test("directions modes: each mode link carries its travelmode", async ({
    page,
  }) => {
    await page.goto("/");
    const firstCard = page.locator(".place-list.cards .place").first();
    await firstCard.waitFor({ state: "visible", timeout: 30_000 });
    await firstCard.click();

    const dialog = page.locator(".dialog");
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    const modes = dialog.locator(".dir-modes a.dir-mode");
    await expect(modes).toHaveCount(4);

    const expected: Array<[string, string]> = [
      ["MRT / Bus", "transit"],
      ["Walking", "walking"],
      ["Biking", "bicycling"],
      ["Driving / Taxi", "driving"],
    ];
    for (const [label, mode] of expected) {
      const href = await modes
        .filter({ hasText: label })
        .getAttribute("href");
      const url = new URL(href ?? "");
      expect(url.searchParams.get("travelmode"), label).toBe(mode);
      // No location has been shared in this run, so the origin is
      // Google Maps' own "My Location", as in v1.
      expect(url.searchParams.get("origin"), label).toBe("My Location");
      // The first card is place 1; its destination is its coords.
      expect(url.searchParams.get("destination"), label).toBe(
        "22.6741134,120.2992441"
      );
    }
  });

  test("hero intro paragraph is back, with the live counts", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".hero-lede")).toHaveText(
      "Jenny's food guide to Taiwan — 45 places she has tried, tested and recommends, plus 197 more she wants to try. Most are in Kaohsiung, from mom-and-pop stalls to old favourites."
    );
  });
});

test.describe("phone at 390px", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("saved view works from the floating panel; hero fits", async ({
    page,
  }) => {
    await page.goto("/");
    // Phone default (no saved view choice) is Compact at <= 640px.
    const firstRow = page.locator(".place-list.compact .place").first();
    await firstRow.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(500);

    const name = await firstRow.locator(".place-name-zh").innerText();
    await firstRow.locator(".card-save").click();

    // The in-page controls are out of the flow on phone; the
    // panel's copy of the Saved toggle is the way in.
    await page.locator(".float-search").click();
    const toggle = page.locator(".spanel .saved-toggle");
    await expect(toggle).toContainText("(1)");
    await toggle.click();
    await page.locator(".panel-close").click();

    await expect(page.locator(".result-count")).toHaveText(
      "Showing your 1 saved place"
    );
    const rows = page.locator(".place-list.compact .place");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator(".place-name-zh")).toHaveText(name);

    // The hero, intro paragraph included, does not overflow.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(scrollWidth, "scrollWidth at 390px").toBeLessThanOrEqual(390);
  });
});
