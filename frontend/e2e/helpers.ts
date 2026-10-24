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

/** Wipes the persisted mock database so each test starts from the seed. */
export async function resetMockData(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => {
    window.localStorage.removeItem("mini-store.mockdb");
    window.localStorage.removeItem("mini-store.session");
  });
  await page.reload();
}

/** Captures a screenshot into the evidence folder for Chương IV. */
export async function evidence(page: Page, name: string) {
  await page.screenshot({ path: `e2e-evidence/${name}.png`, fullPage: true });
}
