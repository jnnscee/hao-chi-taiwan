// Anonymous action counters (Jenny's stats approval, 2026-11-24;
// lib/track.ts): driven on the production build with the counter
// endpoint mocked, so the suite asserts the calls the app makes
// without ever touching the real totals.
//
//  - Tapping a card's Save heart fires exactly one counter call
//    with action "save" and that place's id; tapping it again
//    fires one "unsave" for the same id.
//  - When the counter call fails, the save itself still works.
//  - The /admin area fires no counter calls at all.

import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test.use({ viewport: { width: 1280, height: 900 } });

const RPC_GLOB = "**/rest/v1/rpc/bump_action";

type Bump = { p_action?: string; p_place_id?: string };

test("save and unsave each fire exactly one counter call for the place", async ({
  page,
}) => {
  const bumps: Bump[] = [];
  await page.route(RPC_GLOB, async (route) => {
    bumps.push(route.request().postDataJSON() as Bump);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  const cards = page.locator(".place-list.cards .place");
  await cards.first().waitFor({ state: "visible", timeout: 30_000 });

  // Learn the first card's place id from its details deep link.
  await cards.first().click();
  await expect(page.locator(".place-detail")).toBeVisible();
  const placeId = new URL(page.url()).searchParams.get("place");
  expect(placeId).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.locator(".place-detail")).toHaveCount(0);

  // Save: exactly one call, the right action and place.
  await cards.first().locator(".card-save").click();
  await expect
    .poll(() => bumps.length, { timeout: 5_000 })
    .toBe(1);
  expect(bumps[0]).toEqual({ p_action: "save", p_place_id: placeId });
  await expect(cards.first().locator(".card-save")).toHaveClass(/is-saved/);

  // Unsave: one more call, "unsave", same place — and no extras.
  await cards.first().locator(".card-save").click();
  await expect
    .poll(() => bumps.length, { timeout: 5_000 })
    .toBe(2);
  expect(bumps[1]).toEqual({ p_action: "unsave", p_place_id: placeId });
  await page.waitForTimeout(750);
  expect(bumps).toHaveLength(2);
});

test("a failed counter call does not affect the save itself", async ({
  page,
}) => {
  await page.route(RPC_GLOB, async (route) => {
    await route.fulfill({ status: 500, body: "nope" });
  });

  await page.goto("/");
  const cards = page.locator(".place-list.cards .place");
  await cards.first().waitFor({ state: "visible", timeout: 30_000 });

  await cards.first().locator(".card-save").click();
  await expect(cards.first().locator(".card-save")).toHaveClass(/is-saved/);
  await expect(
    page.locator(".search-area.in-page .saved-toggle")
  ).toContainText("(1)");
});

test("no counter calls are fired from /admin", async ({ page }) => {
  const bumps: unknown[] = [];
  await page.route(RPC_GLOB, async (route) => {
    bumps.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/admin");
  await page.waitForTimeout(2_500);
  expect(bumps).toHaveLength(0);
});
