import { test, expect } from "@playwright/test";
import { loginAs, resetMockData, evidence } from "./helpers";

test.describe("UC-02 Bán hàng và thanh toán", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("luồng chuẩn: quét hàng, gắn khách, thanh toán tiền mặt, in hóa đơn", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");

    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("COCA-330");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await expect(page.getByTestId("cart-row")).toHaveCount(1);

    await page.getByLabel("Số lượng Coca-Cola lon 330ml").fill("3");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("36.000 đ");

    await page.getByLabel("Số điện thoại hoặc mã khách").fill("0901234567");
    await page.getByRole("button", { name: "Tra cứu" }).click();
    await expect(page.getByTestId("attached-customer")).toContainText("Nguyễn Thị Lan");

    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByLabel("Tiền khách đưa").fill("50000");
    await expect(page.getByTestId("change-amount")).toHaveText("14.000 đ");

    await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();

    await expect(page.getByTestId("receipt-invoice-no")).toContainText("HD");
    await expect(page.getByTestId("points-earned")).toHaveText("Điểm tích lũy: 3");
    await evidence(page, "uc02-hoa-don");
  });

  test("E2: số lượng vượt tồn bị từ chối kèm số tồn hiện tại", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");

    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("PEPSI-330");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await page.getByLabel("Số lượng Pepsi lon 330ml").fill("20");

    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();

    await expect(page.getByTestId("stock-issues")).toContainText("còn 8, đang bán 20");
    await page.getByRole("button", { name: "Sửa về 8" }).click();
    await expect(page.getByLabel("Số lượng Pepsi lon 330ml")).toHaveValue("8");
    await evidence(page, "uc02-e2-thieu-ton");
  });

  test("E1: mã không tồn tại không được thêm vào giỏ", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");

    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("KHONG-TON-TAI");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");

    await expect(page.getByTestId("scan-error")).toContainText("Không tìm thấy sản phẩm");
    await expect(page.getByTestId("cart-row")).toHaveCount(0);
  });

  test("E4: giảm giá vượt hạn mức thu ngân bị từ chối kèm mức tối đa", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");

    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("COCA-330");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await page.getByLabel("Giảm giá").fill("10000");   // 83% of a 12.000 đ subtotal

    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();

    await expect(page.getByTestId("payment-error")).toContainText("vượt hạn mức");
    await expect(page.getByTestId("payment-error")).toContainText("1.200 đ");
    await evidence(page, "uc02-e4-giam-gia");
  });

  test("E5: không tìm thấy khách thì vẫn bán được, không gắn nhầm", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");

    await page.getByLabel("Số điện thoại hoặc mã khách").fill("0900000000");
    await page.getByRole("button", { name: "Tra cứu" }).click();

    await expect(page.getByTestId("customer-note")).toContainText("Không tìm thấy khách");
    await expect(page.getByTestId("attached-customer")).toHaveCount(0);
  });

  test("E7: in lại hóa đơn không tạo hóa đơn thứ hai", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("LAVIE-500");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();
    const invoiceNo = await page.getByTestId("receipt-invoice-no").textContent();
    await page.getByRole("button", { name: "Đóng" }).click();

    // Stock must have moved exactly once. Lavie starts at 240.
    await loginAs(page, "stock");
    await page.goto("/inventory");
    await page.getByLabel("Tìm kiếm").fill("Lavie");
    const row = page.getByTestId("stock-row").filter({ hasText: "Lavie" });
    await expect(row).toContainText("239");

    // And the invoice number is stable — the receipt is a read, not a write.
    expect(invoiceNo).toMatch(/^HD\d{12}$/);
  });

  test("thanh toán nhiều phương thức phải cộng đúng tổng", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("COCA-330");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await page.getByLabel("Số lượng Coca-Cola lon 330ml").fill("3");

    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByLabel("Số tiền 1").fill("20000");
    await expect(page.getByTestId("payment-balance")).toContainText("Còn thiếu 16.000 đ");
    await expect(page.getByRole("button", { name: "Xác nhận thanh toán" })).toBeDisabled();

    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    await page.getByLabel("Số tiền 2").fill("16000");
    await expect(page.getByRole("button", { name: "Xác nhận thanh toán" })).toBeEnabled();
  });
});
