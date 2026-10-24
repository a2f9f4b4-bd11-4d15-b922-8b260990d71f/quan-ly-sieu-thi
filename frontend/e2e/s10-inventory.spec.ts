import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("S10 Tồn kho", () => {
  test("nhân viên kho thấy tồn và cảnh báo sắp hết", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/inventory");

    await expect(page.getByText("Coca-Cola lon 330ml")).toBeVisible();

    await page.getByRole("button", { name: "Sắp hết hàng" }).click();
    // seeded below threshold: Pepsi (8<=24), Sữa đặc Ông Thọ (3<=10), P/S (0<=6)
    await expect(page.getByText("Pepsi lon 330ml")).toBeVisible();
    await expect(page.getByText("Kem đánh răng P/S trà xanh")).toBeVisible();
    await expect(page.getByText("Coca-Cola lon 330ml")).toHaveCount(0);
  });

  test("thu ngân xem được tồn nhưng không có tab cảnh báo", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/inventory");

    await expect(page.getByText("Coca-Cola lon 330ml")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sắp hết hàng" })).toHaveCount(0);
  });

  test("thu ngân bị từ chối xem biến động kho", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/inventory/movements");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });

  test("sổ biến động rỗng khi chưa có giao dịch", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/inventory/movements");
    await expect(page.getByText("Chưa có biến động kho nào")).toBeVisible();
  });
});
