import { test, expect, type Page } from "@playwright/test";
import { loginAs, resetMockData } from "./helpers";

const DIR = "../docs/screenshots";

async function shot(page: Page, name: string) {
  // Next 16 mounts its dev overlay inside <script data-nextjs-dev-overlay>
  // holding a <nextjs-portal> custom element — not a div, which is why
  // container-level tricks miss it. Hide it and our own mock toolbar.
  await page.addStyleTag({ content: "[data-nextjs-dev-overlay], nextjs-portal, [data-dev-toolbar]{display:none !important}" });
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

async function sell(page: Page, sku: string, name?: string, qty?: string) {
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill(sku);
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
  // Target the row's own field — .first() would overwrite an earlier line.
  if (name && qty) await page.getByLabel(`Số lượng ${name}`).fill(qty);
}

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Screenshots are a deliberate artefact, not a test. Without this guard every
 * `npx playwright test` silently rewrites docs/screenshots — and a run that
 * happens to be in live mode, or against a stopped backend, replaces good
 * images with empty ones.
 *
 * Run on purpose with: npm run screenshots
 */
test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 (npm run screenshots)");

test("capture README screenshots", async ({ page, context }) => {
  await resetMockData(page);

  // ---- POS: cart with a customer attached
  await loginAs(page, "cashier");
  await page.goto("/pos");
  await sell(page, "COCA-330", "Coca-Cola lon 330ml", "3");
  await sell(page, "OISHI-BG", "Bánh gạo Oishi 120g", "2");
  await page.getByLabel("Số điện thoại hoặc mã khách").fill("0901234567");
  await page.getByRole("button", { name: "Tra cứu" }).click();
  await expect(page.getByTestId("attached-customer")).toBeVisible();
  await shot(page, "pos-ban-hang");

  // ---- POS: receipt
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await page.getByLabel("Tiền khách đưa").fill("100000");
  await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  await expect(page.getByTestId("receipt-invoice-no")).toBeVisible();
  await shot(page, "hoa-don");
  await page.getByRole("button", { name: "Đóng" }).click();

  // ---- POS: insufficient stock
  await sell(page, "PEPSI-330", "Pepsi lon 330ml", "20");
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  await expect(page.getByTestId("stock-issues")).toBeVisible();
  await shot(page, "pos-thieu-ton");

  // ---- No permission, reached by URL
  await page.goto("/reports/revenue");
  await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  await shot(page, "khong-co-quyen");

  // ---- Stockkeeper: low stock
  await loginAs(page, "stock");
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Sắp hết hàng" }).click();
  await expect(page.getByTestId("stock-row").first()).toBeVisible();
  await shot(page, "ton-kho-sap-het");

  // ---- Stock count conflict (two terminals)
  await page.goto("/inventory/counts");
  await page.getByLabel("Tìm sản phẩm").fill("Coca");
  await page.getByRole("button", { name: /Coca-Cola lon 330ml/ }).click();
  const other = await context.newPage();
  await loginAs(other, "cashier");
  await other.goto("/pos");
  await sell(other, "COCA-330");
  await other.getByRole("button", { name: "Thanh toán" }).click();
  await other.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  await expect(other.getByTestId("receipt-invoice-no")).toBeVisible();
  await other.close();
  await page.getByLabel("Số lượng thực đếm").fill("90");
  await page.getByLabel("Lý do điều chỉnh").fill("Kiểm kê định kỳ cuối tuần");
  await page.getByRole("button", { name: "Ghi nhận kiểm kê" }).click();
  await expect(page.getByTestId("stock-conflict")).toBeVisible();
  await shot(page, "kiem-ke-xung-dot");

  // ---- Goods receipt
  // The second tab's login replaced the shared session, so sign back in.
  await loginAs(page, "stock");
  await page.goto("/purchases");
  await page.getByTestId("purchase-row").first().click();
  await page.getByRole("button", { name: "Xác nhận nhận hàng" }).click();
  await expect(page.getByTestId("purchase-status")).toHaveText("Đã nhận");
  await shot(page, "phieu-nhap");

  // ---- Admin: dashboard, products, revenue report
  await loginAs(page, "admin");
  await page.goto("/");
  await expect(page.getByTestId("today-revenue")).toBeVisible();
  await shot(page, "trang-chu");

  await page.goto("/products");
  await expect(page.getByRole("columnheader", { name: "Giá vốn" })).toBeVisible();
  await shot(page, "san-pham");

  await page.goto("/reports/revenue");
  await expect(page.getByTestId("total-revenue")).toBeVisible();
  await shot(page, "bao-cao-doanh-thu");
});
