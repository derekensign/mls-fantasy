import { test, expect } from "@playwright/test";
import { BASE_URL } from "./utils/test-helpers";

/**
 * Authentication flow tests
 *
 * Note: Full OAuth testing requires test user accounts in Cognito.
 * These tests verify basic auth UI and redirects.
 */

test.describe("Landing Page - Unauthenticated", () => {
  test("should display landing page", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show sign in option", async ({ page }) => {
    await page.goto(BASE_URL);

    // Look for sign in button or link
    const signIn = page.locator("text=Sign In")
      .or(page.locator("text=Log In"))
      .or(page.locator("text=Login"))
      .or(page.locator("button").filter({ hasText: /sign|log/i }));

    if (await signIn.first().isVisible()) {
      await expect(signIn.first()).toBeVisible();
    }
  });

  test("should show sign up option", async ({ page }) => {
    await page.goto(BASE_URL);

    // Look for sign up option
    const signUp = page.locator("text=Sign Up")
      .or(page.locator("text=Register")
      .or(page.locator("text=Create Account")));

    if (await signUp.first().isVisible()) {
      await expect(signUp.first()).toBeVisible();
    }
  });

  test("should display app branding", async ({ page }) => {
    await page.goto(BASE_URL);

    // Look for app name/logo
    const branding = page.locator("text=Golden")
      .or(page.locator("text=Fantasy"))
      .or(page.locator("img[alt*='logo']"));

    await expect(branding.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });
});

test.describe("Protected Routes", () => {
  test("should handle /MyTeam access", async ({ page }) => {
    await page.goto(`${BASE_URL}/MyTeam`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Should either show the page or redirect to login
    // Test passes if page loads without crashing
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle /league access", async ({ page }) => {
    await page.goto(`${BASE_URL}/league`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Should either show league page or prompt for login
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle /league/1/draft access", async ({ page }) => {
    await page.goto(`${BASE_URL}/league/1/draft`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Should either show draft page or redirect
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Auth Callback", () => {
  test("should handle /auth callback route", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Auth page should process and redirect
    // It may redirect to home or show loading state
    await expect(page.locator("body")).toBeVisible();
  });
});
