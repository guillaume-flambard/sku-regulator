import { test, expect } from "@playwright/test";

/**
 * Light visual/layout regression: pages must not overflow horizontally on
 * desktop and mobile (a common breakage: off-screen content, squished grids,
 * absolute-positioned elements). Screenshots are saved for human review but
 * not diffed in CI (avoid committing large PNG baselines).
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("Layout regression — no horizontal overflow", () => {
  for (const vp of VIEWPORTS) {
    test(`on ${vp.name}: pages fit the viewport width`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of ["/", "/explore", "/portfolio", "/graph"]) {
        await page.goto(path);
        await page.waitForTimeout(800);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} overflows by ${overflow}px on ${vp.name}`).toBeLessThanOrEqual(1);
        // record a screenshot for human review (not committed)
        await page.screenshot({ path: `test-results/layout-${vp.name}${path.replaceAll("/", "_")}.png`, fullPage: false });
      }
    });
  }
});
