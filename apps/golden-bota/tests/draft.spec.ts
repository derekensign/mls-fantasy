import { test, expect } from "@playwright/test";

/**
 * Draft functionality tests
 *
 * Prerequisites:
 * 1. Run the reset script before running tests:
 *    AWS_PROFILE=mls-fantasy node backend/goldenbota2025/OneTime/resetDraftForTesting.js
 *
 * 2. Start the dev server:
 *    npm run dev
 */

const BASE_URL = "http://localhost:3000";
const LEAGUE_ID = "1";

test.describe("Draft Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to draft page
    await page.goto(`${BASE_URL}/league/${LEAGUE_ID}/draft`);

    // Wait for draft data to load
    await expect(page.locator("text=Draft Players - 2026")).toBeVisible({ timeout: 10000 });
  });

  test("should display draft header and current turn info", async ({ page }) => {
    // Check title
    await expect(page.locator("text=Draft Players - 2026")).toBeVisible();

    // Check current turn info is displayed
    await expect(page.locator("text=Current Turn:")).toBeVisible();
    await expect(page.locator("text=Round:")).toBeVisible();
    await expect(page.locator("text=Overall Pick #:")).toBeVisible();
  });

  test("should display test mode toggle", async ({ page }) => {
    // Check test mode checkbox exists
    const testModeCheckbox = page.locator("input[type=checkbox]").first();
    await expect(testModeCheckbox).toBeVisible();
    await expect(page.locator("text=Test Mode")).toBeVisible();
  });

  test("should enable test mode and show drafting info", async ({ page }) => {
    // Enable test mode
    const testModeCheckbox = page.locator("input[type=checkbox]").first();
    await testModeCheckbox.check();

    // Should show "Drafting as:" text
    await expect(page.locator("text=Drafting as:")).toBeVisible();
    await expect(page.locator("text=Test mode enabled")).toBeVisible();
  });

  test("should display available players table", async ({ page }) => {
    // Wait for players to load
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Check for table headers
    await expect(page.locator("text=Name")).toBeVisible();
    await expect(page.locator("text=Team")).toBeVisible();
    await expect(page.locator("text=2025 Goals")).toBeVisible();
  });

  test("should have team filter dropdown", async ({ page }) => {
    // Check for team filter
    await expect(page.locator("text=Filter by Team")).toBeVisible();

    // Open dropdown
    await page.locator("text=All Teams").click();

    // Should show teams in dropdown
    await expect(page.locator("role=listbox")).toBeVisible();
  });

  test("should have new player filter checkboxes", async ({ page }) => {
    // Check for new player filters
    await expect(page.locator("text=New to MLS")).toBeVisible();
    await expect(page.locator("text=New to Team")).toBeVisible();
  });

  test("should filter players by 'New to MLS' checkbox", async ({ page }) => {
    // Get initial row count
    const initialRows = await page.locator("table tbody tr").count();

    // Check "New to MLS" checkbox
    const newToMLSCheckbox = page.locator("label").filter({ hasText: "New to MLS" }).locator("input");
    await newToMLSCheckbox.check();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Filtered rows should be fewer or equal
    const filteredRows = await page.locator("table tbody tr").count();
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test("should search players by name", async ({ page }) => {
    // Find search input
    const searchInput = page.locator("input[placeholder*='Search']");
    await expect(searchInput).toBeVisible();

    // Search for a player
    await searchInput.fill("Messi");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show filtered results
    const rows = await page.locator("table tbody tr").count();
    expect(rows).toBeGreaterThan(0);
  });
});

test.describe("Draft Flow - Test Mode", () => {
  test("should draft a player in test mode", async ({ page }) => {
    await page.goto(`${BASE_URL}/league/${LEAGUE_ID}/draft`);

    // Wait for page to load
    await expect(page.locator("text=Draft Players - 2026")).toBeVisible({ timeout: 10000 });

    // Enable test mode
    const testModeCheckbox = page.locator("input[type=checkbox]").first();
    await testModeCheckbox.check();

    // Wait for players table
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Get current overall pick number
    const pickText = await page.locator("text=Overall Pick #:").textContent();
    const currentPick = parseInt(pickText?.replace("Overall Pick #:", "").trim() || "0");

    // Find a draft button and click it
    const draftButton = page.locator("button").filter({ hasText: "DRAFT" }).first();

    if (await draftButton.isVisible()) {
      await draftButton.click();

      // Wait for the draft to process
      await page.waitForTimeout(2000);

      // Pick number should have incremented
      const newPickText = await page.locator("text=Overall Pick #:").textContent();
      const newPick = parseInt(newPickText?.replace("Overall Pick #:", "").trim() || "0");

      expect(newPick).toBe(currentPick + 1);
    }
  });

  test("should show drafted players table", async ({ page }) => {
    await page.goto(`${BASE_URL}/league/${LEAGUE_ID}/draft`);

    // Wait for page to load
    await expect(page.locator("text=Draft Players - 2026")).toBeVisible({ timeout: 10000 });

    // Check for drafted players section (either visible table or drawer button)
    const draftedSection = page.locator("text=Drafted Players").or(page.locator("text=Show Drafted Players"));
    await expect(draftedSection.first()).toBeVisible();
  });
});
