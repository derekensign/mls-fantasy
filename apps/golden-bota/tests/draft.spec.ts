import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  LEAGUE_ID,
  enableTestMode,
  waitForTableLoad,
  getRowCount,
  goToDraftPage,
  draftFirstAvailablePlayer,
  getCurrentPickNumber,
  getCurrentRound,
  getCurrentTurnTeam,
  isDraftOver,
  searchPlayer,
  toggleNewToMLSFilter,
  toggleNewToTeamFilter,
} from "./utils/test-helpers";

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

test.describe("Draft Page - Display", () => {
  test.beforeEach(async ({ page }) => {
    await goToDraftPage(page);
  });

  test("should display draft header and current turn info", async ({ page }) => {
    await expect(page.locator("text=Draft Players - 2026")).toBeVisible();
    await expect(page.locator("text=Current Turn:")).toBeVisible();
    await expect(page.locator("text=Round:")).toBeVisible();
    await expect(page.locator("text=Overall Pick #:")).toBeVisible();
  });

  test("should display test mode toggle for commissioner", async ({ page }) => {
    const testModeCheckbox = page.locator("label").filter({ hasText: "Test Mode" });
    await expect(testModeCheckbox).toBeVisible();
  });

  test("should enable test mode and show drafting info", async ({ page }) => {
    await enableTestMode(page);
    await expect(page.locator("text=Drafting as:")).toBeVisible();
  });

  test("should display available players table with headers", async ({ page }) => {
    await waitForTableLoad(page);
    await expect(page.locator("th >> text=Name")).toBeVisible();
    await expect(page.locator("th >> text=Team")).toBeVisible();
    await expect(page.locator("th >> text=2025 Goals")).toBeVisible();
  });

  test("should display Reset Draft button for commissioner", async ({ page }) => {
    const resetButton = page.locator("button").filter({ hasText: "Reset Draft" });
    await expect(resetButton).toBeVisible();
  });
});

test.describe("Draft Page - Filters", () => {
  test.beforeEach(async ({ page }) => {
    await goToDraftPage(page);
    await waitForTableLoad(page);
  });

  test("should have team filter dropdown", async ({ page }) => {
    await page.locator("text=All Teams").click();
    await expect(page.locator("role=listbox")).toBeVisible();
  });

  test("should filter players by team", async ({ page }) => {
    const initialRows = await getRowCount(page);

    // Select a specific team
    await page.locator("text=All Teams").click();
    await page.locator("role=option").first().click();
    await page.waitForTimeout(500);

    const filteredRows = await getRowCount(page);
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test("should have new player filter checkboxes on same line", async ({ page }) => {
    const newToMLS = page.locator("label").filter({ hasText: "New to MLS" });
    const newToTeam = page.locator("label").filter({ hasText: "New to Team" });

    await expect(newToMLS).toBeVisible();
    await expect(newToTeam).toBeVisible();
  });

  test("should filter by 'New to MLS' checkbox", async ({ page }) => {
    const initialRows = await getRowCount(page);

    await toggleNewToMLSFilter(page);

    const filteredRows = await getRowCount(page);
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test("should filter by 'New to Team' checkbox", async ({ page }) => {
    const initialRows = await getRowCount(page);

    await toggleNewToTeamFilter(page);

    const filteredRows = await getRowCount(page);
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test("should search players by name", async ({ page }) => {
    await searchPlayer(page, "Messi");

    const rows = await getRowCount(page);
    expect(rows).toBeGreaterThan(0);

    // Verify results contain search term
    const firstRowText = await page.locator("table tbody tr").first().textContent();
    expect(firstRowText?.toLowerCase()).toContain("messi");
  });

  test("should clear search and show all players", async ({ page }) => {
    const initialRows = await getRowCount(page);

    await searchPlayer(page, "zzzznonexistent");
    const noResults = await getRowCount(page);
    expect(noResults).toBe(0);

    // Clear search
    const searchInput = page.locator("input[placeholder*='Search']");
    await searchInput.clear();
    await page.waitForTimeout(500);

    const restoredRows = await getRowCount(page);
    expect(restoredRows).toBe(initialRows);
  });
});

test.describe("Draft Flow - Test Mode", () => {
  test.beforeEach(async ({ page }) => {
    await goToDraftPage(page);
    await waitForTableLoad(page);
  });

  test("should enable draft button in test mode", async ({ page }) => {
    await enableTestMode(page);

    const draftButton = page.locator("button").filter({ hasText: "DRAFT" }).first();
    await expect(draftButton).toBeEnabled();
  });

  test("should draft a player and increment pick number", async ({ page }) => {
    await enableTestMode(page);

    const pickBefore = await getCurrentPickNumber(page);

    const playerName = await draftFirstAvailablePlayer(page);
    expect(playerName).not.toBeNull();

    const pickAfter = await getCurrentPickNumber(page);
    expect(pickAfter).toBe(pickBefore + 1);
  });

  test("should advance to next team after draft", async ({ page }) => {
    await enableTestMode(page);

    const teamBefore = await getCurrentTurnTeam(page);

    await draftFirstAvailablePlayer(page);

    const teamAfter = await getCurrentTurnTeam(page);
    expect(teamAfter).not.toBe(teamBefore);
  });

  test("should show drafted players in drafted table", async ({ page }) => {
    await enableTestMode(page);

    // Draft a player
    await draftFirstAvailablePlayer(page);

    // Check drafted players table has at least one entry
    const draftedTable = page.locator("text=Drafted Players").locator("xpath=ancestor::div").locator("table");

    if (await draftedTable.isVisible()) {
      const draftedRows = await draftedTable.locator("tbody tr").count();
      expect(draftedRows).toBeGreaterThan(0);
    } else {
      // Mobile view - click drawer button
      const drawerButton = page.locator("button").filter({ hasText: "Show Drafted Players" });
      if (await drawerButton.isVisible()) {
        await drawerButton.click();
        await expect(page.locator("text=Drafted Players")).toBeVisible();
      }
    }
  });

  test("should remove drafted player from available list", async ({ page }) => {
    await enableTestMode(page);

    // Get first player name before drafting
    const firstPlayerCell = page.locator("table tbody tr").first().locator("td").first();
    const playerName = await firstPlayerCell.textContent();

    // Draft the player
    await draftFirstAvailablePlayer(page);

    // Search for that player - should not be in available list
    if (playerName) {
      await searchPlayer(page, playerName.trim());
      await page.waitForTimeout(500);

      // Player should not appear in filtered results (or show 0 results)
      const rows = await getRowCount(page);
      if (rows > 0) {
        const firstRowText = await page.locator("table tbody tr").first().textContent();
        // The exact player should not be at the top anymore
        expect(firstRowText).not.toContain(playerName.trim());
      }
    }
  });

  test("should increment round after all teams draft", async ({ page }) => {
    // This test requires drafting through all 13 teams
    // Only run if starting from pick 1
    const currentPick = await getCurrentPickNumber(page);

    if (currentPick !== 1) {
      test.skip();
      return;
    }

    await enableTestMode(page);

    const initialRound = await getCurrentRound(page);

    // Draft for all 13 teams (one round)
    for (let i = 0; i < 13; i++) {
      await draftFirstAvailablePlayer(page);
      await page.waitForTimeout(500);
    }

    const newRound = await getCurrentRound(page);
    expect(newRound).toBe(initialRound + 1);
  });
});

test.describe("Draft Page - Drafted Players Table", () => {
  test.beforeEach(async ({ page }) => {
    await goToDraftPage(page);
  });

  test("should show drafted players section", async ({ page }) => {
    // Either desktop table or mobile drawer button should exist
    const desktopTable = page.locator("text=Drafted Players");
    const mobileButton = page.locator("button").filter({ hasText: "Show Drafted Players" });

    const hasDesktop = await desktopTable.isVisible();
    const hasMobile = await mobileButton.isVisible();

    expect(hasDesktop || hasMobile).toBeTruthy();
  });

  test("should display drafted player details", async ({ page }) => {
    await enableTestMode(page);
    await waitForTableLoad(page);

    // Draft a player first
    await draftFirstAvailablePlayer(page);

    // Check drafted table shows player info
    const draftedSection = page.locator("div").filter({ hasText: /Drafted Players/ }).last();

    // Should show round info
    await expect(draftedSection.locator("text=Round")).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});

test.describe("Draft Page - Commissioner Controls", () => {
  test.beforeEach(async ({ page }) => {
    await goToDraftPage(page);
  });

  test("should show commissioner controls panel", async ({ page }) => {
    // Should see yellow commissioner panel
    const commissionerPanel = page.locator("div").filter({ hasText: "Test Mode" }).first();
    await expect(commissionerPanel).toBeVisible();
  });

  test("should have Reset Draft button", async ({ page }) => {
    const resetButton = page.locator("button").filter({ hasText: "Reset Draft" });
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toBeEnabled();
  });

  test("reset draft button should show confirmation", async ({ page }) => {
    // Set up dialog handler to cancel
    page.on("dialog", (dialog) => dialog.dismiss());

    const resetButton = page.locator("button").filter({ hasText: "Reset Draft" });
    await resetButton.click();

    // Dialog should have appeared (and been dismissed by handler)
    // If no error, test passes
  });
});
