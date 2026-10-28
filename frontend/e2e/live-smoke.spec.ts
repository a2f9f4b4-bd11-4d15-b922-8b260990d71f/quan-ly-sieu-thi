import { test, expect, type Page } from "@playwright/test";

/**
 * MVP acceptance flows against the LIVE backend.
 *
 * Data-agnostic: the backend's seed differs from the mock's, so every assertion
 * is relational (stock fell by what was sold) rather than absolute. Skips cleanly
 * when no backend is listening, so it never fails for the wrong reason.
 *
 * Run: npm run test:e2e:live   (needs ../api-mini-store running on :3001)
 */
const BASE = process.env.LIVE_API_URL ?? "http://localhost:3001";
const ADMIN = { u: process.env.LIVE_ADMIN_USER ?? "admin", p: process.env.LIVE_ADMIN_PASS ?? "Admin-Mvp-2026" };
const CASHIER = { u: process.env.LIVE_CASHIER_USER ?? "cashier", p: process.env.LIVE_CASHIER_PASS ?? "Demo-Mvp-2026" };
const STOCK = { u: process.env.LIVE_STOCK_USER ?? "stockkeeper", p: process.env.LIVE_STOCK_PASS ?? "Demo-Mvp-2026" };

// Login is throttled at 5/60s per IP, so these run serially and sparingly.
test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async () => {
  const res = await fetch(`${BASE}/api/v1/health`).catch(() => null);
  test.skip(!res || !res.ok, `No backend at ${BASE} — run: cd ../api-mini-store && docker compose up -d mysql && npm run start:prod`);
});

/**
 * Logs in, and distinguishes a throttle from a credential problem.
 * The API allows 5 logins per 60s per IP; beyond that it answers 429, which the
 * UI renders just like a wrong password. Each role logs in exactly once here so
 * the whole suite stays under that budget.
 */
async function login(page: Page, u: string, p: string) {
  let throttled = false;
  const watch = (r: import("@playwright/test").Response) => {
    if (r.url().includes("/auth/login") && r.status() === 429) throttled = true;
  };
  page.on("response", watch);

  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(u);
  await page.getByLabel("Mật khẩu").fill(p);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 }).catch(() => {});
  page.off("response", watch);

  if (throttled) {
    throw new Error(`Login throttled (429) for "${u}". The API allows 5 logins/60s per IP — wait a minute and re-run.`);
  }
  await expect(page, `login failed for "${u}"`).not.toHaveURL(/\/login/);
}

/** Flows 1+7 (cashier): routing, no cost price, forbidden screens issue no requests. */
test("flows 1+7: cashier routing, cost hidden, role gating holds", async ({ page }) => {
  const forbidden: string[] = [];
  page.on("response", (r) => { if (r.status() === 403) forbidden.push(new URL(r.url()).pathname); });

  await login(page, CASHIER.u, CASHIER.p);
  await expect(page).toHaveURL("/pos");

  await page.goto("/products");
  await expect(page.getByTestId("product-row").first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Giá vốn" })).toHaveCount(0);

  for (const path of ["/reports/revenue", "/users"]) {
    await page.goto(path);
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
  }
  expect(forbidden, `403s taken: ${forbidden.join(", ")}`).toEqual([]);
});

/** Flows 2+3: selling moves stock, invoice and history together. */
test("flows 2+3+6: a sale moves stock, lands in history, and shows in the report", async ({ page }) => {
  await login(page, ADMIN.u, ADMIN.p);
  await expect(page).toHaveURL("/");

  await page.goto("/inventory");
  const row = page.getByTestId("stock-row").first();
  await expect(row).toBeVisible();
  const sku = (await row.locator("td").first().textContent())!.trim();
  const name = (await row.locator("td").nth(1).textContent())!.trim();
  const before = Number((await row.locator("td").nth(4).textContent())!.trim());
  test.skip(before < 1, "first product has no stock to sell");

  await page.goto("/pos");
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").fill(sku);
  await page.getByLabel("Quét mã vạch hoặc nhập SKU").press("Enter");
  await expect(page.getByTestId("cart-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await page.getByRole("button", { name: "Xác nhận thanh toán" }).click();

  const invoice = (await page.getByTestId("receipt-invoice-no").textContent({ timeout: 30_000 }))!.trim();
  expect(invoice).toMatch(/^HD\d{12}$/);
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.goto("/inventory");
  await page.getByLabel("Tìm kiếm").fill(name);
  await expect(page.getByTestId("stock-row").first()).toBeVisible();
  const after = Number((await page.getByTestId("stock-row").first().locator("td").nth(4).textContent())!.trim());
  expect(after).toBe(before - 1);

  await page.goto("/sales");
  await expect(page.getByTestId("sale-row").first()).toContainText(invoice);

  // Flow 6: the revenue report reflects today's activity, including that sale.
  await page.goto("/reports/revenue");
  await expect(page.getByTestId("total-invoices")).toBeVisible();
  const invoices = Number((await page.getByTestId("total-invoices").textContent())!.trim());
  expect(invoices).toBeGreaterThan(0);
});

/** Flow 4+5: stockkeeper can reach receiving and counting. */
test("flows 4+5: stockkeeper reaches purchases and stock counts", async ({ page }) => {
  await login(page, STOCK.u, STOCK.p);
  await expect(page).toHaveURL("/inventory");

  await page.goto("/purchases");
  await expect(page.getByTestId("purchase-row").first()).toBeVisible();

  await page.goto("/inventory/counts");
  await page.getByLabel("Tìm sản phẩm").fill("");
  await expect(page.getByRole("button", { name: /— tồn \d+/ }).first()).toBeVisible();

  await page.goto("/inventory/movements");
  await expect(page.getByTestId("movement-row").first()).toBeVisible();
});

/** Flow 8: the session survives token expiry — one refresh, no logout. */
test("flow 8: expiry triggers exactly one refresh and keeps the session", async ({ page }) => {
  const refreshes: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/auth/refresh")) refreshes.push(r.method()); });

  await login(page, ADMIN.u, ADMIN.p);
  await expect(page).toHaveURL("/");

  // ACCESS_TOKEN_TTL_SECONDS is 60 in the integration .env.
  await page.waitForTimeout(66_000);

  await page.goto("/products");
  await expect(page.getByTestId("product-row").first()).toBeVisible();
  await page.goto("/customers");
  await expect(page.getByTestId("customer-row").first()).toBeVisible();

  expect(refreshes.length, `refresh calls: ${refreshes.length}`).toBe(1);
  await expect(page).not.toHaveURL(/\/login/);
});
