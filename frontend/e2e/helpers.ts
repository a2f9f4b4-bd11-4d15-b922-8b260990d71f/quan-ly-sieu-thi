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

/**
 * Captures a screenshot into the evidence folder for Chương IV.
 * Hides the mock-mode dev toolbar so the image shows only the product.
 */
export async function evidence(page: Page, name: string) {
  await page.addStyleTag({
    content: "[data-dev-toolbar]{display:none !important}",
  });
  // Next's devtools overlay mounts into a CLOSED shadow root on a body-level
  // div, so neither a stylesheet nor .shadowRoot can reach it. The application
  // always renders a <main>; anything at body level without one is not ours.
  await page.evaluate(() => {
    document.querySelectorAll("body > div").forEach((el) => {
      if (!el.querySelector("main")) (el as HTMLElement).style.display = "none";
    });
  });
  await page.screenshot({ path: `e2e-evidence/${name}.png`, fullPage: true });
}

/**
 * Records every 403 the page takes. A screen must never issue a request the
 * current role cannot make — hiding UI is not enough, the query must be gated.
 */
export function watchForbidden(page: Page): string[] {
  const hits: string[] = [];
  page.on("response", (r) => {
    if (r.status() === 403) hits.push(`${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return hits;
}
