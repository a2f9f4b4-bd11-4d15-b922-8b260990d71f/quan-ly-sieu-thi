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
  const up = Boolean(res && res.ok);
  // LIVE_REQUIRED=1 turns "no backend" into a failure. Without it the suite skips,
  // which exits 0 — fine locally, but in CI a green run that tested nothing is worse
  // than a red one.
  if (!up && process.env.LIVE_REQUIRED) {
    throw new Error(`LIVE_REQUIRED is set but no backend answered at ${BASE}/api/v1/health.`);
  }
  test.skip(!up, `No backend at ${BASE} — see README "Chạy cùng backend thật".`);
});

/**
 * Playwright reuses whatever server is already on :3000, so `test:e2e:live` can
 * silently run this entire suite against the in-browser mock while the health check
 * above happily confirms the real backend is up. Counting requests that actually
 * left for BASE is the only way to know which backend answered.
 */
function trackLiveCalls(page: Page): () => number {
  let hits = 0;
  page.on("request", (r) => { if (r.url().startsWith(BASE)) hits += 1; });
  return () => hits;
}

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
  const liveCalls = trackLiveCalls(page);
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
  expect(liveCalls(), `no request reached ${BASE} — the suite ran against the mock`).toBeGreaterThan(0);
});

/** Flows 2+3: selling moves stock, invoice and history together. */
test("flows 2+3+6: a sale moves stock, lands in history, and shows in the report", async ({ page }) => {
  const liveCalls = trackLiveCalls(page);
  await login(page, ADMIN.u, ADMIN.p);
  await expect(page).toHaveURL("/");

  // Flow 6 baseline, taken before the sale so the increment can be asserted.
  await page.goto("/reports/revenue");
  await expect(page.getByTestId("total-invoices")).toBeVisible();
  const invoicesBefore = Number((await page.getByTestId("total-invoices").textContent())!.trim());

  // Pick the first row that actually has stock. Skipping when row 0 happens to be
  // sold out would silently drop the only test that writes to the real backend.
  await page.goto("/inventory");
  await expect(page.getByTestId("stock-row").first()).toBeVisible();
  const rows = page.getByTestId("stock-row");
  let sku = "", name = "", before = 0;
  for (let i = 0; i < Math.min(await rows.count(), 20); i += 1) {
    const cells = rows.nth(i).locator("td");
    const qty = Number((await cells.nth(4).textContent())!.trim());
    if (qty >= 1) {
      sku = (await cells.first().textContent())!.trim();
      name = (await cells.nth(1).textContent())!.trim();
      before = qty;
      break;
    }
  }
  expect(sku, "no product in the first 20 inventory rows has stock to sell").not.toBe("");

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

  // Flow 6: the revenue report counts that exact sale, not merely "something".
  await page.goto("/reports/revenue");
  await expect(page.getByTestId("total-invoices")).toBeVisible();
  const invoicesAfter = Number((await page.getByTestId("total-invoices").textContent())!.trim());
  expect(invoicesAfter).toBe(invoicesBefore + 1);
  expect(liveCalls(), `no request reached ${BASE} — the suite ran against the mock`).toBeGreaterThan(0);
});

/**
 * Flows 4+5, READ-ONLY reach only. Receiving a purchase and submitting a count are
 * verified manually (docs/integration-log.md §5) — this test navigates, it does not
 * write. Do not describe it as covering flows 4 and 5 end to end.
 */
test("flows 4+5: stockkeeper reaches purchases and stock counts (read-only)", async ({ page }) => {
  const liveCalls = trackLiveCalls(page);
  await login(page, STOCK.u, STOCK.p);
  await expect(page).toHaveURL("/inventory");

  await page.goto("/purchases");
  await expect(page.getByTestId("purchase-row").first()).toBeVisible();

  await page.goto("/inventory/counts");
  await page.getByLabel("Tìm sản phẩm").fill("");
  await expect(page.getByRole("button", { name: /— tồn \d+/ }).first()).toBeVisible();

  await page.goto("/inventory/movements");
  await expect(page.getByTestId("movement-row").first()).toBeVisible();
  expect(liveCalls(), `no request reached ${BASE} — the suite ran against the mock`).toBeGreaterThan(0);
});

/** Flow 8: the session survives token expiry — one refresh, no logout. */
test("flow 8: expiry triggers exactly one refresh and keeps the session", async ({ page }) => {
  const liveCalls = trackLiveCalls(page);
  const refreshes: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/auth/refresh")) refreshes.push(r.method()); });

  await login(page, ADMIN.u, ADMIN.p);
  await expect(page).toHaveURL("/");

  // The backend's ACCESS_TOKEN_TTL_SECONDS lives in its untracked .env. On a longer
  // default nothing expires during the wait, zero refreshes happen, and the failure
  // below would point at the refresh machinery instead of at the config. Keep the two
  // in step via LIVE_ACCESS_TOKEN_TTL.
  const ttl = Number(process.env.LIVE_ACCESS_TOKEN_TTL ?? 60);
  expect(Number.isFinite(ttl) && ttl > 0, "LIVE_ACCESS_TOKEN_TTL must be a positive number").toBe(true);
  test.skip(ttl > 120, `access token TTL is ${ttl}s — too long to wait out in a smoke test`);
  await page.waitForTimeout((ttl + 6) * 1000);

  await page.goto("/products");
  await expect(page.getByTestId("product-row").first()).toBeVisible();
  await page.goto("/customers");
  await expect(page.getByTestId("customer-row").first()).toBeVisible();

  expect(
    refreshes.length,
    `expected exactly 1 refresh after waiting out a ${ttl}s token, saw ${refreshes.length}. ` +
      `If 0, check the backend's ACCESS_TOKEN_TTL_SECONDS matches LIVE_ACCESS_TOKEN_TTL.`,
  ).toBe(1);
  await expect(page).not.toHaveURL(/\/login/);
  expect(liveCalls(), `no request reached ${BASE} — the suite ran against the mock`).toBeGreaterThan(0);
});
