import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility audit (axe-core) on all four demo pages.
 * Rules: WCAG 2.1 A/AA — color contrast, ARIA, landmarks, form labels, etc.
 */
test.describe("Accessibility (axe-core)", () => {
  for (const path of ["/", "/explore", "/portfolio", "/graph"]) {
    test(`${path} has no critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      // wait for interactive content to render (explore fetches on mount)
      await page.waitForTimeout(1200);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const violations = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
    });
  }
});
