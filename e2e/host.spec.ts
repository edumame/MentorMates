import { test, expect } from "@playwright/test";

test.describe("Host page", () => {
  test("renders key content", async ({ page }) => {
    await page.goto("/host");
    await expect(
      page.getByRole("heading", { name: "Features & Benefits" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Define & Deploy" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Scale Your Mentorship" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "From Idea to Demo Day in 3 Steps",
      })
    ).toBeVisible();
  });

  test("matches the desktop layout", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Snapshot is for desktop viewport only"
    );
    await page.goto("/host");
    await expect(page).toHaveScreenshot("host-desktop.png", {
      fullPage: true,
    });
  });
});
