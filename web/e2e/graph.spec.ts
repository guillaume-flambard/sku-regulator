import { test, expect } from "@playwright/test";

test.describe("Graph — knowledge graph", () => {
  test("renders the force-graph canvas and legend", async ({ page }) => {
    await page.goto("/graph");
    await expect(page.getByRole("heading", { name: /one view/ })).toBeVisible();
    await expect(page.getByText("Product / SKU")).toBeVisible();
    await expect(page.getByText("EU claim")).toBeVisible();
    // wait for the canvas to mount
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/graph");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    expect(errors).toHaveLength(0);
  });
});
