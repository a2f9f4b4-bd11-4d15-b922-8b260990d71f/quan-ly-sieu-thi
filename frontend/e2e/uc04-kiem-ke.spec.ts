import { test, expect } from "@playwright/test";
import { loginAs, resetMockData, evidence } from "./helpers";

test.describe("UC-04 Kiểm kê và điều chỉnh tồn kho", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("luồng chuẩn: ghi nhận chênh lệch và cập nhật tồn", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/inventory/counts");

    await page.getByLabel("Tìm sản phẩm").fill("Coca");
    await page.getByRole("button", { name: /Coca-Cola lon 330ml/ }).click();
    await expect(page.getByTestId("system-qty")).toHaveText("96");

    await page.getByLabel("Số lượng thực đếm").fill("94");
    await expect(page.getByTestId("count-difference")).toContainText("-2");
    await page.getByLabel("Lý do điều chỉnh").fill("Hàng hỏng, kiểm kê định kỳ");
    await page.getByRole("button", { name: "Ghi nhận kiểm kê" }).click();

    await expect(page.getByTestId("count-row").first()).toContainText("Coca-Cola lon 330ml");
    await expect(page.getByTestId("count-row").first()).toContainText("Hàng hỏng");
    await evidence(page, "uc04-kiem-ke");

    await page.goto("/inventory");
    await page.getByLabel("Tìm kiếm").fill("Coca");
    await expect(page.getByTestId("stock-row").filter({ hasText: "Coca" })).toContainText("94");

    await page.goto("/inventory/movements");
    await expect(page.getByTestId("movement-row").first()).toContainText("Điều chỉnh");
    await expect(page.getByTestId("movement-row").first()).toContainText("-2");
  });

  test("E2: tồn thay đổi giữa chừng thì bị chặn và phải xác nhận lại", async ({ page, context }) => {
    await loginAs(page, "stock");
    await page.goto("/inventory/counts");
    await page.getByLabel("Tìm sản phẩm").fill("Coca");
    await page.getByRole("button", { name: /Coca-Cola lon 330ml/ }).click();
    await expect(page.getByTestId("system-qty")).toHaveText("96");

    // another terminal sells one unit while the count is open
    const other = await context.newPage();
    await loginAs(other, "cashier");
    await other.goto("/pos");
    await other.getByLabel("Quét mã vạch hoặc nhập SKU").fill("COCA-330");
    await other.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await other.getByRole("button", { name: "Thanh toán" }).click();
    await other.getByRole("button", { name: "Xác nhận thanh toán" }).click();
    await expect(other.getByTestId("receipt-invoice-no")).toBeVisible();
    await other.close();

    await page.getByLabel("Số lượng thực đếm").fill("90");
    await page.getByLabel("Lý do điều chỉnh").fill("Kiểm kê");
    await page.getByRole("button", { name: "Ghi nhận kiểm kê" }).click();

    await expect(page.getByTestId("stock-conflict")).toContainText("Tồn kho đã thay đổi");
    await expect(page.getByTestId("stock-conflict")).toContainText("95");
    await evidence(page, "uc04-e2-xung-dot");

    await page.getByRole("button", { name: "Tải lại số tồn và đếm lại" }).click();
    await expect(page.getByTestId("system-qty")).toHaveText("95");
    await page.getByRole("button", { name: "Ghi nhận kiểm kê" }).click();
    await expect(page.getByTestId("count-row").first()).toContainText("Coca-Cola lon 330ml");
  });

  test("E3: không có lý do thì không ghi nhận được", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/inventory/counts");
    await page.getByLabel("Tìm sản phẩm").fill("Coca");
    await page.getByRole("button", { name: /Coca-Cola lon 330ml/ }).click();
    await page.getByLabel("Số lượng thực đếm").fill("90");

    await expect(page.getByRole("button", { name: "Ghi nhận kiểm kê" })).toBeDisabled();
  });

  test("thu ngân không vào được màn hình kiểm kê", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/inventory/counts");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });
});
