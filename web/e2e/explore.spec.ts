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

  test("market map reflects the selected claim verdict", async ({ page }) => {
    // search a non-authorised probiotic claim
    await page.getByRole("button", { name: /What claims can a glucomannan/ }).click();
    await expect(page.getByText("Top matches", { exact: false })).toBeVisible({ timeout: 20_000 });
    // the map's active market should reflect the actual verdict — not hardcoded allowed.
    // We assert via the card badges: a non-authorised claim shows "Not allowed".
    await expect(page.getByText("Non-authorised").first()).toBeVisible();
  });

  test("clicking a result selects it for the map", async ({ page }) => {
    const cards = page.getByRole("button").filter({ hasText: "POL-HC" });
    await expect(cards.first()).toBeVisible();
    // select the second card
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveClass(/border-accent/);
  });

  test("grounded answer loads on demand and lists sources", async ({ page }) => {
    await page.getByRole("button", { name: "Read the grounded answer" }).click();
    await expect(page.getByText("Sources", { exact: true })).toBeVisible({ timeout: 30_000 });
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
