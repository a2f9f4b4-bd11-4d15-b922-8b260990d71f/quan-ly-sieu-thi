import { test, expect } from "@playwright/test";
import { loginAs, resetMockData } from "./helpers";

test.describe("S02 Trang chủ theo vai trò", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("quản lý thấy doanh thu, cảnh báo tồn và phiếu nháp — không 403 nào", async ({ page }) => {
    const forbidden: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 403) forbidden.push(r.url());
    });

    await loginAs(page, "admin");
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("today-revenue")).toBeVisible();
    await expect(page.getByTestId("low-stock-list")).toBeVisible();
    await expect(page.getByText("Phiếu nhập nháp")).toBeVisible();

    expect(forbidden).toEqual([]);
  });

  test("thu ngân vào thẳng POS và trang chủ chỉ có thẻ bán hàng — không 403 nào", async ({ page }) => {
    const forbidden: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 403) forbidden.push(r.url());
    });

    await loginAs(page, "cashier");
    await expect(page).toHaveURL("/pos");

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Mở màn hình bán hàng" })).toBeVisible();
    await expect(page.getByTestId("today-revenue")).toHaveCount(0);
    await expect(page.getByTestId("low-stock-list")).toHaveCount(0);

    expect(forbidden).toEqual([]);
  });

  test("nhân viên kho vào thẳng tồn kho, trang chủ có cảnh báo nhưng không có doanh thu", async ({ page }) => {
    const forbidden: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 403) forbidden.push(r.url());
    });

    await loginAs(page, "stock");
    await expect(page).toHaveURL("/inventory");

    await page.goto("/");
    await expect(page.getByTestId("low-stock-list")).toBeVisible();
    await expect(page.getByTestId("today-revenue")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mở màn hình bán hàng" })).toHaveCount(0);

    expect(forbidden).toEqual([]);
  });
});

test.describe("S15 Hồ sơ cá nhân", () => {
  test("hiển thị vai trò và đăng xuất được", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/profile");

    await expect(page.getByTestId("profile-name")).toHaveText("Quản Trọng Hùng");
    await expect(page.getByTestId("profile-role")).toHaveText("Nhân viên kho");
    await expect(page.getByText("chưa hỗ trợ tự đổi mật khẩu")).toBeVisible();

    await page.getByRole("main").getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL("/login");
  });
});
