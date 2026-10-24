import { test, expect } from "@playwright/test";

test.describe("UC-01 Đăng nhập", () => {
  test("luồng chuẩn: admin đăng nhập và vào trang chủ", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("admin123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation").getByText("Nguyễn Thái Bình")).toBeVisible();
  });

  test("thu ngân được đưa thẳng tới màn hình POS", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("thungan");
    await page.getByLabel("Mật khẩu").fill("cashier123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("/pos");
  });

  test("E2: sai mật khẩu hiện thông báo chung, không lộ tài khoản", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByTestId("form-error")).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
    await expect(page).toHaveURL("/login");
  });

  test("E3: tài khoản bị khóa bị từ chối", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("nghiviec");
    await page.getByLabel("Mật khẩu").fill("locked123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByTestId("form-error")).toContainText("bị khóa");
  });

  test("biểu mẫu dùng POST để mật khẩu không bao giờ lọt vào URL", async ({ page }) => {
    await page.goto("/login");
    // Before React hydrates there is no submit handler, so a click submits
    // natively. With the default GET the credentials would land in the query
    // string and in browser history.
    await expect(page.locator("form")).toHaveAttribute("method", "post");

    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("admin123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    expect(page.url()).not.toContain("password");
    expect(page.url()).not.toContain("username");
  });

  test("chưa đăng nhập thì bị đẩy về trang đăng nhập", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL("/login");
  });
});
