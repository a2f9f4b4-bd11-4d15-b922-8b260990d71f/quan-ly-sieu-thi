import { test, expect } from "@playwright/test";
import { loginAs, resetMockData, evidence } from "./helpers";

test.describe("UC-05 Xem báo cáo", () => {
  test.beforeEach(async ({ page }) => { await resetMockData(page); });

  test("luồng chuẩn: doanh thu hôm nay phản ánh hóa đơn vừa bán", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/pos");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill("COCA-330");
    await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
    await page.getByLabel("Số lượng Coca-Cola lon 330ml").fill("3");
    await page.getByRole("button", { name: "Thanh toán" }).click();
    await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();
    await expect(page.getByTestId("receipt-invoice-no")).toBeVisible();

    await loginAs(page, "admin");
    await page.goto("/reports/revenue");

    await expect(page.getByTestId("total-invoices")).toHaveText("1");
    await expect(page.getByTestId("total-revenue")).toHaveText("36.000 đ");
    await evidence(page, "uc05-doanh-thu");
  });

  test("E1: ngày kết thúc trước ngày bắt đầu bị chặn, không gọi API", async ({ page }) => {
    await loginAs(page, "admin");

    const reportCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/reports/")) reportCalls.push(r.url());
    });

    await page.goto("/reports/revenue");
    await expect(page.getByTestId("report-empty")).toBeVisible();

    // Setting `from` alone leaves a still-valid range, which legitimately queries.
    await page.getByLabel("Từ ngày").fill("2026-10-20");
    await page.waitForTimeout(500);
    const baseline = reportCalls.length;

    // Now make it invalid: this must issue nothing.
    await page.getByLabel("Đến ngày").fill("2026-10-18");

    await expect(page.getByTestId("range-error"))
      .toHaveText("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
    await page.waitForTimeout(500);
    expect(reportCalls.length).toBe(baseline);
  });

  test("E1b: khoảng quá 366 ngày bị chặn", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/reports/revenue");

    await page.getByLabel("Từ ngày").fill("2024-01-01");
    await page.getByLabel("Đến ngày").fill("2026-10-20");

    await expect(page.getByTestId("range-error")).toHaveText("Khoảng thời gian tối đa là 366 ngày.");
  });

  test("E2: thu ngân bị từ chối xem báo cáo doanh thu", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/reports/revenue");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
    await evidence(page, "uc05-e2-khong-quyen");
  });

  test("E3: khoảng không có dữ liệu hiện trạng thái rỗng, không phải lỗi", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/reports/revenue");

    await page.getByLabel("Từ ngày").fill("2026-01-01");
    await page.getByLabel("Đến ngày").fill("2026-01-31");

    await expect(page.getByTestId("report-empty"))
      .toHaveText("Không có dữ liệu trong khoảng thời gian đã chọn");
  });

  test("nhân viên kho xem được báo cáo tồn kho nhưng không xem được doanh thu", async ({ page }) => {
    await loginAs(page, "stock");
    await page.goto("/reports/inventory");
    await expect(page.getByTestId("total-stock-value")).toBeVisible();

    await page.goto("/reports/revenue");
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  });
});
