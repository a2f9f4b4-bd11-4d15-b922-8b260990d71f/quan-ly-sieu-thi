import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs, resetMockData, watchForbidden } from "./helpers";

/**
 * Guards a whole class of defect rather than one instance: no screen may fire a
 * request the signed-in role is not allowed to make. Role gating hides UI; the
 * QUERY has to be gated too, or the browser takes a silent 403 on every visit.
 *
 * Two real defects were found this way — the dashboard firing GET /sales for a
 * stockkeeper, and /inventory firing GET /inventory/low-stock for a cashier.
 */
const SCREENS = [
  "/", "/pos", "/sales", "/customers", "/products", "/categories",
  "/suppliers", "/purchases", "/purchases/new", "/inventory",
  "/inventory/counts", "/inventory/movements", "/reports",
  "/reports/revenue", "/reports/top-products", "/reports/gross-profit",
  "/reports/inventory", "/users", "/profile",
];

for (const role of Object.keys(ACCOUNTS) as Array<keyof typeof ACCOUNTS>) {
  test(`${role}: không màn hình nào gọi API bị từ chối quyền`, async ({ page }) => {
    await resetMockData(page);
    const forbidden = watchForbidden(page);
    await loginAs(page, role);

    for (const path of SCREENS) {
      await page.goto(path);
      // Wait for the shell, then a short settle for mount-time queries.
      // networkidle across 19 routes x 3 roles starves the dev server and
      // makes unrelated specs time out.
      await page.locator("main").first().waitFor({ state: "attached" });
      await page.waitForTimeout(250);
    }

    expect(forbidden, `403s taken by ${role}: ${forbidden.join(", ")}`).toEqual([]);
  });
}
