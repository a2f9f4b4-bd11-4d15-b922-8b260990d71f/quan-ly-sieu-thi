import type { Page } from "@playwright/test";

export const ACCOUNTS = {
  admin: { username: "admin", password: "admin123", name: "Nguyễn Thái Bình" },
  cashier: { username: "thungan", password: "cashier123", name: "Lê Tuấn Linh" },
  stock: { username: "thukho", password: "stock123", name: "Quản Trọng Hùng" },
} as const;

export async function loginAs(page: Page, who: keyof typeof ACCOUNTS) {
  const account = ACCOUNTS[who];
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(account.username);
  await page.getByLabel("Mật khẩu").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
