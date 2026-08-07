import { test, expect } from "@playwright/test";

test.describe("Home — pipeline theater", () => {
  test("hero renders with live stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("compliant");
    // live stat cards on the ingest stage
    await expect(page.getByText("Claims scraped")).toBeVisible();
    await expect(page.getByText(/2,337/).first()).toBeVisible();
  });

  test("stage rail switches the active panel", async ({ page }) => {
    await page.goto("/");
    const retrieve = page.getByRole("button", { name: "04 Retrieve" });
    await retrieve.click();
    // the detail panel heading (there are two "Retrieve" headings: the rail + the panel)
    await expect(page.getByRole("heading", { name: "Retrieve" }).nth(1)).toBeVisible();
    await expect(page.getByText(/Reciprocal-rank fusion/)).toBeVisible();
  });

  test("nav links reach all pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Explore", exact: true }).click();
    await expect(page).toHaveURL(/\/explore/);
    await page.getByRole("navigation").getByRole("link", { name: "Portfolio", exact: true }).click();
    await expect(page).toHaveURL(/\/portfolio/);
    await page.getByRole("navigation").getByRole("link", { name: "Graph", exact: true }).click();
    await expect(page).toHaveURL(/\/graph/);
  });
});
