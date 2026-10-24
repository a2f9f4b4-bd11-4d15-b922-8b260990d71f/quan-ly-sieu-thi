import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("S06 Sản phẩm", () => {
  test("quản lý thấy danh sách kèm giá vốn", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/products");

    await expect(page.getByRole("columnheader", { name: "Giá vốn" })).toBeVisible();
    await expect(page.getByText("Coca-Cola lon 330ml")).toBeVisible();
  });

  test("thu ngân không thấy cột giá vốn", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/products");

    await expect(page.getByText("Coca-Cola lon 330ml")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Giá vốn" })).toHaveCount(0);
  });

  test("tìm kiếm lọc đúng sản phẩm", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/products");

    await page.getByLabel("Tìm kiếm").fill("Hảo Hảo");
    await expect(page.getByText("Mì Hảo Hảo tôm chua cay")).toBeVisible();
    await expect(page.getByText("Coca-Cola lon 330ml")).toHaveCount(0);
  });

  test("tìm kiếm không có kết quả hiện trạng thái rỗng", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/products");

    await page.getByLabel("Tìm kiếm").fill("khongtontai123");
    await expect(page.getByText("Không tìm thấy sản phẩm nào")).toBeVisible();
  });

  test("lọc theo danh mục", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/products");

    await page.getByLabel("Danh mục").selectOption({ label: "Nước giải khát" });
    await expect(page.getByTestId("product-row").first()).toBeVisible();
    await expect(page.getByText("Mì Hảo Hảo tôm chua cay")).toHaveCount(0);
  });

  test("thu ngân không sửa được sản phẩm", async ({ page }) => {
    await loginAs(page, "cashier");
    await page.goto("/products");

    await expect(page.getByRole("button", { name: "Ngừng bán" })).toHaveCount(0);
  });
});
