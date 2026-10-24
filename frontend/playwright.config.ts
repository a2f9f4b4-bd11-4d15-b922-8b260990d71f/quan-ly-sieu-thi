import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: [["html", { outputFolder: "e2e-report", open: "never" }], ["list"]],
});
