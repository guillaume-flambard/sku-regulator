import { test, expect } from "@playwright/test";

test.describe.serial("Portfolio — compliance + human-in-the-loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page.getByText("Compliance portfolio", { exact: false })).toBeVisible();
  });

  test("six demo SKUs render with verdicts", async ({ page }) => {
    await expect(page.getByText("Omega-3 Daily 1000mg").first()).toBeVisible();
    await expect(page.getByText("Vitamin C 1000mg Effervescent").first()).toBeVisible();
    await expect(page.getByText("Glucomannan Slim Shot").first()).toBeVisible();
  });

  test("probiotic SKU is flagged for review", async ({ page }) => {
    // SKU-PROB-ES-006 carries a non-authorised claim -> "Needs review"
    const card = page.locator("div", { hasText: "Probiotic 12 Strains" }).first();
    await expect(card).toContainText("Needs review");
  });

  test("market filter narrows the list", async ({ page }) => {
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page.getByText("Omega-3 Daily 1000mg").first()).toBeVisible();
    // the probiotic product is sold in ES, so its product card disappears;
    // (its name may still appear in the anomaly queue — scope to the grid)
    const grid = page.locator("div.grid");
    await expect(grid.filter({ hasText: "Probiotic 12 Strains" })).toHaveCount(0);
  });

  test("resolve shows undo toast; undo restores the anomaly", async ({ page }) => {
    // wait for the anomaly list to render (queued fetch)
    await expect(page.getByRole("heading", { name: "Human-in-the-loop queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resolve" }).first()).toBeVisible({ timeout: 15_000 });

    // resolve the first anomaly
    await page.getByRole("button", { name: "Resolve" }).first().click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

    // undo restores it
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Resolve" }).first()).toBeVisible({ timeout: 10_000 });
  });
});
