import { test, expect } from "@playwright/test";

test.describe("UC-01 Đăng nhập", () => {
  test("luồng chuẩn: admin đăng nhập và vào trang chủ", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("admin123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Nguyễn Thái Bình")).toBeVisible();
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

  test("chưa đăng nhập thì bị đẩy về trang đăng nhập", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL("/login");
  });
});
