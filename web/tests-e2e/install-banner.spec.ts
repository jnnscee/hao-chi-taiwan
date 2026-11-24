// Phase B restoration spec (2026-11-23): the install banner
// (B-9) — the live app's dismissible "Add to Home Screen" bar,
// which the rebuild dropped while keeping the footer button and
// the steps dialog. Jenny asked for the bar back the same day.
//
// The live app's rules, driven here the way a visitor meets
// them: on a phone the bar shows without waiting for a browser
// offer (iOS has none); on a desktop it shows only once the
// browser offers an install prompt; the ✕ dismisses it and the
// dismissal is remembered on the device, so it stays hidden
// after a reload; and while the bar shows, the floating search
// button lifts above it instead of being covered.

import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 " +
  "Mobile/15E148 Safari/604.1";

/** The floating search button must sit entirely above the bar's
 *  card — a 2px tolerance for sub-pixel rounding. */
async function expectButtonClearOfBar(page: import("@playwright/test").Page) {
  const button = page.locator(".float-search");
  await expect(button).toBeVisible();
  const buttonBox = await button.boundingBox();
  const cardBox = await page.locator(".install-bar-card").boundingBox();
  expect(buttonBox, "float-search bounding box").not.toBeNull();
  expect(cardBox, "install-bar card bounding box").not.toBeNull();
  expect(
    buttonBox!.y + buttonBox!.height,
    "float-search bottom vs install card top"
  ).toBeLessThanOrEqual(cardBox!.y + 2);
}

for (const width of [390, 360]) {
  test.describe(`install banner at ${width}px (iPhone)`, () => {
    test.use({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      userAgent: IPHONE_UA,
    });

    test("shows under the phone rule, clears the search button, and stays dismissed after reload", async ({
      page,
    }) => {
      await page.goto("/");
      const bar = page.locator(".install-bar");
      await bar.waitFor({ state: "visible", timeout: 30_000 });
      await expect(bar.locator(".install-bar-text b")).toHaveText(
        "Add Hao Chi Taiwan to your Home Screen"
      );
      await expect(bar.locator(".install-bar-text span")).toHaveText(
        "The list, details and driver card keep working with no connection."
      );
      await expect(bar.locator(".install-bar-btn")).toHaveText("Add");

      // The floating search button is never covered by the bar.
      await expectButtonClearOfBar(page);

      // Dismiss: the bar hides, the dismissal is remembered on
      // the device, and the search button settles back down.
      await bar.locator(".install-bar-x").click();
      await expect(bar).toHaveCount(0);
      await expect(
        page.evaluate(() =>
          window.localStorage.getItem("hao-chi-install-dismissed-v1")
        )
      ).resolves.toBe("1");
      await expect(
        page.evaluate(() => document.body.classList.contains("has-install"))
      ).resolves.toBe(false);

      // After a reload the bar stays dismissed.
      await page.reload();
      await page
        .locator(".place-list .place")
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(500);
      await expect(page.locator(".install-bar")).toHaveCount(0);
    });
  });
}

test.describe("install banner at 390px (iPhone, Chinese)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: IPHONE_UA,
  });

  test("shows the live app's Chinese bar and clears the search button", async ({
    page,
  }) => {
    await page.goto("/zh/");
    const bar = page.locator(".install-bar");
    await bar.waitFor({ state: "visible", timeout: 30_000 });
    await expect(bar.locator(".install-bar-text b")).toHaveText(
      "把好吃台灣加到主畫面"
    );
    await expect(bar.locator(".install-bar-btn")).toHaveText("加入");
    await expectButtonClearOfBar(page);
  });
});

test.describe("install banner on desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("stays hidden until the browser offers an install prompt, then shows", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator(".place-list .place")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(500);
    // No offer captured yet: the live app shows no bar on a
    // desktop either.
    await expect(page.locator(".install-bar")).toHaveCount(0);

    // The browser's offer arrives: the bar appears.
    await page.evaluate(() => {
      const evt = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      evt.prompt = () => Promise.resolve();
      evt.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(evt);
    });
    const bar = page.locator(".install-bar");
    await bar.waitFor({ state: "visible", timeout: 10_000 });
    await expect(bar.locator(".install-bar-text b")).toHaveText(
      "Add Hao Chi Taiwan to your Home Screen"
    );
  });
});
