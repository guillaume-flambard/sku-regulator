import { test, expect } from "@playwright/test";

test.describe("Explore — ask the register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    // initial auto-search runs on mount
    await expect(page.getByText("Top matches", { exact: false })).toBeVisible({ timeout: 20_000 });
  });

  test("default vitamin C query surfaces authorised claims", async ({ page }) => {
    await expect(page.getByText("POL-HC-6510")).toBeVisible();
    await expect(page.getByText("Authorised").first()).toBeVisible();
  });

  test("market map renders real geography and reflects the verdict", async ({ page }) => {
    // the map is a real topojson-backed SVG (world-atlas), not a hand-drawn sketch
    expect(await page.locator("svg path").count()).toBeGreaterThan(100);

    // default query (vitamin C, FR, authorised) -> France drawn green
    await expect(page.locator('svg path[fill="#d9efe4"]')).toHaveCount(1, { timeout: 10_000 });

    // a non-authorised probiotic claim -> France must turn red
    await page.getByPlaceholder(/vitamin C supports/).fill("probiotic gut health");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText("Top matches", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('svg path[fill="#f5dcd6"]')).toHaveCount(1, { timeout: 10_000 });
  });

  test("clicking a result selects it for the map", async ({ page }) => {
    const cards = page.getByRole("button").filter({ hasText: "POL-HC" });
    await expect(cards.first()).toBeVisible();
    // select the second card
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveClass(/border-sage/);
  });

  test("grounded answer loads on demand and lists sources", async ({ page }) => {
    test.setTimeout(90_000); // local LLM on a slow CPU can take ~60s cold
    await page.getByRole("button", { name: "Read the grounded answer" }).click();
    await expect(page.getByText("Sources", { exact: true })).toBeVisible({ timeout: 80_000 });
    await expect(page.getByText(/POL-HC-65\d\d/).first()).toBeVisible();
  });

  test("empty state appears for gibberish query", async ({ page }) => {
    await page.getByPlaceholder(/vitamin C supports/).fill("zzzzzznonsense");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText("No claim matched")).toBeVisible({ timeout: 20_000 });
    // a suggestion to recover is present
    await expect(page.getByText("try rewording", { exact: false })).toBeVisible();
  });
});
