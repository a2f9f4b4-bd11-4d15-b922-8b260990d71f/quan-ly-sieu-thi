import { test, expect, type Page } from "@playwright/test";
import { loginAs, resetMockData } from "./helpers";

async function sellOne(page: Page, sku: string, qty = "1") {
  await page.goto("/pos");
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill(sku);
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
  if (qty !== "1") {
    await page.getByLabel(/^Số lượng /).fill(qty);
  }
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  await expect(page.getByTestId("receipt-invoice-no")).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();
}

test.describe("S04 Lịch sử hóa đơn", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("hóa đơn vừa bán xuất hiện trong lịch sử", async ({ page }) => {
    await loginAs(page, "cashier");
    await sellOne(page, "COCA-330", "3");

    await page.goto("/sales");
    await expect(page.getByTestId("sale-row")).toHaveCount(1);
    await expect(page.getByTestId("sale-row")).toContainText("36.000 đ");
  });

  test("mở chi tiết và in lại không tạo hóa đơn mới", async ({ page }) => {
    await loginAs(page, "cashier");
    await sellOne(page, "COCA-330", "3");

    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await expect(page.getByText("Coca-Cola lon 330ml")).toBeVisible();

    await page.getByRole("button", { name: "In lại" }).click();
    await expect(page.getByTestId("receipt-invoice-no")).toBeVisible();
    await page.getByRole("button", { name: "Đóng" }).click();

    await page.goto("/sales");
    await expect(page.getByTestId("sale-row")).toHaveCount(1);
  });

  test("thu ngân không thấy cột giá vốn trong chi tiết hóa đơn", async ({ page }) => {
    await loginAs(page, "cashier");
    await sellOne(page, "COCA-330");

    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await expect(page.getByTestId("cost-cell")).toHaveCount(0);
  });

  test("quản lý thấy cột giá vốn trong chi tiết hóa đơn", async ({ page }) => {
    await loginAs(page, "cashier");
    await sellOne(page, "COCA-330");

    await loginAs(page, "admin");
    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await expect(page.getByTestId("cost-cell").first()).toBeVisible();
  });

  test("lịch sử rỗng khi chưa bán gì", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/sales");
    await expect(page.getByText("Chưa có hóa đơn nào")).toBeVisible();
  });
});
