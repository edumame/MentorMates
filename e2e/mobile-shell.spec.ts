import { test, expect } from "@playwright/test";

/**
 * Mobile-only flows (login, /events). Runs in the `Mobile Chrome` project;
 * `chromium-desktop` skips this file (see playwright.config.ts).
 */
test.describe("Mobile Chrome smoke", () => {
  test("login page shows form and primary actions", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign In", exact: true })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with Google" })
    ).toBeVisible();
  });

  test("host page renders key section on narrow viewport", async ({
    page,
  }) => {
    await page.goto("/host");
    await expect(
      page.getByRole("heading", { name: "Features & Benefits" })
    ).toBeVisible();
  });

  test("events list page shows title", async ({ page }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { name: "Events", exact: true })
    ).toBeVisible();
  });
});
