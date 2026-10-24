import { test, expect } from "@playwright/test";
import { loginAs, resetMockData, evidence } from "./helpers";

test.describe("UC-03 Nhập hàng và xác nhận nhận hàng", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("luồng chuẩn: nhận phiếu nháp, tồn tăng, ghi biến động kho", async ({ page }) => {
    await loginAs(page, "stock");

    // Gạo ST25 starts at 14
    await page.goto("/inventory");
    await page.getByLabel("Tìm kiếm").fill("ST25");
    await expect(page.getByTestId("stock-row").filter({ hasText: "ST25" })).toContainText("14");

    await page.goto("/purchases");
    await page.getByTestId("purchase-row").first().click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Nháp");

    await page.getByRole("button", { name: "Xác nhận nhận hàng" }).click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Đã nhận");
    await evidence(page, "uc03-nhan-hang");

    await page.goto("/inventory");
    await page.getByLabel("Tìm kiếm").fill("ST25");
    await expect(page.getByTestId("stock-row").filter({ hasText: "ST25" })).toContainText("24");

    await page.goto("/inventory/movements");
    await expect(page.getByTestId("movement-row").first()).toContainText("Nhập hàng");
    await expect(page.getByTestId("movement-row").first()).toContainText("+10");
  });

  test("E3: phiếu đã nhận không còn nút nhận hàng", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/purchases");
    await page.getByTestId("purchase-row").first().click();
    await page.getByRole("button", { name: "Xác nhận nhận hàng" }).click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Đã nhận");

    await page.reload();
    await expect(page.getByRole("button", { name: "Xác nhận nhận hàng" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hủy phiếu" })).toHaveCount(0);
  });

  test("hủy phiếu nháp không đụng tồn kho", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/purchases");
    await page.getByTestId("purchase-row").first().click();
    await page.getByRole("button", { name: "Hủy phiếu" }).click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Đã hủy");

    await page.goto("/inventory");
    await page.getByLabel("Tìm kiếm").fill("ST25");
    await expect(page.getByTestId("stock-row").filter({ hasText: "ST25" })).toContainText("14");
  });

  test("E1: nhà cung cấp ngừng hoạt động không xuất hiện khi tạo phiếu", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/purchases/new");

    const options = page.getByLabel("Nhà cung cấp").locator("option");
    // Wait for the supplier list to load: placeholder + the two active suppliers.
    await expect(options).toHaveCount(3);
    const texts = (await options.allTextContents()).join("|");
    expect(texts).toContain("Đại lý Tân Bình");
    expect(texts).not.toContain("NCC Ngừng hợp tác");
  });

  test("tạo phiếu nháp mới rồi nhận hàng", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/purchases/new");

    await page.getByLabel("Nhà cung cấp").selectOption({ label: "Đại lý Tân Bình" });
    await page.getByRole("button", { name: "Thêm dòng hàng" }).click();
    await page.getByLabel("Số lượng dòng 1").fill("5");
    await page.getByLabel("Giá nhập dòng 1").fill("7000");
    await expect(page.getByTestId("purchase-total")).toHaveText("35.000 đ");

    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Nháp");
    await page.getByRole("button", { name: "Xác nhận nhận hàng" }).click();
    await expect(page.getByTestId("purchase-status")).toHaveText("Đã nhận");
  });

  test("thu ngân không vào được phiếu nhập", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/purchases");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });
});
