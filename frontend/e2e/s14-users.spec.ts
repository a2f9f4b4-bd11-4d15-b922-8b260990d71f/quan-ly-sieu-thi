import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("S14 Quản lý nhân viên", () => {
  test("quản lý xem được danh sách nhân viên", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/users");
    await expect(page.getByText("Lê Tuấn Linh")).toBeVisible();
    await expect(page.getByText("Nhân viên kho")).toBeVisible();
  });

  test("không thể khóa tài khoản của chính mình", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/users");

    const adminRow = page.getByTestId("user-row").filter({ hasText: "Nguyễn Thái Bình" });
    await adminRow.getByRole("button", { name: "Khóa" }).click();

    await expect(page.getByTestId("action-error"))
      .toHaveText("Không thể khóa tài khoản của chính bạn.");
    // the row must still show as active
    await expect(adminRow.getByText("Đang hoạt động")).toBeVisible();
  });

  test("khóa và mở khóa một nhân viên khác", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/users");

    const row = page.getByTestId("user-row").filter({ hasText: "Lê Tuấn Linh" });
    await row.getByRole("button", { name: "Khóa" }).click();
    await expect(row.getByText("Ngừng hoạt động")).toBeVisible();

    await row.getByRole("button", { name: "Mở khóa" }).click();
    await expect(row.getByText("Đang hoạt động")).toBeVisible();
  });

  test("thu ngân không vào được màn hình nhân viên", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/users");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });
});
