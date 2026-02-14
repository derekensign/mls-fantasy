import { Page, expect } from "@playwright/test";

// Test constants
export const BASE_URL = "http://localhost:3000";
export const LEAGUE_ID = "1";

// API Base URL for direct API calls
export const API_BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";

/**
 * Enable test mode on draft page (commissioner-only feature)
 */
export async function enableTestMode(page: Page): Promise<void> {
  const testModeCheckbox = page.locator("label").filter({ hasText: "Test Mode" }).locator("input");
  await testModeCheckbox.check();
  await expect(page.locator("text=Test mode enabled")).toBeVisible();
}

/**
 * Wait for a table to load with data
 * Uses .first() to handle pages with multiple tables
 */
export async function waitForTableLoad(page: Page, timeout = 10000): Promise<void> {
  await expect(page.locator("table").first()).toBeVisible({ timeout });
  // Wait a bit for data to populate
  await page.waitForTimeout(500);
}

/**
 * Get the number of rows in the available players table body
 * Targets the first table on the page (available players, not drafted players)
 */
export async function getRowCount(page: Page, tableSelector = "table:first-of-type tbody tr"): Promise<number> {
  // Use the first table which is the available players table
  const firstTable = page.locator("table").first();
  return await firstTable.locator("tbody tr").count();
}

/**
 * Wait for page to finish loading (no loading spinners)
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  // Wait for any loading spinners to disappear
  await page.waitForSelector(".animate-spin", { state: "hidden", timeout: 10000 }).catch(() => {});
  // Wait for network to be idle
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

/**
 * Navigate to draft page and wait for it to load
 */
export async function goToDraftPage(page: Page, leagueId = LEAGUE_ID): Promise<void> {
  await page.goto(`${BASE_URL}/league/${leagueId}/draft`);
  await expect(page.locator("text=Draft Players - 2026")).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to transfer page and wait for it to load
 */
export async function goToTransferPage(page: Page, leagueId = LEAGUE_ID): Promise<void> {
  await page.goto(`${BASE_URL}/league/${leagueId}/transfer`);
  await expect(page.locator("text=Transfer Window")).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to standings/table page and wait for it to load
 */
export async function goToStandingsPage(page: Page, leagueId = LEAGUE_ID): Promise<void> {
  await page.goto(`${BASE_URL}/league/${leagueId}/table`);
  await expect(page.locator("text=Golden Boot Standings")).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to league settings page
 */
export async function goToLeaguePage(page: Page, leagueId = LEAGUE_ID): Promise<void> {
  await page.goto(`${BASE_URL}/league/${leagueId}`);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

/**
 * Navigate to My Team page
 */
export async function goToMyTeamPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/MyTeam`);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

/**
 * Draft a player by clicking the first available DRAFT button
 */
export async function draftFirstAvailablePlayer(page: Page): Promise<string | null> {
  const draftButton = page.locator("button").filter({ hasText: "DRAFT" }).first();

  if (await draftButton.isVisible()) {
    // Get the player name from the same row
    const row = draftButton.locator("xpath=ancestor::tr");
    const playerName = await row.locator("td").first().textContent();

    await draftButton.click();
    await page.waitForTimeout(2000); // Wait for draft to process

    return playerName?.trim() || null;
  }

  return null;
}

/**
 * Get current draft pick number from the page
 */
export async function getCurrentPickNumber(page: Page): Promise<number> {
  const pickText = await page.locator("text=Overall Pick #:").textContent();
  const match = pickText?.match(/Overall Pick #:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get current draft round from the page
 */
export async function getCurrentRound(page: Page): Promise<number> {
  const roundText = await page.locator("strong").filter({ hasText: "Round:" }).locator("xpath=..").textContent();
  const match = roundText?.match(/Round:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get current team name whose turn it is
 */
export async function getCurrentTurnTeam(page: Page): Promise<string> {
  const turnText = await page.locator("strong").filter({ hasText: "Current Turn:" }).locator("xpath=..").textContent();
  return turnText?.replace("Current Turn:", "").trim() || "";
}

/**
 * Check if draft is over
 */
export async function isDraftOver(page: Page): Promise<boolean> {
  return await page.locator("text=Draft is Over").isVisible();
}

/**
 * Search for a player by name
 */
export async function searchPlayer(page: Page, playerName: string): Promise<void> {
  const searchInput = page.locator("input[placeholder*='Search']");
  await searchInput.fill(playerName);
  await page.waitForTimeout(500); // Wait for filter to apply
}

/**
 * Filter by team using dropdown
 */
export async function filterByTeam(page: Page, teamName: string): Promise<void> {
  await page.locator("text=All Teams").click();
  await page.locator(`role=option >> text=${teamName}`).click();
  await page.waitForTimeout(500);
}

/**
 * Toggle "New to MLS" filter checkbox
 */
export async function toggleNewToMLSFilter(page: Page): Promise<void> {
  const checkbox = page.locator("label").filter({ hasText: "New to MLS" }).locator("input");
  await checkbox.click();
  await page.waitForTimeout(500);
}

/**
 * Toggle "New to Team" filter checkbox
 */
export async function toggleNewToTeamFilter(page: Page): Promise<void> {
  const checkbox = page.locator("label").filter({ hasText: "New to Team" }).locator("input");
  await checkbox.click();
  await page.waitForTimeout(500);
}

/**
 * Reset draft via API (requires server-side endpoint or manual script)
 * Note: This is a placeholder - actual reset requires AWS CLI or Lambda
 */
export async function resetDraftViaAPI(leagueId = LEAGUE_ID): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/league/${leagueId}/draft/reset`, {
      method: "POST",
    });
    return response.ok;
  } catch {
    console.warn("Draft reset API not available - use manual reset script");
    return false;
  }
}
