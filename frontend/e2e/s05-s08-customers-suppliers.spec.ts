import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("S05 Khách hàng", () => {
  test("thu ngân xem được danh sách khách", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/customers");
    await expect(page.getByText("Nguyễn Thị Lan")).toBeVisible();
  });

  test("số điện thoại sai định dạng bị chặn phía client", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/customers");
    await page.getByRole("button", { name: "Thêm khách hàng" }).click();

    await page.getByLabel("Tên khách hàng").fill("Khách thử");
    await page.getByLabel("Số điện thoại").fill("12345");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0")).toBeVisible();
  });

  test("số điện thoại trùng hiện lỗi ngay trên trường đó", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/customers");
    await page.getByRole("button", { name: "Thêm khách hàng" }).click();

    await page.getByLabel("Tên khách hàng").fill("Khách trùng");
    await page.getByLabel("Số điện thoại").fill("0901234567"); // seeded: Nguyễn Thị Lan
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Số điện thoại đã thuộc về khách hàng khác.")).toBeVisible();
  });
});

test.describe("S08 Nhà cung cấp", () => {
  test("nhân viên kho xem được nhà cung cấp", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/suppliers");
    await expect(page.getByText("Công ty TNHH Phân phối Miền Nam")).toBeVisible();
  });

  test("thu ngân bị từ chối xem nhà cung cấp", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/suppliers");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });
});
